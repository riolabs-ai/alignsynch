/**
 * Sample facts, one set per registered template (#1138 requirement 3) — what an admin previews and
 * what a test send carries.
 *
 * **Why this is not a fixture under `data/`.** A preview is not product content: it is one set of
 * plausible values per template, used to draw a screen and to prove a mail renders. `data/` holds
 * what the product says; this holds what a form is tested with, and `lib/` is where the rest of the
 * mail plumbing lives. It reads no clock and no file, so the two callers — the editor's live
 * preview and the test send — render byte-identical text for the same input.
 *
 * **No real token, ever** (requirement 4). Every `link` here is `…/invitation/sample-token` or a
 * named screen: nothing mints an invitation, reads `session_invite`, or reaches Neon Auth, so the
 * test send cannot become a working link. A test asserts that no sample value is a live-looking
 * token — the sample is a sample by construction, not by care.
 *
 * **Fixed instants, not `new Date()`.** A mail's date is rendered from the instant the record
 * stores, and a sample that read the clock would make the preview change between two requests and
 * a snapshot impossible. These are calendar constants; `formatCalendarDate` in the templates turns
 * them into `YYYY-MM-DD` exactly as it does a real row.
 *
 * The names are the ones this tree's own documents and tests already use for a two-party example
 * (Robin and Elena), so a preview reads as the product's example rather than as another cast.
 */
import type { EmailOverride } from "@/lib/email/override";
import type { MailKeyMode } from "@/lib/email/key-mode";
import type { RelationshipExpiredFacts } from "@/lib/email/templates/relationship-expired";
import type { ReminderFacts } from "@/lib/email/templates/invitation-reminder";
import type { JoinedFacts } from "@/lib/email/templates/counterparty-joined";
import type { ReportReadyFacts } from "@/lib/email/templates/report-ready";
import type { TrialEndingFacts } from "@/lib/email/templates/trial-ending";
import type { MembershipLapsedFacts } from "@/lib/email/templates/membership-lapsed";
import type { SupportReplyFacts } from "@/lib/email/templates/support-reply";
import type { SignupConfirmationFacts } from "@/lib/email/templates/signup-confirmation";
import type { PurchaseConfirmationFacts } from "@/lib/email/templates/purchase-confirmation";
import type { InvitationFacts } from "@/lib/email/templates/invitation";
import {
  type EmailTemplate,
  type RegisteredEmailTemplate,
  renderTemplate,
  templateById,
  type RenderedTemplate,
} from "@/lib/email/templates/index";

/** The example names, in one place, so a preview and a test cannot disagree about the cast. */
export const SAMPLE_NAMES = {
  initiator: "Robin Vale",
  counterparty: "Elena Marsh",
  template: "How We Make Decisions",
  /** The account's plans screen — a named route, not a token. */
  plansLink: "https://app.alignsynch.example/plans",
  /** A relationship screen by id. */
  relationshipLink: "https://app.alignsynch.example/relationships/sample-relationship",
  /** An invitation link that mints nothing: the path a real one takes, with a sample value. */
  invitationLink: "https://app.alignsynch.example/invitation/sample-token",
  /**
   * The marketing template's way out, for the *preview only*. The band refuses a marketing mail
   * without one (that refusal is the point — a marketing mail always carries its way out), so the
   * sample supplies a value that opens nothing. No real send ever uses it: `lib/news/message.ts`
   * passes the per-recipient token it mints.
   */
  unsubscribeLink: "https://app.alignsynch.example/news/unsubscribe/sample-token",
  address: "elena.marsh@example.invalid",
  subject: "Which Friday works for the session",
  plan: "Together",
} as const;

/** The two instants the samples use. Fixed, so a preview is the same on every request. */
const SAMPLE_TRIAL_ENDS_AT = new Date("2026-12-08T12:00:00.000Z");
const SAMPLE_EXPIRES_AT = new Date("2026-12-01T12:00:00.000Z");
const SAMPLE_ENDED_AT = new Date("2026-11-30T12:00:00.000Z");
const SAMPLE_RECEIVED_AT = new Date("2026-11-20T09:30:00.000Z");

/**
 * One set of facts per register id. The key is the register's own `id`, so the pairing is the id
 * and not a second table that could disagree with it — `tests/admin-email-templates.test.ts`
 * asserts every non-operator template has an entry here, which is what keeps this map complete as
 * the register grows.
 */
const SAMPLE_FACTS: Readonly<Record<string, unknown>> = {
  "counterparty-invitation": {
    inviter: SAMPLE_NAMES.initiator,
    counterparty: SAMPLE_NAMES.counterparty,
    template: SAMPLE_NAMES.template,
    link: SAMPLE_NAMES.invitationLink,
  } satisfies InvitationFacts,
  "invitation-reminder": {
    inviter: SAMPLE_NAMES.initiator,
    template: SAMPLE_NAMES.template,
    link: SAMPLE_NAMES.invitationLink,
    expiresAt: SAMPLE_EXPIRES_AT,
  } satisfies ReminderFacts,
  "counterparty-joined": {
    joiner: SAMPLE_NAMES.counterparty,
    inviter: SAMPLE_NAMES.initiator,
    template: SAMPLE_NAMES.template,
    link: SAMPLE_NAMES.relationshipLink,
  } satisfies JoinedFacts,
  "gap-report-ready": {
    recipient: SAMPLE_NAMES.initiator,
    other: SAMPLE_NAMES.counterparty,
    template: SAMPLE_NAMES.template,
    link: SAMPLE_NAMES.relationshipLink,
  } satisfies ReportReadyFacts,
  "trial-ending": {
    recipient: SAMPLE_NAMES.initiator,
    trialEndsAt: SAMPLE_TRIAL_ENDS_AT,
    link: SAMPLE_NAMES.plansLink,
  } satisfies TrialEndingFacts,
  "membership-lapsed": {
    recipient: SAMPLE_NAMES.initiator,
    template: SAMPLE_NAMES.template,
    endedAt: SAMPLE_ENDED_AT,
    link: SAMPLE_NAMES.relationshipLink,
  } satisfies MembershipLapsedFacts,
  "support-reply": {
    recipient: SAMPLE_NAMES.counterparty,
    subject: SAMPLE_NAMES.subject,
    receivedAt: SAMPLE_RECEIVED_AT,
  } satisfies SupportReplyFacts,
  "signup-confirmation": { address: SAMPLE_NAMES.address } satisfies SignupConfirmationFacts,
  "purchase-confirmation": {
    recipient: SAMPLE_NAMES.initiator,
    plan: SAMPLE_NAMES.plan,
    link: SAMPLE_NAMES.plansLink,
  } satisfies PurchaseConfirmationFacts,
  // Two bodies, one per seat; the payer's is the one that carries a figure, so it is the one a
  // preview shows. Nothing is editable on this template — the register holds no `body` spec for it.
  "relationship-expired": {
    recipient: "payer",
    name: SAMPLE_NAMES.initiator,
    template: SAMPLE_NAMES.template,
    expiredAt: SAMPLE_ENDED_AT,
    link: SAMPLE_NAMES.relationshipLink,
  } satisfies RelationshipExpiredFacts,
};

/** The sample facts for one register id, or `undefined` — the honest answer for an unknown id. */
export function sampleFactsOf(templateId: string): unknown {
  return SAMPLE_FACTS[templateId];
}

/** What the preview and the test send hand back: the two bodies the band composed, and the subject. */
export interface SampleRender extends RenderedTemplate {
  readonly templateId: string;
  /**
   * The preview line a client shows beside the subject. It is in the *document* rather than in the
   * band's output (`renderEmail` answers text and HTML), so it is read from the document this
   * function builds — the same one `renderTemplate()` builds and hands the band.
   */
  readonly preheader: string;
}

/**
 * Render one template's sample mail, with the admin's override when there is one.
 *
 * The cast is the one place the map's `unknown` meets the register's generic: `templateById()`
 * returns a union of `EmailTemplate<Facts>` and the facts arrive as `unknown`, so the call is made
 * through `EmailTemplate<unknown>` — which is exactly what the map promises, one set of facts per
 * id. A missing pair throws rather than rendering a mail with `undefined` in it: the panel that
 * would draw it is a defect in this file, not a state of the product.
 *
 * `mode: "test"` is what **Send Test** passes (#1138 requirement 4): the band's own footer then
 * says the mail is a test, which is the marking — not a subject prefix this file would invent.
 */
export function renderSampleEmail(
  templateId: string,
  override?: EmailOverride,
  options: { readonly mode?: MailKeyMode } = {},
): SampleRender {
  const template = templateById(templateId);
  if (template === undefined) {
    throw new Error(`renderSampleEmail: "${templateId}" is not a registered template`);
  }
  const facts = SAMPLE_FACTS[templateId];
  if (facts === undefined) {
    throw new Error(`renderSampleEmail: "${templateId}" has no sample facts`);
  }
  const typed = template as EmailTemplate<unknown>;
  const document = typed.document(facts, override?.body);
  const rendered = renderTemplate(typed, facts, {
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(typed.emailClass === "marketing" ? { unsubscribeUrl: SAMPLE_NAMES.unsubscribeLink } : {}),
    ...(override === undefined ? {} : { override }),
  });
  return {
    templateId,
    subject: rendered.subject,
    preheader: override?.preheader ?? document.preheader,
    text: rendered.text,
    html: rendered.html,
  };
}

/**
 * The rendered **default** mail, as text — the field an override is compared against on the screen
 * ("draft (default)" vs "draft"). Pure and cheap; the editor calls it through the page, never on
 * the client, for the reason above: the register is functions, not serialisable data.
 */
export function defaultSampleRender(template: RegisteredEmailTemplate): SampleRender {
  return renderSampleEmail(template.id);
}
