/**
 * An admin's override of one transactional mail, and the two rules that decide whether it may be
 * published (#1138).
 *
 * **This module is pure, and it is imported by a client component.** The editor's live preview and
 * its refusal messages are computed from these functions in the browser, so nothing here may read
 * a file, a clock or a database. The published override is *resolved* elsewhere
 * (`lib/email/send.ts` on the server, `lib/db/email-templates.ts` for the read) and arrives as a
 * value; this module only says whether a value is allowed to be a mail.
 *
 * **The two rules #1138 states, and why they are here rather than in the action:**
 *
 *   1. **An unknown `{{variable}}` blocks the save** (requirement 2). A variable the template's
 *      `body.placeholders` does not list would render as `{{thing}}` in a mailbox, and
 *      `lib/email/body.ts::bodyText()` throws at the render rather than printing it — but a throw
 *      on the send path is a mail nobody got. So the check happens before the write, and
 *      `bodyText()` stays the second line of defence it already was.
 *   2. **A Counterparty-recipient mail may not say price, trial, card, plan, extension or `$`**
 *      (guardrail: "Save, preview and a gate test all refuse them"). This is the one rule with a
 *      product reason behind it rather than a syntax reason: #1119's decision is that the
 *      Counterparty never learns what the Initiator pays. The word list is exactly the issue's
 *      list plus the currency sign — no synonym hunting, because a rule that guesses at words a
 *      human did not name is a rule that refuses copy the owner approved.
 *
 * `reachesCounterparty()` from the register is the audience predicate, so `both` is covered: a
 * notice written once for either seat reaches the Counterparty and is bound by the same silence.
 *
 * **What "refused" means for the preview.** `overrideProblems()` runs on the *rendered* fields —
 * the override when there is one, the code default otherwise — with the sample facts already
 * substituted by the caller. So the Counterparty preview of a default that leaks is refused the
 * same way an edited body is: the check cannot be satisfied by an admin who never touched the
 * field. That is deliberate, and it is how the current both-seats lapse letter's "until a plan is
 * active again" shows up as a finding instead of as a mail (#1138 open question 2 owns the
 * rewrite; this module only refuses to pretend the words are fine).
 */
import type { EmailRecipient } from "@/lib/email/templates/index";
import { reachesCounterparty } from "@/lib/email/templates/index";

/**
 * The three editable fields, and nothing else. #1138 requirement 8: plain text is canonical, there
 * is no separate HTML field, and the band owns the footer — so an override can never carry a
 * footer, an unsubscribe line or markup.
 */
export interface EmailOverride {
  readonly subject?: string;
  readonly preheader?: string;
  readonly body?: string;
}

/** Why an override was refused. Codes, so a screen draws a sentence and a test asserts a reason. */
export const OVERRIDE_REFUSALS = [
  /** The template keeps its body in code (or parses it from `CHANGELOG.md`) — nothing to edit. */
  "no-editable-body",
  /** A field arrived with only whitespace in it. */
  "empty-subject",
  "empty-body",
  /** A `{{name}}` the template's `placeholders` does not hold. */
  "unknown-variable",
  /** A Counterparty-recipient mail carrying price / trial / card / plan / extension / `$`. */
  "counterparty-leak",
] as const;

export type OverrideRefusal = (typeof OVERRIDE_REFUSALS)[number];

/**
 * One problem, with the detail a screen needs: which variable, or which word.
 *
 * `code` is what a test asserts and what a refusal sentence is looked up by; `detail` is the
 * `card` or the `{{plan}}` a person needs to fix it. A refusal that says only "refused" makes the
 * admin guess, and guessing at a mail body is how a wrong word ships.
 */
export interface OverrideProblem {
  readonly code: OverrideRefusal;
  readonly detail?: string;
}

/**
 * The words a Counterparty-recipient mail may not carry. The issue's five, exactly, plus the
 * currency sign — "no price / trial / card / plan / extension variables, and no such words".
 *
 * The patterns are word-bounded and case-insensitive and carry the plural where English has one
 * (`cards`, `plans`), because the rule is about the reader's understanding and not about spelling.
 * They are **not** stemmed: "planning" is not "plan", and a check that refuses it would be
 * refusing a sentence about planning the work.
 */
const COUNTERPARTY_FORBIDDEN: readonly RegExp[] = [
  /\btrials?\b/i,
  /\bprices?\b/i,
  /\bpricing\b/i,
  /\bcards?\b/i,
  /\bplans?\b/i,
  /\bextensions?\b/i,
  /\$/,
];

/** The forbidden words a string carries, in the order they appear. Empty is "nothing to refuse". */
export function leakWords(text: string): string[] {
  const found: string[] = [];
  for (const pattern of COUNTERPARTY_FORBIDDEN) {
    const match = pattern.exec(text);
    if (match !== null) found.push(match[0]);
  }
  return found;
}

/** Every `{{name}}` a string names, deduplicated and in the order written. */
export function placeholderNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)) {
    const name = match[1];
    if (name !== undefined && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The fields an override carries that are **not blank** — the storage-facing question "is this row
 * an override at all".
 *
 * Used by `overrideOf()` only. The save path's question is the opposite one and lives in
 * `overrideProblems()`: a field that arrived and is blank is a *refusal*, because an admin who
 * cleared the body meant to send no words and must be told, not quietly handed the default.
 */
function presentFields(override: EmailOverride): readonly (keyof EmailOverride)[] {
  const present: (keyof EmailOverride)[] = [];
  for (const field of ["subject", "preheader", "body"] as const) {
    const value = override[field];
    if (value !== undefined && value.trim() !== "") present.push(field);
  }
  return present;
}

/** The fields that were **submitted**, blank or not — what the refusal check walks. */
function submittedFields(override: EmailOverride): readonly (keyof EmailOverride)[] {
  return (["subject", "preheader", "body"] as const).filter(
    (field) => override[field] !== undefined,
  );
}

/** What a check needs from a template: its audience and its editable body spec. */
export interface OverrideSubject {
  readonly id: string;
  readonly recipient: EmailRecipient;
  readonly body?: { readonly placeholders: readonly string[] };
}

/**
 * Every problem with this override, in one pass. An empty array is "publishable".
 *
 * The order is the order a person fixes them: "there is nothing to edit here" first, then the
 * blank fields, then the variables, then the audience rule. A caller that wants one sentence takes
 * `problems[0]`.
 *
 * `rendered` is the optional text the audience rule is checked against. The save path passes
 * nothing and gets the rule applied to `subject`/`preheader`/`body` as typed (with `{{variables}}`
 * still in them, which is the right subject: a variable *named* `plan` is a leak in the source).
 * The preview passes the filled text, so the rule sees the subject including the plan name — which
 * is the leak a source-only check would miss.
 */
export function overrideProblems(
  template: OverrideSubject,
  override: EmailOverride,
  rendered?: { readonly subject?: string; readonly preheader?: string; readonly text?: string },
): OverrideProblem[] {
  const problems: OverrideProblem[] = [];
  const present = submittedFields(override);

  if (present.length === 0) return problems;

  if (template.body === undefined) {
    return [{ code: "no-editable-body", detail: template.id }];
  }

  if (override.subject !== undefined && override.subject.trim() === "") {
    problems.push({ code: "empty-subject" });
  }
  if (override.body !== undefined && override.body.trim() === "") {
    problems.push({ code: "empty-body" });
  }

  for (const field of present) {
    const value = override[field] ?? "";
    for (const name of placeholderNames(value)) {
      if (!template.body.placeholders.includes(name)) {
        problems.push({ code: "unknown-variable", detail: `{{${name}}}` });
      }
    }
  }

  if (reachesCounterparty(template.recipient)) {
    const fields = rendered ?? {
      subject: override.subject,
      preheader: override.preheader,
      text: override.body,
    };
    const haystack = [fields.subject, fields.preheader, fields.text]
      .filter((value): value is string => value !== undefined)
      .join("\n");
    for (const word of leakWords(haystack)) {
      problems.push({ code: "counterparty-leak", detail: word });
    }
  }

  return problems;
}

/** Is this override publishable? The boolean form, for a caller that only needs the answer. */
export function isPublishableOverride(
  template: OverrideSubject,
  override: EmailOverride,
  rendered?: { readonly subject?: string; readonly preheader?: string; readonly text?: string },
): boolean {
  return overrideProblems(template, override, rendered).length === 0;
}

/**
 * The override a set of stored fields represents, or `undefined` when it is the default.
 *
 * "The default" is the absence of every field, not a body equal to the markdown: an override that
 * happens to match today's default is still an override, and it must stop matching the moment the
 * owner edits `content/email-bodies.md` — otherwise the page would quietly pin copy nobody chose.
 */
export function overrideOf(stored: {
  readonly subject?: string | null;
  readonly preheader?: string | null;
  readonly body?: string | null;
}): EmailOverride | undefined {
  const override: { subject?: string; preheader?: string; body?: string } = {};
  if (typeof stored.subject === "string" && stored.subject !== "")
    override.subject = stored.subject;
  if (typeof stored.preheader === "string" && stored.preheader !== "")
    override.preheader = stored.preheader;
  if (typeof stored.body === "string" && stored.body !== "") override.body = stored.body;
  return presentFields(override).length === 0 ? undefined : override;
}
