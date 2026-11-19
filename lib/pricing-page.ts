/**
 * `/pricing`'s model — the v2 bands, joined (#1127, narrowed to one plan on 2026-11-19).
 *
 * The page used to be a grid of `billing_plan` rows with a monthly/yearly switch: every tier had
 * two intervals, so the reader picked a tier and then a frequency. Bundle 02 draws it the other
 * way — **one card per plan, each with one interval**, and the interval is a property of the plan
 * (`Single Annual` was a card, not a toggle position). That is also what the owner approved on
 * #1127 (Single · Family · Single Annual) — **Family removed from the catalogue first, then Single
 * Annual, both on 2026-11-19** — so the switch is gone rather than defaulted and the band now
 * draws the one card the catalogue sells: **Basic, $9.99 a month, 1 relationship**.
 *
 * **This module types no amount.** A card's figure is `formatCurrency(plan.priceCents)` over
 * `data/membership-plans.ts`, which reads the money out of `data/billing-plans.ts` — the same
 * fixture the checkout charges from and `billing_plan` is seeded from. A `$9.99` here would be the
 * fifth surface quoting a sixth number, which is the defect `tests/create-plan-prices.test.ts`
 * exists for.
 *
 * Pure: no React, no Next, no database, no clock. The page resolves the viewer's entitlement and
 * the fixture, and hands both in, so `tests/pricing-page-v2.test.tsx` can drive every state
 * (signed out, entitled, no catalogue) without a request.
 */
import { formatCurrency } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { BillingPlanId } from "@/data/billing-plans";
import { type MembershipPlanId, MEMBERSHIP_PLANS } from "@/data/membership-plans";
import { pricingCataloguePath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * **The plan the artifact marked "Most Popular".**
 *
 * With one plan in the catalogue that is the only card, and it still carries the ribbon: the
 * artifact put it on the monthly card — the one relationship and no-card start a first reader buys
 * — and a catalogue that grows again should not have to relearn which plan is the recommended one.
 * It is named here rather than derived from the catalogue's order, because "the first row is the
 * popular one" is a fact about an array's sort, not about the product; a catalogue re-order would
 * move a marketing claim. `tests/pricing-page-v2.test.tsx` pins that exactly one card carries it.
 */
export const POPULAR_PLAN_ID: MembershipPlanId = "single";

/** One plan's feature lines, as item ids into the `plans` section of `data/pages/pricing.ts`. */
const FEATURE_IDS: Readonly<Record<MembershipPlanId, readonly string[]>> = {
  single: ["feature-single-1", "feature-single-2", "feature-single-3", "feature-single-4"],
};

/** The hero: the promise, and the eyebrow above it. */
export interface PricingHeroModel {
  readonly eyebrow: string;
  readonly heading: string;
  readonly subtitle: string;
}

/** One plan card. */
export interface PricingCardModel {
  readonly id: MembershipPlanId;
  readonly name: string;
  /** `1 relationship`. */
  readonly summary: string;
  /** The figure, already formatted from the catalogue's cents — never a typed price. */
  readonly price: string;
  /** `/ month` or `/ year`, from the fixture. */
  readonly interval: string;
  /** `After a 7-day free trial · No card to start`. */
  readonly trialNote: string;
  readonly features: readonly string[];
  readonly popular: boolean;
  /** The ribbon's words, from the fixture — set on every card, drawn only on the popular one. */
  readonly popularLabel: string;
  /** The account already holds this plan: the card says so and offers no action. */
  readonly current: boolean;
  /** The marker's words, from the fixture. */
  readonly currentLabel: string;
  readonly cta: { readonly label: string; readonly href: string };
}

/** The strip under the grid. */
export interface PricingUnsureModel {
  readonly lead: string;
  readonly body: string;
  readonly cta: { readonly label: string; readonly href: string };
}

/** One step of How Billing Works. */
export interface PricingStepModel {
  readonly id: string;
  readonly ordinal: string;
  readonly title: string;
  readonly body: string;
}

/** Everything the plan band's frame needs, plus the two closing bands. */
export interface PricingBandsModel {
  readonly stepsHeading: string;
  readonly steps: readonly PricingStepModel[];
  readonly faqHeading: string;
  readonly faqBody: string;
  readonly ctaHeading: string;
  readonly ctaBody: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
  /** The one-line honesty notice a test-mode deployment renders, or `null`. */
  readonly testMode: string | null;
}

/** The hero, from the fixture's page-level fields. */
export function pricingHero(copy: PageCopy): PricingHeroModel {
  return {
    eyebrow: copy.eyebrow ?? "",
    heading: copy.heading,
    subtitle: copy.subtitle ?? "",
  };
}

/** The cards, in the catalogue's order — one projection from plans to cards. */
export function pricingCards(input: {
  readonly copy: PageCopy;
  readonly entitledPlanId: BillingPlanId | null;
}): PricingCardModel[] {
  const { copy, entitledPlanId } = input;
  const plans = sectionOf(copy, "plans");
  const trialNote = itemLabel(plans, "trial-note");
  const intervalLabel = (interval: string): string =>
    itemLabel(plans, interval === "year" ? "price-per-year" : "price-per-month");

  return MEMBERSHIP_PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    summary: plan.summary,
    price: formatCurrency(plan.priceCents, { trimZeroCents: true }),
    interval: intervalLabel(plan.interval),
    trialNote,
    features: FEATURE_IDS[plan.id].map((id) => itemLabel(plans, id)),
    popular: plan.id === POPULAR_PLAN_ID,
    popularLabel: itemLabel(plans, "most-popular"),
    current: entitledPlanId !== null && entitledPlanId === plan.tier,
    currentLabel: itemLabel(plans, "current-plan"),
    /**
     * **A card chooses a plan; it never charges (#1043, #1127).** The action is one link to the
     * catalogue carrying this plan's tier *and* interval, which the catalogue's cards keep and
     * stage 1 posts into the flow's cookie. There is no checkout on this page.
     */
    cta: {
      label: fillLabel(itemLabel(plans, "plan-cta"), { plan: plan.name }),
      href: pricingCataloguePath({ planId: plan.tier, interval: plan.interval }),
    },
  }));
}

/**
 * The unsure strip, and the plan it points at.
 *
 * `{plan}` is the ribbon's plan name, so the nudge and the badge cannot name two different plans;
 * its action is that plan's own door, so pressing it carries what the reader was just told.
 */
export function pricingUnsure(input: {
  readonly copy: PageCopy;
  readonly cards: readonly PricingCardModel[];
}): PricingUnsureModel {
  const { copy, cards } = input;
  const unsure = sectionOf(copy, "unsure");
  const popular = cards.find((card) => card.popular);
  return {
    lead: itemLabel(unsure, "unsure-lead"),
    body: fillLabel(itemLabel(unsure, "unsure-body"), { plan: popular?.name ?? "" }),
    cta: {
      label: itemLabel(unsure, "unsure-cta"),
      href: popular?.cta.href ?? pricingCataloguePath(),
    },
  };
}

/** How Billing Works, and the two closing bands. */
export function pricingBands(copy: PageCopy, testMode: boolean): PricingBandsModel {
  const billing = sectionOf(copy, "billing");
  const faq = sectionOf(copy, "faq");
  const cta = sectionOf(copy, "cta");
  const steps = (billing.items ?? []).map((item, index) => ({
    id: item.id,
    ordinal: String(index + 1),
    title: item.label,
    body: item.body ?? "",
  }));
  return {
    stepsHeading: billing.heading ?? "",
    steps,
    faqHeading: faq.heading ?? "",
    faqBody: faq.body ?? "",
    ctaHeading: cta.heading ?? "",
    ctaBody: cta.body ?? "",
    ctaLabel: itemLabel(cta, "get-started"),
    /** The general door: nothing carried, and a choice left by an earlier visit is cleared. */
    ctaHref: pricingCataloguePath(),
    testMode: testMode ? itemLabel(sectionOf(copy, "plans"), "test-mode") : null,
  };
}

/** The FAQ band's own section, so the page passes one prop rather than four words. */
export function pricingFaqSection(copy: PageCopy): PageCopySection {
  return sectionOf(copy, "faq");
}
