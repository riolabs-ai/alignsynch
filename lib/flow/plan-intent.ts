/**
 * The plan chosen on `/pricing`, carried to stage 5 (#1043).
 *
 * **Why this exists.** `/pricing` used to sell a membership on its own: each card's button asked
 * the server for a checkout and went where the answer said, so a membership could start with **no
 * relationship behind it** — and a person who then walked the create flow was asked for a plan they
 * had chosen one page earlier. This module is the carrier that removes the double-ask: a
 * plan-specific action on `/pricing` writes one small intent (a paid tier and an interval), the
 * intent rides the browser through the catalogue, a template's page, stage 1, and the account
 * round-trip at stage 4, and stage 5 opens with that row already selected.
 *
 * **A preference, never a payment.** Nothing here charges anything, and nothing here is a record:
 * stage 5's own checkout is still the only charge surface, and the paid gate
 * (`sendDraftInvitation()`) still refuses an unpaid send. The intent can be changed on the plan
 * panel before the card step opens, and the general CTA on `/pricing` **clears** it, so a door that
 * carries nothing cannot inherit a choice from an earlier visit.
 *
 * **Why a cookie and not a query string.** The journey crosses pages that are deliberately
 * prerendered — the catalogue, and the twenty-seven taxonomy pages under it — so a `?plan=` would
 * either be dropped at the first of them or force every one of them to render per request for a
 * value only the last screen reads. A cookie survives all of them, survives the sign-in at stage 4,
 * and survives a reload, without changing what any of those pages render. The draft cookie
 * (`lib/flow/create-draft.ts`) is the same shape of fact and is carried the same way.
 *
 * **The two vocabularies, and the crossing back.** A `/pricing` card is named by a *billing* tier
 * (`basic`, `principal`); stage 5's panel is keyed by the *fixture handle* (`one`, `unlimited`).
 * `PLAN_BILLING_TIER` is the one map between them, and `planRowFor()` reads it **backwards**
 * rather than keeping a second map beside it — which is what makes the crossing impossible to get
 * wrong in one direction only.
 *
 * Pure on purpose — no `next/headers`, no React — so the rules are unit-tested without a server,
 * and the route that writes the intent and the page that reads it share one implementation.
 */
import { z } from "zod";
import { BILLING_INTERVALS, type BillingInterval } from "@/data/billing-plans";
import { PLAN_BILLING_TIER, type PlanRowId } from "@/data/pages/assessment-create";

/**
 * The tiers a card can carry: exactly the values of the one plan map, so a tier the map does not
 * price can never be carried. `free` is deliberately outside it — it is every account's default,
 * so a free card's action is the general door and carries no choice at all.
 */
export type PaidPlanTier = (typeof PLAN_BILLING_TIER)[keyof typeof PLAN_BILLING_TIER];

/** Is this string a tier a card can carry? The runtime half of {@link PaidPlanTier}. */
export function isPaidPlanTier(value: string): value is PaidPlanTier {
  return (Object.values(PLAN_BILLING_TIER) as readonly string[]).includes(value);
}

/** Is this string one of the two intervals a price is keyed on? */
export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

/**
 * What a plan card carries: which tier, billed how.
 *
 * Both halves are required. A tier without its interval cannot be priced — `billing_plan` keys on
 * the pair — and defaulting the interval here is how the yearly card would quietly charge monthly.
 */
export interface PlanIntent {
  readonly planId: PaidPlanTier;
  readonly interval: BillingInterval;
}

const zPlanIntent = z
  .object({
    planId: z.custom<PaidPlanTier>((value) => typeof value === "string" && isPaidPlanTier(value)),
    interval: z.enum(BILLING_INTERVALS),
  })
  .strict();

/**
 * The intent a card's own address names, or `null` when it names none.
 *
 * `null` is the **general** answer, and it is a policy rather than a failure: a CTA that carries
 * nothing must clear whatever an earlier visit left, or the general door would inherit a
 * preselection nobody asked for. A crafted pair — a retired tier, an interval that does not exist,
 * `free` — resolves to `null` for the same reason: a URL cannot make stage 5 preselect a plan the
 * catalogue does not sell.
 */
export function planIntentFromSearch(params: {
  get(name: string): string | null;
}): PlanIntent | null {
  const planId = params.get("plan") ?? "";
  const interval = params.get("interval") ?? "";
  if (!isPaidPlanTier(planId) || !isBillingInterval(interval)) return null;
  return { planId, interval };
}

/**
 * The cookie value for an intent — base64url JSON, exactly as the create draft is written.
 *
 * base64url is cookie-octet-safe on its own, so Next cannot re-encode it into a value that decodes
 * once and then will not parse (`create-draft.ts` records that measurement).
 */
export function serializePlanIntent(intent: PlanIntent): string {
  return Buffer.from(JSON.stringify(intent), "utf8").toString("base64url");
}

/**
 * Read an intent out of a cookie value, or `null` when there is nothing trustworthy there.
 *
 * A hand-edited, stale or truncated cookie is "no plan chosen": the plan panel then draws its rows
 * unselected, which is the state this module's absence has always meant.
 */
export function parsePlanIntent(raw: string | undefined): PlanIntent | null {
  if (raw === undefined || raw === "") return null;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = zPlanIntent.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The plan row a carried tier is drawn by — `PLAN_BILLING_TIER` read backwards.
 *
 * `null` when the map prices no row at that tier, which is the state a map edited on one side only
 * produces; stage 5 then draws nothing preselected rather than guessing a row.
 */
export function planRowFor(tier: PaidPlanTier): PlanRowId | null {
  const entry = (Object.entries(PLAN_BILLING_TIER) as [PlanRowId, PaidPlanTier][]).find(
    ([, mapped]) => mapped === tier,
  );
  return entry === undefined ? null : entry[0];
}

/** What stage 5 needs from a carried intent: the row to preselect, and the two facts behind it. */
export interface CarriedPlan extends PlanIntent {
  readonly row: PlanRowId;
}

/** A carried intent resolved to a row, or `null` when no row is drawn for its tier. */
export function carriedPlanOf(intent: PlanIntent | null): CarriedPlan | null {
  if (intent === null) return null;
  const row = planRowFor(intent.planId);
  return row === null ? null : { ...intent, row };
}
