/**
 * Plan → what the server allows (#289). No provider, no query, no UI — pure functions.
 *
 * The gate this card was given is deliberately computable from columns the schema already has,
 * because a gate that needs a new subsystem is a gate that ships as a mock screen:
 *
 * | plan   | active assessment instances | modes                                     |
 * | ------ | --------------------------- | ----------------------------------------- |
 * | Free   | 1                           | Basic Mode only (Feel and Wish)           |
 * | Paid   | unlimited                   | Basic and Advanced (adds Think and Guess) |
 *
 * "Active" is the count `lib/db/billing.ts` reads: the account holds a party row on an instance
 * and that instance is not complete yet (`instanceStatusOf`'s definition, written as SQL). A
 * finished assessment does not hold a slot, so a free account can keep using the product for
 * ever — one relationship at a time.
 *
 * **Why the refusal names the plan.** A 400 that says "limit reached" is a bug report; a 400 that
 * says *"The Free plan includes 1 active assessment"* is a person learning what they bought.
 * Every message below is built from the entitlement's own `planName` and numbers, so a renamed
 * tier cannot leave a sentence pointing at a plan that no longer exists.
 */
import type { AssessmentMode } from "@/content/assessment";
import { BILLING_PLAN_IDS, type BillingPlanId, billingPlan } from "@/data/billing-plans";
import type { Entitlement, Subscription, SubscriptionStatus } from "./types";

/** The tier an account with no paid subscription is on. Never null, never "none". */
export const FREE_PLAN_ID: BillingPlanId = "free";

/** The free plan's one active assessment. A named constant, because prose quotes it. */
export const FREE_ACTIVE_INSTANCE_LIMIT = 1;

/**
 * The free plan's one active **relationship** (#505).
 *
 * The fixture sells it in the reader's words — Free is "For one relationship at a time", its
 * limitation is "One active relationship at a time", and every paid tier lists "Unlimited active
 * relationships" — so the number here is the fixture's, not a second opinion. It is a separate
 * limit from `FREE_ACTIVE_INSTANCE_LIMIT` because the two count different things: an *instance* is
 * one session on a relationship, and an account may hold a session as the Counterparty on somebody
 * else's relationship without ever having started one. What a plan sells is the number of
 * relationships you may **start**; being invited is not a purchase.
 */
export const FREE_ACTIVE_RELATIONSHIP_LIMIT = 1;

/** The mode every account may play. */
export const BASIC_MODE: AssessmentMode = "basic";

/** The mode a paid plan adds. */
export const ADVANCED_MODE: AssessmentMode = "advanced";

/**
 * The statuses that still serve the product.
 *
 * `past_due` is included on purpose: renewal, dunning and grace periods are out of scope, and a
 * payment a provider is retrying should not turn the lights off mid-assessment. Turning them off
 * is a decision for the card that owns dunning, not a silent side effect of this one.
 */
const PAID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["active", "trialing", "past_due"]);

/** Does this subscription still entitle the account? */
export function subscriptionGrantsPaid(status: SubscriptionStatus): boolean {
  return PAID_STATUSES.has(status);
}

/**
 * The tier that entitles the account.
 *
 * A subscription that is not paid, names a tier this fixture no longer carries, or does not exist
 * at all resolves to Free — the least it could be, never the most. `db:verify` (V13) is what
 * reports the drift; a gate must not widen because a row is wrong.
 */
export function entitlingPlanId(subscription: Subscription | null): BillingPlanId {
  if (subscription === null) return FREE_PLAN_ID;
  if (!subscriptionGrantsPaid(subscription.status)) return FREE_PLAN_ID;
  return billingPlan(subscription.planId) === undefined ? FREE_PLAN_ID : subscription.planId;
}

/** A tier's entitlement — the whole gate, from one id. */
export function entitlementForPlan(planId: BillingPlanId): Entitlement {
  const plan = billingPlan(planId) ?? billingPlan(FREE_PLAN_ID);
  if (plan === undefined) {
    // Unreachable while the fixture carries `free`; a throw here is a load-bearing failure, not a
    // silent free plan, because the alternative is gating on a tier nobody wrote.
    throw new Error(
      "data/billing-plans.ts carries no free tier — the entitlement table has no floor",
    );
  }
  const paid = plan.id !== FREE_PLAN_ID;
  return {
    planId: plan.id,
    planName: plan.name,
    paid,
    maxActiveInstances: paid ? null : FREE_ACTIVE_INSTANCE_LIMIT,
    maxActiveRelationships: paid ? null : FREE_ACTIVE_RELATIONSHIP_LIMIT,
    advancedMode: paid,
    allowedModes: paid ? [BASIC_MODE, ADVANCED_MODE] : [BASIC_MODE],
  };
}

/** The entitlement for an account, from the subscription the port read for it. */
export function entitlementOf(subscription: Subscription | null): Entitlement {
  return entitlementForPlan(entitlingPlanId(subscription));
}

/**
 * The highest tier among a set of plan ids — the subscription's, and any live grant's (#505).
 *
 * Ranked by `BILLING_PLAN_IDS`, the fixture's own order, which is documented as cheapest first. An
 * unknown id is ignored rather than ranked: a row naming a tier this build does not sell must not
 * widen an entitlement, and `db:verify` is what reports the drift. The result is always a tier the
 * fixture carries, because `free` is the floor.
 */
export function highestPlanId(planIds: readonly string[]): BillingPlanId {
  let best: BillingPlanId = FREE_PLAN_ID;
  for (const id of planIds) {
    if (billingPlan(id) === undefined) continue;
    if (BILLING_PLAN_IDS.indexOf(id as BillingPlanId) > BILLING_PLAN_IDS.indexOf(best)) {
      best = id as BillingPlanId;
    }
  }
  return best;
}

/** A refusal the caller must surface. Same shape the flow store's errors carry. */
export interface GateRefusal {
  readonly code: "instance-limit" | "mode-not-entitled" | "relationship-limit";
  /** One sentence, naming the plan and what would change its answer. */
  readonly message: string;
  readonly planId: BillingPlanId;
  readonly planName: string;
}

/**
 * May this account start another relationship? `null` means yes (#505).
 *
 * **The plan sells relationships, so this is the question the create form asks.** It is asked
 * before `instanceGateRefusal` because it is the plan's own limit: an account that has used the one
 * relationship its tier includes is refused with a sentence about the relationship it holds, not
 * about an "assessment instance" it never saw named on the pricing page. The two gates are not the
 * same question — `activeRelationships` counts the relationships this account **started**, and an
 * account may be the Counterparty on several without initiating one, which the instance count
 * includes and this one must not.
 *
 * `activeRelationships` is `activeRelationshipCount()` — relationships with a session neither
 * complete nor voided — and `null` limits mean unlimited, exactly as the instance gate reads them.
 * The sentence is built from the entitlement's own `planName` and numbers for the reason
 * `instanceGateRefusal` records: a renamed tier cannot leave a sentence pointing at a plan that no
 * longer exists.
 */
export function relationshipGateRefusal(input: {
  readonly entitlement: Entitlement;
  /** Relationships this account initiated and still holds open — `activeRelationshipCount()`. */
  readonly activeRelationships: number;
}): GateRefusal | null {
  const { entitlement, activeRelationships } = input;
  const limit = entitlement.maxActiveRelationships;
  if (limit === null || activeRelationships < limit) return null;

  const noun = limit === 1 ? "relationship" : "relationships";
  const held =
    activeRelationships === 1
      ? "1 active relationship"
      : `${activeRelationships} active relationships`;
  return {
    code: "relationship-limit",
    planId: entitlement.planId,
    planName: entitlement.planName,
    message:
      `The ${entitlement.planName} plan includes ${limit} active ${noun}. ` +
      `This account already has ${held}. ` +
      "Finish it before starting another, or move to a paid plan for unlimited active relationships.",
  };
}

/**
 * May this account create this instance? `null` means yes.
 *
 * Both questions are asked here — the count and the mode — so a caller cannot enforce one and
 * forget the other, and the order is fixed: the count first (it is the cheaper fact to explain),
 * then the mode.
 */
export function instanceGateRefusal(input: {
  readonly entitlement: Entitlement;
  /** Active instances the account already holds — `activeInstanceCount()`. */
  readonly activeInstances: number;
  /** The mode the create asked for, already parsed by the store. */
  readonly mode: AssessmentMode;
}): GateRefusal | null {
  const { entitlement, activeInstances, mode } = input;
  const limit = entitlement.maxActiveInstances;

  if (limit !== null && activeInstances >= limit) {
    const noun = limit === 1 ? "assessment" : "assessments";
    const held =
      activeInstances === 1 ? "1 active assessment" : `${activeInstances} active assessments`;
    return {
      code: "instance-limit",
      planId: entitlement.planId,
      planName: entitlement.planName,
      message:
        `The ${entitlement.planName} plan includes ${limit} active ${noun}. ` +
        `This account already has ${held}. Finish or close that one before starting another, ` +
        "or move to a paid plan for unlimited active assessments.",
    };
  }

  if (mode === ADVANCED_MODE && !entitlement.advancedMode) {
    return {
      code: "mode-not-entitled",
      planId: entitlement.planId,
      planName: entitlement.planName,
      message:
        "Advanced Mode (Think and Guess) is part of the paid plans. " +
        `The ${entitlement.planName} plan plays Basic Mode — Feel and Wish — and this assessment ` +
        "was asked for in Advanced Mode.",
    };
  }

  return null;
}

/**
 * May this tier be bought? `null` means yes; a string is the refusal's sentence.
 *
 * The reasons are separate because they need different answers: an unknown tier is a bad
 * request, the free tier is already yours, and a tier whose `checkout` is false is sold through
 * a conversation (`brand.supportEmail`), not a card form.
 */
export function checkoutRefusal(planId: string): string | null {
  const plan = billingPlan(planId);
  if (plan === undefined) return `"${planId}" is not a plan this product sells`;
  if (!plan.checkout) {
    return plan.id === FREE_PLAN_ID
      ? "The Free plan is not bought — every account is on it until it upgrades"
      : `The ${plan.name} plan is arranged with us directly rather than through a checkout`;
  }
  return null;
}

/**
 * The gate, in one table — for the docs, the PR body and the acceptance paste.
 *
 * Derived from `BILLING_PLAN_IDS`, never a hand-written list of "the paid ones": a tier added to
 * the fixture appears here without an edit, and a tier removed from it cannot linger in a
 * summary nobody re-read.
 */
export function gateSummary(): readonly {
  readonly plan: string;
  readonly activeInstances: string;
  readonly relationships: string;
  readonly modes: string;
}[] {
  return BILLING_PLAN_IDS.map(entitlementForPlan).map((entitlement) => ({
    plan: entitlement.planName,
    activeInstances:
      entitlement.maxActiveInstances === null
        ? "unlimited"
        : String(entitlement.maxActiveInstances),
    // #505 — what the tier sells in the reader's words. `null` is "unlimited", never "0".
    relationships:
      entitlement.maxActiveRelationships === null
        ? "unlimited"
        : String(entitlement.maxActiveRelationships),
    modes: entitlement.allowedModes.join(" + "),
  }));
}
