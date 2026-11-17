/**
 * `/dashboard/payment` — the member's billing surface (#1132).
 *
 * One page, one read, one derivation. The route resolves the session, reads the member's facts
 * (`readBillingFacts()` — the relationships they are party to, the account's live subscription and
 * the one free week's claim) and hands them to `billingViewOf()`, which is pure; the component
 * renders what it is given. Nothing here decides which state a relationship is in, and nothing in
 * the component does either — `tests/payment-panels.test.ts` is the table over that decision.
 *
 * **Both parties reach the same address, and the page draws the right one.** The role is derived
 * from the rows: an account that initiated a relationship reads its trial panels (a panel is only
 * drawn for the reader the trial, the price and the card are true statements about), and an account
 * that was only ever invited reads the bundle's single sentence. `?role=` is a prototype review
 * toggle and is deliberately not read — `IMPLEMENTATION-PROMPT.md` lists those query strings under
 * "Prototype mechanics that must not be ported".
 *
 * **No auth environment is the configuration error, not a signed-out session.** `requireRole()`
 * calls `currentUser()`, which builds the auth server outside its `try` and therefore throws
 * `NEON_AUTH_BASE_URL is not set` on a tree with no `NEON_AUTH_*` — the documented answer for every
 * gated console route in this tree (kanban t_c6398125). The gate and CI never issue a request to
 * this route, so `pnpm build` stays green with no secrets.
 *
 * `force-dynamic`: per-request session, database reads, and a countdown that must be the one
 * computed at this instant rather than frozen into HTML at build time.
 */
import type { Metadata } from "next";

import { PaymentView } from "@/components/billing/payment-view";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { paymentPageCopy } from "@/data/pages/payment";
import { claimExtensionAction } from "@/app/(mainlayout)/dashboard/relationships/actions";
import { requireRole } from "@/lib/auth/require-role";
import { billingViewOf, membershipPrice, type BillingView } from "@/lib/billing/payment-view";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { PAYMENT_PATH } from "@/lib/flow/paths";
import { readBillingFacts } from "@/lib/member/relationships";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

export default async function PaymentPage() {
  const { user } = await requireRole("member", { next: PAYMENT_PATH });

  /*
   * The empty view is "nothing to bill", not "nothing was read": a database that did not answer
   * draws `unreadable` and no panels, because a billing screen that showed an empty list for a
   * failed read would be telling a member they own nothing. The default here therefore carries the
   * role the page assumes before any row is known, and it is only ever drawn when `unreadable` is
   * set.
   */
  let view: BillingView = {
    role: "initiator",
    price: membershipPrice(),
    panels: [],
    coverage: [],
    cardOnFile: false,
    empty: true,
  };
  let unreadable: string | null = null;

  try {
    view = billingViewOf(await readBillingFacts(user.userId));
  } catch (error) {
    // "The database did not answer" is a state this screen can describe. A row that fails the
    // model is a code defect and keeps throwing.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("payment: the billing facts could not be read", error);
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <PaymentView
        copy={paymentPageCopy}
        view={view}
        unreadable={unreadable}
        onClaimExtension={claimExtensionAction}
      />
    </StageColumn>
  );
}
