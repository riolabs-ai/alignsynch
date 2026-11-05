/**
 * The template register (#548) — every mail the product sends, in one list, beside template #1.
 *
 * **Why a register and not five loose functions.** The band (`lib/email/band.ts`) is one shell and
 * the class rule is per template, so "which class is this mail" has to be answerable without
 * reading each sender. Here it is a column: every entry names its number, its class and the two
 * functions a caller needs (`subject`, `document`), and `renderTemplate()` is the one place a
 * template is turned into the two bodies. A sender that composes its own `EmailDocument` and
 * forgets `emailClass` fails to typecheck rather than mailing a transactional notice with (or
 * without) the wrong footer.
 *
 * **#1 is not moved.** The stakeholder release note is `lib/email/release-note.ts` and its builder
 * parses `CHANGELOG.md`; it is registered here through `releaseNoteDocument()` rather than
 * rewritten into the fields shape the four flow templates share. The register is a directory, not
 * a house move.
 *
 * **Text first holds for every entry by construction.** Each `document()` returns blocks; the
 * only way to get bodies is `renderTemplate()`, which composes the text and derives the HTML from
 * it (`renderEmail`). A caller cannot ask a template for HTML.
 *
 * **No template names a brand.** Subjects and bodies use the facts they are handed; the shell's
 * footer and lockup are the band's, from `data/brand.ts`. Both brands therefore render, and the
 * two-brand gate builds both.
 */
import type { EmailClass, EmailDocument, RenderedEmail } from "@/lib/email/band";
import { renderEmail } from "@/lib/email/band";
import { releaseNoteDocument, type ChangelogSection } from "@/lib/email/release-note";
import {
  invitationDocument,
  invitationSubject,
  type InvitationFacts,
} from "@/lib/email/templates/invitation";
import { reminderDocument, type ReminderFacts } from "@/lib/email/templates/invitation-reminder";
import {
  joinedDocument,
  joinedSubject,
  type JoinedFacts,
} from "@/lib/email/templates/counterparty-joined";
import { reportReadyDocument, type ReportReadyFacts } from "@/lib/email/templates/report-ready";

/** One mail: its identity, its class, and the pure functions that build it. */
export interface EmailTemplate<Facts> {
  /** Stable id — the name a test, a doc or a future scheduler refers to. */
  readonly id: string;
  /** The spec's number (#548), so a reader can match this file to the table. */
  readonly numeral: number;
  /** `marketing` may carry an unsubscribe line; `transactional` may not. */
  readonly emailClass: EmailClass;
  readonly subject: (facts: Facts) => string;
  readonly document: (facts: Facts) => EmailDocument;
}

/** #1 — the stakeholder release note, registered from its own module. */
export const releaseNoteTemplate: EmailTemplate<ChangelogSection> = {
  id: "stakeholder-release-note",
  numeral: 1,
  emailClass: "transactional",
  subject: (section) => releaseNoteDocument(section).subject,
  document: releaseNoteDocument,
};

/** #2 — the counterparty invitation, minted with the invite on create (and on re-invite). */
export const invitationTemplate: EmailTemplate<InvitationFacts> = {
  id: "counterparty-invitation",
  numeral: 2,
  emailClass: "transactional",
  subject: invitationSubject,
  document: invitationDocument,
};

/**
 * #3 — the invitation reminder, 48 h before `expires_at`. Copy and the due-window predicate only:
 * the scheduler that calls it is its own card (#548), and this register adds no clock.
 */
export const reminderTemplate: EmailTemplate<ReminderFacts> = {
  id: "invitation-reminder",
  numeral: 3,
  emailClass: "transactional",
  subject: (facts) => reminderDocument(facts).subject,
  document: reminderDocument,
};

/** #4 — the counterparty joined, sent to the Initiator when the claim commits. */
export const joinedTemplate: EmailTemplate<JoinedFacts> = {
  id: "counterparty-joined",
  numeral: 4,
  emailClass: "transactional",
  subject: joinedSubject,
  document: joinedDocument,
};

/** #5 — the Gap report is ready, sent on the acceptance that completes the session. */
export const reportReadyTemplate: EmailTemplate<ReportReadyFacts> = {
  id: "gap-report-ready",
  numeral: 5,
  emailClass: "transactional",
  subject: (facts) => reportReadyDocument(facts).subject,
  document: reportReadyDocument,
};

/**
 * Every template, in the spec's order. The union is written out so `EMAIL_TEMPLATES` stays a
 * readable list whose entries each keep their own fact type; a bare `EmailTemplate<unknown>` would
 * force every `document()` to accept a shape it does not use.
 */
export type RegisteredEmailTemplate =
  | EmailTemplate<ChangelogSection>
  | EmailTemplate<InvitationFacts>
  | EmailTemplate<ReminderFacts>
  | EmailTemplate<JoinedFacts>
  | EmailTemplate<ReportReadyFacts>;

export const EMAIL_TEMPLATES: readonly RegisteredEmailTemplate[] = [
  releaseNoteTemplate,
  invitationTemplate,
  reminderTemplate,
  joinedTemplate,
  reportReadyTemplate,
];

/** What a caller gets back: the document it was built from, and the two bodies. */
export interface RenderedTemplate extends RenderedEmail {
  readonly subject: string;
}

/**
 * Build one template's document, then render it through the band.
 *
 * The class is read from the template, never passed by the caller: a sender cannot accidentally
 * render a transactional notice as marketing, and `composeText()` still refuses an unsubscribe
 * URL on either side of the rule.
 */
export function renderTemplate<Facts>(
  template: EmailTemplate<Facts>,
  facts: Facts,
  options: {
    readonly origin?: string;
    readonly mode?: Parameters<typeof renderEmail>[1]["mode"];
  } = {},
): RenderedTemplate {
  const document = template.document(facts);
  const rendered = renderEmail(document, {
    emailClass: template.emailClass,
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
  });
  return { subject: document.subject, ...rendered };
}

/** A template by its stable id, or `undefined` — the lookup a scheduler or a doc check uses. */
export function templateById(id: string): RegisteredEmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((template) => template.id === id);
}
