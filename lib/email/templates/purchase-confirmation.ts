/**
 * Template #10 — the purchase confirmation (#548, band v0.9).
 *
 * **It confirms the grant; it is not a receipt.** The spec is explicit: the receipt itself stays
 * the payment provider's, and this message says the one thing a receipt does not — that a plan is
 * now active on the account and the relationship it pays for is writable. Sending a second copy of
 * an invoice would be the product claiming a job the provider already did, and two documents about
 * one payment disagree the first time either is corrected.
 *
 * **The plan's name is a fact, not copy.** `plan` arrives from `data/billing-plans.ts` through the
 * caller (`entitlingPlanId()` resolves it), so a renamed tier cannot leave a sentence naming a plan
 * that no longer exists — the same rule `lib/billing/entitlements.ts` follows for its refusals.
 *
 * **Text first.** `purchaseConfirmationDocument()` returns an `EmailDocument`; the band composes
 * the plain text and derives the HTML from it (`lib/email/band.ts`).
 *
 * **Nothing is invented.** No amount, no interval, no renewal date, no card details and no
 * discount: the facts are who bought, which plan, and where it lives. Transactional, so the band
 * refuses an unsubscribe line on it — a confirmation of a purchase is not a list either.
 */
import { CONTENT_TO_REFINE, type EmailDocument } from "@/lib/email/band";

/** The spec's subject, as a constant — it states the result, not the plan's name. */
export const PURCHASE_CONFIRMATION_SUBJECT = "Your membership is active";

export interface PurchaseConfirmationFacts {
  /** The account that bought — the seat this message addresses. */
  readonly recipient: string;
  /** The plan's name from the billing fixture, resolved by the caller. Never composed here. */
  readonly plan: string;
  /** The account's own plans surface. The message's only address. */
  readonly link: string;
}

export function purchaseConfirmationDocument(facts: PurchaseConfirmationFacts): EmailDocument {
  return {
    subject: PURCHASE_CONFIRMATION_SUBJECT,
    preheader: `The ${facts.plan} plan is active on your account.`,
    blocks: [
      {
        kind: "paragraph",
        text: `${CONTENT_TO_REFINE} One sentence on what the plan covers, in the product's own voice.`,
      },
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, the ${facts.plan} plan is active on your account.`,
      },
      { kind: "paragraph", text: `Open your plan: ${facts.link}` },
      {
        kind: "paragraph",
        text: "This message confirms what is active. The receipt for the payment itself comes from your payment provider.",
      },
    ],
  };
}
