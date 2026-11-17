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
 * it needs.** Twelve of the thirteen are transactional and carry no unsubscribe line. #9 is the
 * marketing one, and its unsubscribe URL is a per-recipient token — it cannot live in a fixture, so
 * it is an option on `renderTemplate()` and reaches the band unchanged. A caller that forgets it
 * gets the band's own throw ("a marketing mail needs an unsubscribe URL"), not a mail with no way
 * out.
 *
 * **Numerals are identities, and a new template takes the next free one.** #12 and #13 (#1139) were
 * appended rather than inserted beside #7 where they read most naturally: 8–11 are cited by tests,
 * docstrings and operations docs, and renumbering them would edit the record of what a numeral
 * meant when it was written. The array stays in numeral order.
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
import type { EmailBodySpec } from "@/lib/email/body";
import type { EmailOverride } from "@/lib/email/override";
import {
  releaseNoteDocument,
  type ChangelogSection,
  type ReleaseNoteOptions,
} from "@/lib/email/release-note";
import {
  INVITATION_BODY,
  invitationDocument,
  invitationSubject,
  type InvitationFacts,
} from "@/lib/email/templates/invitation";
import {
  REMINDER_BODY,
  reminderDocument,
  type ReminderFacts,
} from "@/lib/email/templates/invitation-reminder";
import {
  JOINED_BODY,
  joinedDocument,
  joinedSubject,
  type JoinedFacts,
} from "@/lib/email/templates/counterparty-joined";
import {
  REPORT_READY_BODY,
  reportReadyDocument,
  type ReportReadyFacts,
} from "@/lib/email/templates/report-ready";
import {
  TRIAL_ENDING_BODY,
  trialEndingDocument,
  type TrialEndingFacts,
} from "@/lib/email/templates/trial-ending";
import {
  MEMBERSHIP_LAPSED_BODY,
  membershipLapsedDocument,
  type MembershipLapsedFacts,
} from "@/lib/email/templates/membership-lapsed";
import {
  TRIAL_ENDED_PAUSED_BODY,
  trialEndedPausedDocument,
  type TrialEndedPausedFacts,
} from "@/lib/email/templates/trial-ended-paused";
import {
  RELATIONSHIP_PAUSED_BODY,
  relationshipPausedDocument,
  type RelationshipPausedFacts,
} from "@/lib/email/templates/relationship-paused";
import {
  SUPPORT_REPLY_BODY,
  supportReplyDocument,
  supportReplySubject,
  type SupportReplyFacts,
} from "@/lib/email/templates/support-reply";
import {
  SIGNUP_CONFIRMATION_BODY,
  signupConfirmationDocument,
  type SignupConfirmationFacts,
} from "@/lib/email/templates/signup-confirmation";
import {
  PURCHASE_CONFIRMATION_BODY,
  purchaseConfirmationDocument,
  type PurchaseConfirmationFacts,
} from "@/lib/email/templates/purchase-confirmation";
import {
  relationshipExpiredDocument,
  relationshipExpiredSubject,
  type RelationshipExpiredFacts,
} from "@/lib/email/templates/relationship-expired";

/** One mail: its identity, its class, and the pure functions that build it. */
export interface EmailTemplate<Facts> {
  /** Stable id — the name a test, a doc or a future scheduler refers to. */
  readonly id: string;
  /** The spec's number (#548), so a reader can match this file to the table. */
  readonly numeral: number;
  /** `marketing` may carry an unsubscribe line; `transactional` may not. */
  readonly emailClass: EmailClass;
  /**
   * **Who reads this mail** — the column #1138's admin page lists, and the rule behind its one
   * hard guardrail: a template whose audience includes the Counterparty seat may never carry price,
   * trial, card, plan or extension words (`lib/email/override.ts::checkOverride`).
   *
   * It is a column here rather than a sentence in a comment because it is *checked*: the page
   * groups and labels by it, the save path refuses a leaking override by it, and the test that
   * `trial-ending`, `extra-week-*` and `purchase-confirmation` cannot reach the Counterparty is a
   * read of this field rather than a grep for a subject.
   */
  readonly recipient: EmailRecipient;
  /**
   * Where this template's body comes from: its section in `content/email-bodies.md`, and the
   * `{{…}}` facts it may say. **Omitted** means the body is already written in code and is not the
   * owner's to edit there — `scripts/gen-email-bodies.mjs` reports a section for a template that
   * omits it and a template that omits it with no section, so the omission is a listed decision
   * rather than a gap nobody noticed.
   */
  readonly body?: EmailBodySpec;
  readonly subject: (facts: Facts) => string;
  /**
   * The document. `body` is the admin's published (or draft) body text, when there is one — it
   * replaces the markdown body's blocks and leaves the template's own sentences alone, because
   * what an admin edits is `content/email-bodies.md`'s paragraph and not the product behaviour
   * written around it (#1138 requirement 8: there is no separate HTML field and no second body).
   * A template with no `body` spec ignores the argument; the save path refuses to give it one.
   *
   * `options` is the register's second axis and it is **optional for every entry, because only
   * one template reads it**: #1 draws a figure per surface that really has an asset under
   * `public/`, so its builder takes the asset lookup (`ReleaseNoteOptions`). The other twelve
   * draw no asset and ignore it — which is why it lives here as one shared optional parameter
   * rather than as a cast on #1 or a fifth field that a builder could not be handed. The type is
   * "what any registered builder may be handed", so `renderTemplate()` keeps forwarding the body
   * it has and a caller that needs the note's figures passes them where they are read.
   */
  readonly document: (facts: Facts, body?: string, options?: ReleaseNoteOptions) => EmailDocument;
}

/**
 * Who a mail is addressed to. Five values, and each is a different promise:
 *
 *   counterparty  someone who is not a member yet, or is the other seat — **no price, no trial, no
 *                 card, no plan, no extension, no `$`**, ever (see `lib/email/override.ts`)
 *   initiator     the person who started the relationship, signed in — may read money words
 *   both          one body sent to either seat, so the Counterparty's rule binds it
 *   member        a signed-in account holder, neither seat in particular
 *   subscriber    a news-list address — the marketing class, and no relationship at all
 *   operator      ours, not a member's: the stakeholder release note, and `/admin/broadcast`
 *
 * `operator` is the one value #1138's page does not list: "the stakeholder release note stays out
 * of this page", so the page filters on it rather than keeping a second list of what to hide.
 */
export type EmailRecipient =
  | "counterparty"
  | "initiator"
  | "both"
  | "member"
  | "subscriber"
  | "operator";

/** Every recipient value, so a test can walk them and a page can name one. */
export const EMAIL_RECIPIENTS: readonly EmailRecipient[] = [
  "counterparty",
  "initiator",
  "both",
  "member",
  "subscriber",
  "operator",
];

/**
 * Does this mail reach the Counterparty seat? The guardrail's predicate, in one place.
 *
 * `both` is the subtle one and it is deliberately included: a notice written once for either seat
 * is a notice that reaches the Counterparty, so it carries the same silence about money. The
 * rewrite #1138 open-question 2 asks about (`trial-ended-paused` + a split `relationship-paused`)
 * exists precisely because the current both-seats lapse letter does not obey this.
 */
export function reachesCounterparty(recipient: EmailRecipient): boolean {
  return recipient === "counterparty" || recipient === "both";
}

/**
 * #1 — the stakeholder release note, registered from its own module.
 *
 * The second argument is the admin's override body, which #1 never takes (it has no `body` spec
 * and `recipient: "operator"` keeps it off the templates page), so the registered `document` maps
 * the register's third argument — the asset lookup (#1169) — straight into
 * `releaseNoteDocument()`'s second. That is the whole difference between the two signatures, and
 * it is expressed once, here, rather than by moving the builder's options or casting the entry.
 */
export const releaseNoteTemplate: EmailTemplate<ChangelogSection> = {
  id: "stakeholder-release-note",
  numeral: 1,
  emailClass: "transactional",
  recipient: "operator",
  subject: (section) => releaseNoteDocument(section).subject,
  document: (section, _body, options) => releaseNoteDocument(section, options),
};

/** #2 — the counterparty invitation, minted with the invite on create (and on re-invite). */
export const invitationTemplate: EmailTemplate<InvitationFacts> = {
  id: "counterparty-invitation",
  numeral: 2,
  emailClass: "transactional",
  recipient: "counterparty",
  body: INVITATION_BODY,
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
  recipient: "counterparty",
  body: REMINDER_BODY,
  subject: (facts) => reminderDocument(facts).subject,
  document: reminderDocument,
};

/** #4 — the counterparty joined, sent to the Initiator when the claim commits. */
export const joinedTemplate: EmailTemplate<JoinedFacts> = {
  id: "counterparty-joined",
  numeral: 4,
  emailClass: "transactional",
  recipient: "initiator",
  body: JOINED_BODY,
  subject: joinedSubject,
  document: joinedDocument,
};

/** #5 — the Gap report is ready, sent on the acceptance that completes the session. */
export const reportReadyTemplate: EmailTemplate<ReportReadyFacts> = {
  id: "gap-report-ready",
  numeral: 5,
  emailClass: "transactional",
  recipient: "both",
  body: REPORT_READY_BODY,
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
  recipient: "initiator",
  body: TRIAL_ENDING_BODY,
  subject: (facts) => trialEndingDocument(facts).subject,
  document: trialEndingDocument,
};

/** #7 — the membership lapsed: the words for `membershipOf()`'s read-only state, Initiator only. */
export const membershipLapsedTemplate: EmailTemplate<MembershipLapsedFacts> = {
  id: "membership-lapsed",
  numeral: 7,
  emailClass: "transactional",
  recipient: "both",
  body: MEMBERSHIP_LAPSED_BODY,
  subject: (facts) => membershipLapsedDocument(facts).subject,
  document: membershipLapsedDocument,
};

/** #8 — the support reply, sent from the inbox on `lib/contact/reply.ts`'s transport. */
export const supportReplyTemplate: EmailTemplate<SupportReplyFacts> = {
  id: "support-reply",
  numeral: 8,
  emailClass: "transactional",
  recipient: "member",
  body: SUPPORT_REPLY_BODY,
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
  recipient: "subscriber",
  body: SIGNUP_CONFIRMATION_BODY,
  subject: (facts) => signupConfirmationDocument(facts).subject,
  document: signupConfirmationDocument,
};

/** #10 — the purchase confirmation: it announces the grant, and never re-sends a receipt. */
export const purchaseConfirmationTemplate: EmailTemplate<PurchaseConfirmationFacts> = {
  id: "purchase-confirmation",
  numeral: 10,
  emailClass: "transactional",
  recipient: "initiator",
  body: PURCHASE_CONFIRMATION_BODY,
  subject: (facts) => purchaseConfirmationDocument(facts).subject,
  document: purchaseConfirmationDocument,
};

/**
 * #11 — the unpaid relationship expired. Both seats are told, and the counterparty's body carries
 * no figure and no fee: `expire` is a job whose notice cannot be the fact (the state is already
 * terminal and stored), so this template is a courtesy rather than a stamp's evidence.
 *
 * It was #12 until #1010 deleted the day-3 / day-10 fee reminder that sat before it: a reminder to
 * pay a fee no longer taken is a letter nobody should receive, so the register is now eleven
 * templates and this one keeps the sequence contiguous.
 */
export const relationshipExpiredTemplate: EmailTemplate<RelationshipExpiredFacts> = {
  id: "relationship-expired",
  numeral: 11,
  emailClass: "transactional",
  recipient: "both",
  subject: relationshipExpiredSubject,
  document: relationshipExpiredDocument,
};

/**
 * #12 — the trial ended and Align is paused, to the Initiator (#1139).
 *
 * The trial's lapse, and only that one: `lib/billing/notices.ts` chooses it from
 * `relationship.lapse_reason`, so a failed payment still gets #7 and its "resume it" sentence rather
 * than a free week the account cannot take.
 */
export const trialEndedPausedTemplate: EmailTemplate<TrialEndedPausedFacts> = {
  id: "trial-ended-paused",
  numeral: 12,
  emailClass: "transactional",
  // The Initiator's mail, and only theirs: it offers the free week and the plan's address, so the
  // Counterparty's rule in `lib/email/override.ts::checkOverride` must bind it (#1139).
  recipient: "initiator",
  body: TRIAL_ENDED_PAUSED_BODY,
  subject: (facts) => trialEndedPausedDocument(facts).subject,
  document: trialEndedPausedDocument,
};

/**
 * #13 — the relationship is paused, to the Counterparty (#1139).
 *
 * The seat that cannot act, told the one thing it needs: Align is paused, nothing was deleted, and
 * they will hear when it resumes. No price, plan, trial, card or extension word is legal here —
 * `tests/counterparty-no-leak.test.ts` sweeps this template for exactly that vocabulary.
 */
export const relationshipPausedTemplate: EmailTemplate<RelationshipPausedFacts> = {
  id: "relationship-paused",
  numeral: 13,
  emailClass: "transactional",
  // The Counterparty's own sentence (#1139) — the one seat that cannot act, and the seat the money
  // rule exists for.
  recipient: "counterparty",
  body: RELATIONSHIP_PAUSED_BODY,
  subject: (facts) => relationshipPausedDocument(facts).subject,
  document: relationshipPausedDocument,
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
  | EmailTemplate<PurchaseConfirmationFacts>
  | EmailTemplate<RelationshipExpiredFacts>
  | EmailTemplate<TrialEndedPausedFacts>
  | EmailTemplate<RelationshipPausedFacts>;

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
  relationshipExpiredTemplate,
  trialEndedPausedTemplate,
  relationshipPausedTemplate,
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
    /**
     * **The admin's override, when one is published** (#1138 requirement 9). Resolved by the
     * caller — `lib/email/send.ts::renderTemplateForSend()` is the one implementation — so this
     * function stays pure and importable from a client component (the editor's live preview).
     *
     * A field the override does not name is the code default; an override with no fields is the
     * same mail the default renders. The body replaces `content/email-bodies.md`'s blocks and
     * leaves the template's own sentences alone — an admin edits the paragraph, never the product
     * behaviour written around it.
     */
    readonly override?: EmailOverride;
  } = {},
): RenderedTemplate {
  const document = template.document(facts, options.override?.body);
  const rendered = renderEmail(
    options.override === undefined
      ? document
      : {
          subject: options.override.subject ?? document.subject,
          preheader: options.override.preheader ?? document.preheader,
          blocks: document.blocks,
        },
    {
      emailClass: template.emailClass,
      ...(options.origin === undefined ? {} : { origin: options.origin }),
      ...(options.mode === undefined ? {} : { mode: options.mode }),
      ...(options.unsubscribeUrl === undefined ? {} : { unsubscribeUrl: options.unsubscribeUrl }),
    },
  );
  return { subject: options.override?.subject ?? document.subject, ...rendered };
}

/** A template by its stable id, or `undefined` — the lookup a scheduler or a doc check uses. */
export function templateById(id: string): RegisteredEmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((template) => template.id === id);
}
