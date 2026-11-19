/**
 * `/admin/email-templates` — the transactional-mail override console (#1138).
 *
 * **The register is the list.** There is no table of templates here and none in Postgres: the
 * rows this module answers are `EMAIL_TEMPLATES` in `lib/email/templates/index.ts`, filtered to the
 * member-facing ones. So a template added to the register appears on the page with no change here
 * (#1138 requirement 1: "Shipping a new template means landing its default in the register first;
 * the admin page then picks it up"), and a row in `email_template_version` whose id the code no
 * longer carries is invisible — the intersection is the register, never the table.
 *
 * **What "default" means.** No published row, no draft: the mail that goes out is the one
 * `content/email-bodies.md` and the template's own `document()` compose. Nothing in this module
 * copies that default into a row, and a reset therefore needs no tombstone — the absence of a
 * published row *is* the default.
 *
 * **Three writes, one shape.** Save writes a draft, publish promotes the stored draft to a
 * published version, reset retires both. Each goes through `act()` (`lib/admin/act.ts`), so the
 * actor's rung is read inside the same transaction as the write and the audit row is the last
 * statement before the commit. `email-template.save` / `.publish` / `.reset` are the three names,
 * all `admin`, in `lib/admin/roles.ts`.
 *
 * **Validation is `lib/email/override.ts`'s**, not a rule written twice: an unknown `{{variable}}`,
 * an empty subject or body, and the Counterparty no-leak rule are the same functions the preview
 * calls, so the screen cannot show a mail the save path would refuse, or the other way round.
 *
 * **The published words are what a real send reads; the draft never is.** `publishEmailTemplate()`
 * publishes the **stored draft** — the words that survived a save — so an unsaved edit in a form
 * cannot become production mail, and a publish with no draft is refused rather than publishing the
 * default (that act is `Reset to Default`, a different button and a different audit row).
 */
import { act, ActRefused, type ActResult } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import { queryRows } from "@/lib/db/client";
import type { EmailClass } from "@/lib/email/band";
import { bodySource } from "@/lib/email/body";
import { overrideProblems, type EmailOverride, type OverrideProblem } from "@/lib/email/override";
import { renderSampleEmail, type SampleRender } from "@/lib/email/samples";
import {
  EMAIL_TEMPLATES,
  type EmailRecipient,
  type RegisteredEmailTemplate,
  templateById,
} from "@/lib/email/templates/index";
import { sendMail, type MailOutcome } from "@/lib/flow/email";
import {
  emailTemplateVersionIdOf,
  listEmailTemplateLive,
  listEmailTemplateVersions,
  nextEmailTemplateVersion,
  publishEmailTemplateVersion,
  resetEmailTemplateOverride,
  saveEmailTemplateDraft,
  type EmailTemplateSql,
  type EmailTemplateVersionSummary,
} from "@/lib/db/email-templates";

/** `/admin/email-templates` — re-exported from the pure module, where the console's paths live. */
export { ADMIN_EMAIL_TEMPLATES_PATH, adminEmailTemplatePath } from "@/lib/admin/paths";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a write was refused — facts about the request, never about permission. Permission is
 * `act()`'s (`role-too-low` and friends), and the screen draws both kinds through one sentence
 * lookup.
 */
export const EMAIL_TEMPLATE_REFUSALS = [
  /** The id is not an in-scope registered template (a typo, or a template that never existed). */
  "no-such-template",
  /** The template keeps its body in code (`relationship-expired`) — there is nothing to edit. */
  "not-editable",
  /** `checkOverride()` refused the words; `problems` names the variable or the leaked word. */
  "invalid-override",
  /** Publish asked for a template with no saved draft. Save first, or this is a Reset. */
  "no-draft",
  /** Reset asked for a template that is already the default. */
  "nothing-to-reset",
  /** Another write took the next version number between the read and the insert; nothing landed. */
  "version-conflict",
] as const;

export type EmailTemplateRefusal = (typeof EMAIL_TEMPLATE_REFUSALS)[number];

export class EmailTemplateRefused extends Error {
  readonly reason: EmailTemplateRefusal;
  readonly problems: readonly OverrideProblem[];

  constructor(
    reason: EmailTemplateRefusal,
    message: string,
    problems: readonly OverrideProblem[] = [],
  ) {
    super(message);
    this.name = "EmailTemplateRefused";
    this.reason = reason;
    this.problems = problems;
  }
}

/** What an action hands back: a version id, or a code plus the problems behind it. */
export type EmailTemplateOutcome =
  | { readonly ok: true; readonly templateId: string; readonly versionId: string }
  | {
      readonly ok: false;
      /** A refusal code from this module, or `act()`'s — the screen looks up either. */
      readonly code: string;
      readonly problems?: readonly OverrideProblem[];
    };

/**
 * The one shape both screens post: the register id and the three editable fields.
 *
 * Defined here rather than in the action module so the client component can type its callbacks
 * against the same shape the action takes — a `import type` across that boundary is erased, which
 * is exactly what makes it legal for a `"use client"` module to name it.
 */
export interface EmailTemplatePost {
  readonly templateId: string;
  readonly subject: string;
  readonly preheader: string;
  readonly body: string;
}

/* ------------------------------------------------------------------ *
 * The templates this page owns
 * ------------------------------------------------------------------ */

/**
 * The member-facing register: every entry except the operator's own.
 *
 * `recipient === "operator"` is the filter, and it is one value rather than a list of ids because
 * #1138's exclusion ("`stakeholder-release-note` stays out of this page") is a *fact about the
 * mail* — it is ours, not a member's — and a list of ids would have to be edited every time a
 * second operator mail is registered.
 */
export function memberFacingTemplates(): readonly RegisteredEmailTemplate[] {
  return EMAIL_TEMPLATES.filter((template) => template.recipient !== "operator");
}

/** One registered template by id, only if this page owns it. `undefined` is `notFound()`. */
export function memberFacingTemplate(templateId: string): RegisteredEmailTemplate | undefined {
  const template = templateById(templateId);
  if (template === undefined || template.recipient === "operator") return undefined;
  return template;
}

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** The three states the list's badge draws. `draft` is shown *beside* `published`, never instead. */
export type EmailTemplateState = "default" | "draft" | "published";

/** One row of the console list. */
export interface EmailTemplateListRow {
  readonly id: string;
  readonly numeral: number;
  readonly emailClass: EmailClass;
  readonly recipient: EmailRecipient;
  /** `published` wins over `draft`, because that is what the send path is reading right now. */
  readonly state: EmailTemplateState;
  /** A saved edit not yet published. True beside `published` too — that is the point of a draft. */
  readonly pendingDraft: boolean;
  /** Does this template have a body an admin may edit at all? */
  readonly editable: boolean;
  readonly lastEditedAt: string | null;
  readonly lastEditedBy: string | null;
}

/** The newest live row of a template, whichever state it is in — what "last edited" means. */
function newestOf(live: {
  readonly draft?: EmailTemplateVersionSummary;
  readonly published?: EmailTemplateVersionSummary;
}): EmailTemplateVersionSummary | undefined {
  const { draft, published } = live;
  if (draft === undefined) return published;
  if (published === undefined) return draft;
  return draft.version > published.version ? draft : published;
}

/**
 * Every member-facing template, with its live state.
 *
 * A database that cannot answer is **not** an empty list here: the caller catches
 * `DatabaseUnavailableError` and draws the failure panel, because "no template has an override" and
 * "the overrides could not be read" are different statements and only one of them is true. The
 * register half of every row is code, so the screen would otherwise look complete while the
 * statuses were invented.
 */
export async function listEmailTemplates(): Promise<EmailTemplateListRow[]> {
  const live = await listEmailTemplateLive();
  return memberFacingTemplates().map((template) => {
    const state = live.get(template.id) ?? {};
    const newest = newestOf(state);
    return {
      id: template.id,
      numeral: template.numeral,
      emailClass: template.emailClass,
      recipient: template.recipient,
      state:
        state.published !== undefined
          ? "published"
          : state.draft !== undefined
            ? "draft"
            : "default",
      pendingDraft: state.draft !== undefined,
      editable: template.body !== undefined,
      lastEditedAt: newest?.createdAt ?? null,
      lastEditedBy: newest?.editorUserId ?? null,
    };
  });
}

/** What the editor is handed: the default, the live rows, the history and one rendered sample. */
export interface EmailTemplateEditorView {
  readonly template: RegisteredEmailTemplate;
  readonly editable: boolean;
  /** Every `{{name}}` this template's body may carry — the chips. */
  readonly placeholders: readonly string[];
  /**
   * The body **as `content/email-bodies.md` writes it**, placeholders intact, or `null` for a
   * template whose body lives in code. Null is drawn as "this body is not editable here", never as
   * an empty textarea that a save would silently blank.
   */
  readonly defaultBody: string | null;
  readonly defaultSubject: string;
  readonly defaultPreheader: string;
  /** The default mail, rendered through the real band — the preview of "no override". */
  readonly defaultRender: SampleRender;
  readonly published?: EmailTemplateVersionSummary;
  readonly draft?: EmailTemplateVersionSummary;
  /** Every row for this template, newest first, retired included — the history. */
  readonly versions: readonly EmailTemplateVersionSummary[];
}

/**
 * One template as the editor draws it.
 *
 * `undefined` is "not an in-scope template" and the page turns it into `notFound()`. The history
 * read is the only query that can grow, so it is one statement and the page draws a bounded list.
 */
export async function readEmailTemplateEditor(
  templateId: string,
): Promise<EmailTemplateEditorView | undefined> {
  const template = memberFacingTemplate(templateId);
  if (template === undefined) return undefined;

  const versions = await listEmailTemplateVersions(templateId);
  const published = versions.find((version) => version.status === "published");
  const draft = versions.find((version) => version.status === "draft");
  const defaultRender = renderSampleEmail(template.id);

  return {
    template,
    editable: template.body !== undefined,
    placeholders: template.body?.placeholders ?? [],
    defaultBody: template.body === undefined ? null : bodySource(template.body),
    defaultSubject: defaultRender.subject,
    defaultPreheader: defaultRender.preheader,
    defaultRender,
    ...(published === undefined ? {} : { published }),
    ...(draft === undefined ? {} : { draft }),
    versions,
  };
}

/* ------------------------------------------------------------------ *
 * The preview
 * ------------------------------------------------------------------ */

/** What the live preview answers: the two bodies the real band composed, or why it refuses. */
export type EmailTemplatePreview =
  | {
      readonly ok: true;
      /** The subject and the plain text, and the HTML derived from the text. */
      readonly subject: string;
      readonly text: string;
      readonly html: string;
      /** False when the fields are byte-identical to the default — the screen says which it drew. */
      readonly overridden: boolean;
    }
  | { readonly ok: false; readonly problems: readonly OverrideProblem[] };

/**
 * Render the sample through the real band, with the admin's fields — **and refuse a leak**.
 *
 * The order matters: the text is rendered first and the Counterparty rule is then applied to the
 * *rendered* words, so a `{{template}}` whose title happens to say "card" is caught and a
 * `{{plan}}` placeholder cannot hide behind its braces (#1138 requirement 3: "The Counterparty
 * preview is the no-leak proof: it must fail the same checks as a Counterparty screen").
 *
 * Pure apart from the register: no database, no clock, so the client's keystroke and the test's
 * assertion see the same function.
 */
export function previewEmailTemplate(input: {
  readonly templateId: string;
  readonly override: EmailOverride;
}): EmailTemplatePreview {
  const template = memberFacingTemplate(input.templateId);
  if (template === undefined) {
    return { ok: false, problems: [{ code: "no-editable-body", detail: input.templateId }] };
  }
  if (template.body === undefined) {
    return { ok: false, problems: [{ code: "no-editable-body", detail: template.id }] };
  }

  let rendered: SampleRender;
  try {
    rendered = renderSampleEmail(template.id, input.override);
  } catch (error) {
    // A body that names a fact the sample does not carry — the render's own refusal, drawn as one.
    return {
      ok: false,
      problems: [{ code: "unknown-variable", detail: error instanceof Error ? error.message : "" }],
    };
  }

  const problems = overrideProblems(template, input.override, {
    subject: rendered.subject,
    preheader: rendered.preheader,
    text: rendered.text,
  });
  if (problems.length > 0) return { ok: false, problems };

  const overridden =
    input.override.body !== undefined ||
    input.override.subject !== undefined ||
    input.override.preheader !== undefined;

  return {
    ok: true,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    overridden,
  };
}

/* ------------------------------------------------------------------ *
 * The writes
 * ------------------------------------------------------------------ */

/** The override a save carries, already trimmed. */
function submittedOverride(input: {
  readonly subject: string;
  readonly preheader: string;
  readonly body: string;
}): EmailOverride {
  return {
    subject: input.subject.trim(),
    preheader: input.preheader.trim(),
    body: input.body.trim(),
  };
}

/**
 * Run one audited write.
 *
 * `act()` needs the target's row id **before** the mutation runs (the audit row is built after it,
 * but its target is an argument), and the id of a version is `<template>-v<next>`. So the number is
 * read up front and the mutation asserts the row it wrote carries that id: a concurrent save that
 * took the number makes this one refuse rather than write an audit row pointing at somebody else's
 * words. That is the only race here and it is a refusal, never a silent second publish.
 */
async function auditedWrite<T>(input: {
  readonly actorUserId: string;
  readonly action: AdminAction;
  readonly targetId: string;
  readonly mutate: (sql: EmailTemplateSql) => Promise<{ before: unknown; after: T }>;
}): Promise<ActResult<T>> {
  return act<T>({
    actorUserId: input.actorUserId,
    action: input.action,
    target: { table: "email_template_version", id: input.targetId },
    mutate: (sql) => input.mutate(sql as EmailTemplateSql),
  });
}

/**
 * Save a draft. Production mail is untouched — the published row is not in this statement's reach —
 * which is #1138 requirement 5 as a property of the write and not of the caller's care.
 */
export async function saveEmailTemplate(input: {
  readonly actorUserId: string;
  readonly templateId: string;
  readonly subject: string;
  readonly preheader: string;
  readonly body: string;
}): Promise<EmailTemplateOutcome> {
  const template = memberFacingTemplate(input.templateId);
  if (template === undefined) {
    return { ok: false, code: "no-such-template" };
  }
  if (template.body === undefined) {
    return { ok: false, code: "not-editable" };
  }

  const override = submittedOverride(input);
  const problems = overrideProblems(template, override);
  if (problems.length > 0) return { ok: false, code: "invalid-override", problems };

  const targetVersionId = emailTemplateVersionIdOf(
    template.id,
    await nextEmailTemplateVersion(POOLED_SQL, template.id),
  );

  try {
    await auditedWrite({
      actorUserId: input.actorUserId,
      action: "email-template.save",
      targetId: targetVersionId,
      mutate: async (sql) => {
        const inserted = await saveEmailTemplateDraft(sql, {
          templateId: template.id,
          subject: override.subject ?? "",
          preheader: override.preheader ?? "",
          body: override.body ?? "",
          editorUserId: input.actorUserId,
        });
        if (inserted === undefined || inserted.id !== targetVersionId) {
          throw new EmailTemplateRefused(
            "version-conflict",
            "another save took this version number — nothing was written",
          );
        }
        return {
          before: null,
          after: { id: inserted.id, subject: inserted.subject, body: inserted.body },
        };
      },
    });
    return { ok: true, templateId: template.id, versionId: targetVersionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/**
 * Publish the **stored draft**.
 *
 * The words are read inside the transaction, so a form left open cannot publish an unsaved edit —
 * the draft is the only candidate, and no draft is a refusal naming the fix rather than a silent
 * publish of the default.
 */
export async function publishEmailTemplate(input: {
  readonly actorUserId: string;
  readonly templateId: string;
}): Promise<EmailTemplateOutcome> {
  const template = memberFacingTemplate(input.templateId);
  if (template === undefined) return { ok: false, code: "no-such-template" };
  if (template.body === undefined) return { ok: false, code: "not-editable" };

  const versions = await listEmailTemplateVersions(template.id);
  const draft = versions.find((version) => version.status === "draft");
  if (draft === undefined) return { ok: false, code: "no-draft" };

  // The draft has already passed `checkOverride()` at save time; it is re-checked here because a
  // published row must satisfy the rule at the instant it becomes live, and the register may have
  // gained a placeholder since (a template whose body changed under a stored draft).
  const problems = overrideProblems(
    template,
    { subject: draft.subject, preheader: draft.preheader, body: draft.body },
    (() => {
      const rendered = renderSampleEmail(template.id, {
        subject: draft.subject,
        preheader: draft.preheader,
        body: draft.body,
      });
      return { subject: rendered.subject, preheader: rendered.preheader, text: rendered.text };
    })(),
  );
  if (problems.length > 0) return { ok: false, code: "invalid-override", problems };

  const targetVersionId = emailTemplateVersionIdOf(
    template.id,
    await nextEmailTemplateVersion(POOLED_SQL, template.id),
  );

  try {
    await auditedWrite({
      actorUserId: input.actorUserId,
      action: "email-template.publish",
      targetId: targetVersionId,
      mutate: async (sql) => {
        const inserted = await publishEmailTemplateVersion(sql, {
          templateId: template.id,
          subject: draft.subject,
          preheader: draft.preheader,
          body: draft.body,
          editorUserId: input.actorUserId,
        });
        if (inserted === undefined || inserted.id !== targetVersionId) {
          throw new EmailTemplateRefused(
            "version-conflict",
            "another write took this version number — nothing was published",
          );
        }
        return { before: { id: draft.id }, after: { id: inserted.id } };
      },
    });
    return { ok: true, templateId: template.id, versionId: targetVersionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/**
 * Drop the override: retire the draft and the published row and insert nothing.
 *
 * "The reset is itself a version" (#1138 requirement 6) is satisfied by the retired rows, which
 * keep their words, their actor and the instant they stopped being live — nothing is deleted, and
 * the history still answers "what did the last send say".
 */
export async function resetEmailTemplate(input: {
  readonly actorUserId: string;
  readonly templateId: string;
}): Promise<EmailTemplateOutcome> {
  const template = memberFacingTemplate(input.templateId);
  if (template === undefined) return { ok: false, code: "no-such-template" };

  const versions = await listEmailTemplateVersions(template.id);
  const live = versions.find(
    (version) => version.status === "published" || version.status === "draft",
  );
  if (live === undefined) return { ok: false, code: "nothing-to-reset" };

  try {
    await auditedWrite({
      actorUserId: input.actorUserId,
      action: "email-template.reset",
      targetId: live.id,
      mutate: async (sql) => {
        await resetEmailTemplateOverride(sql, { templateId: template.id });
        return {
          before: { id: live.id, status: live.status },
          after: { id: live.id, status: "retired" },
        };
      },
    });
    return { ok: true, templateId: template.id, versionId: live.id };
  } catch (error) {
    return refusalOf(error);
  }
}

/**
 * Send one template's **sample** mail to the signed-in admin's own address (#1138 requirement 4).
 *
 * Three things make this a test and not a send: the facts are `lib/email/samples.ts`'s (no member's
 * token, no live invite link — the link opens nothing), the band is handed `mode: "test"` so the
 * footer says so, and the address is the actor's own. It writes no row, so it is not an `act()`
 * action — the mail is the only side effect and it is the actor's own mailbox.
 *
 * The same refusal the save path applies runs first, on the **rendered** words, so a Counterparty
 * template cannot be test-mailed with a leak the save would have refused.
 */
export async function sendEmailTemplateTest(input: {
  readonly templateId: string;
  /** The signed-in admin's address, resolved from the session server-side. */
  readonly to: string;
  readonly override: EmailOverride;
  readonly fetchImpl?: typeof fetch;
}): Promise<
  | { readonly ok: true; readonly outcome: MailOutcome }
  | { readonly ok: false; readonly code: string; readonly problems?: readonly OverrideProblem[] }
> {
  const template = memberFacingTemplate(input.templateId);
  if (template === undefined) return { ok: false, code: "no-such-template" };
  if (template.body === undefined) return { ok: false, code: "not-editable" };

  let rendered: SampleRender;
  try {
    rendered = renderSampleEmail(template.id, input.override, { mode: "test" });
  } catch (error) {
    return {
      ok: false,
      code: "invalid-override",
      problems: [{ code: "unknown-variable", detail: error instanceof Error ? error.message : "" }],
    };
  }

  const problems = overrideProblems(template, input.override, {
    subject: rendered.subject,
    preheader: rendered.preheader,
    text: rendered.text,
  });
  if (problems.length > 0) return { ok: false, code: "invalid-override", problems };

  const outcome = await sendMail(
    {
      to: input.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    },
    { sender: "invite", ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }) },
  );
  return { ok: true, outcome };
}

/** `act()`'s refusal and this module's, as one outcome — an unknown failure is rethrown. */
function refusalOf(error: unknown): EmailTemplateOutcome {
  if (error instanceof EmailTemplateRefused) {
    return { ok: false, code: error.reason, problems: error.problems };
  }
  if (error instanceof ActRefused) {
    return { ok: false, code: error.reason };
  }
  throw error;
}
/**
 * The pool as `EmailTemplateSql`, for the one read a write makes **outside** its transaction: the
 * next version number that names the audit row's target. It is a read, never a mutation.
 */
const POOLED_SQL: EmailTemplateSql = {
  query: async <R = Record<string, unknown>>(text: string, values: readonly unknown[] = []) => ({
    rows: (await queryRows(text, values)) as R[],
  }),
};
