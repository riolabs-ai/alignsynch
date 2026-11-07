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
 * rewritten into the fields shape the flow templates share. The register is a directory, not a
 * house move.
 *
 * **The class is the column that decides the footer, so `renderTemplate()` forwards the one input
 * it needs.** Nine of the ten are transactional and carry no unsubscribe line. #9 is the marketing
 * one, and its unsubscribe URL is a per-recipient token — it cannot live in a fixture, so it is an
 * option on `renderTemplate()` and reaches the band unchanged. A caller that forgets it gets the
 * band's own throw ("a marketing mail needs an unsubscribe URL"), not a mail with no way out.
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
import { trialEndingDocument, type TrialEndingFacts } from "@/lib/email/templates/trial-ending";
import {
  membershipLapsedDocument,
  type MembershipLapsedFacts,
} from "@/lib/email/templates/membership-lapsed";
import {
  supportReplyDocument,
  supportReplySubject,
  type SupportReplyFacts,
} from "@/lib/email/templates/support-reply";
import {
  signupConfirmationDocument,
  type SignupConfirmationFacts,
} from "@/lib/email/templates/signup-confirmation";
import {
  purchaseConfirmationDocument,
  type PurchaseConfirmationFacts,
} from "@/lib/email/templates/purchase-confirmation";

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
 * #6 — the trial is ending, two days before `current_period_end`. Copy only: the clock that decides
 * *when* is a scheduler card, and `lib/relationship/trial.ts` already answers whether a trial is
 * running at an instant it is handed.
 */
export const trialEndingTemplate: EmailTemplate<TrialEndingFacts> = {
  id: "trial-ending",
  numeral: 6,
  emailClass: "transactional",
  subject: (facts) => trialEndingDocument(facts).subject,
  document: trialEndingDocument,
};

/** #7 — the membership lapsed: the words for `membershipOf()`'s read-only state. */
export const membershipLapsedTemplate: EmailTemplate<MembershipLapsedFacts> = {
  id: "membership-lapsed",
  numeral: 7,
  emailClass: "transactional",
  subject: (facts) => membershipLapsedDocument(facts).subject,
  document: membershipLapsedDocument,
};

/** #8 — the support reply, sent from the inbox on `lib/contact/reply.ts`'s transport. */
export const supportReplyTemplate: EmailTemplate<SupportReplyFacts> = {
  id: "support-reply",
  numeral: 8,
  emailClass: "transactional",
  subject: supportReplySubject,
  document: supportReplyDocument,
};

/**
 * #9 — the signup confirmation. **The one marketing template**: the band requires an unsubscribe
 * URL on it and `renderTemplate()` forwards the caller's, which is why this entry is the reason
 * that option exists.
 */
export const signupConfirmationTemplate: EmailTemplate<SignupConfirmationFacts> = {
  id: "signup-confirmation",
  numeral: 9,
  emailClass: "marketing",
  subject: (facts) => signupConfirmationDocument(facts).subject,
  document: signupConfirmationDocument,
};

/** #10 — the purchase confirmation: it announces the grant, and never re-sends a receipt. */
export const purchaseConfirmationTemplate: EmailTemplate<PurchaseConfirmationFacts> = {
  id: "purchase-confirmation",
  numeral: 10,
  emailClass: "transactional",
  subject: (facts) => purchaseConfirmationDocument(facts).subject,
  document: purchaseConfirmationDocument,
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
  | EmailTemplate<ReportReadyFacts>
  | EmailTemplate<TrialEndingFacts>
  | EmailTemplate<MembershipLapsedFacts>
  | EmailTemplate<SupportReplyFacts>
  | EmailTemplate<SignupConfirmationFacts>
  | EmailTemplate<PurchaseConfirmationFacts>;

export const EMAIL_TEMPLATES: readonly RegisteredEmailTemplate[] = [
  releaseNoteTemplate,
  invitationTemplate,
  reminderTemplate,
  joinedTemplate,
  reportReadyTemplate,
  trialEndingTemplate,
  membershipLapsedTemplate,
  supportReplyTemplate,
  signupConfirmationTemplate,
  purchaseConfirmationTemplate,
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
 *
 * `unsubscribeUrl` is the one input the class column cannot supply by itself — it is a
 * per-recipient token, so the marketing template (#9) needs it from its caller and the other nine
 * must not be handed one. Forwarding it is all this function does about it; the band's own throws
 * are what police both directions.
 */
export function renderTemplate<Facts>(
  template: EmailTemplate<Facts>,
  facts: Facts,
  options: {
    readonly origin?: string;
    readonly mode?: Parameters<typeof renderEmail>[1]["mode"];
    /** Required for a `marketing` template (the band throws without it), refused for the rest. */
    readonly unsubscribeUrl?: string;
  } = {},
): RenderedTemplate {
  const document = template.document(facts);
  const rendered = renderEmail(document, {
    emailClass: template.emailClass,
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.unsubscribeUrl === undefined ? {} : { unsubscribeUrl: options.unsubscribeUrl }),
  });
  return { subject: document.subject, ...rendered };
}

/** A template by its stable id, or `undefined` — the lookup a scheduler or a doc check uses. */
export function templateById(id: string): RegisteredEmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((template) => template.id === id);
}
