// template-ancestor: components/marketing/relationship-catalogue.tsx   (variation: the pricing route — the hero band, one card per plan with one interval each, the unsure strip, and the How Billing Works panel, all in bundle 02's band vocabulary)

import type {
  PricingBandsModel,
  PricingCardModel,
  PricingHeroModel,
  PricingUnsureModel,
} from "@/lib/pricing-page";
import Link from "next/link";

/**
 * `/pricing` — the plans band, drawn as bundle 02 draws it (#1127).
 *
 * **The pre-v2 composition is gone, not restyled around.** It was a grid of `billing_plan` rows
 * with a monthly/yearly switch and a "Save up to N%" badge: every tier had two intervals, so the
 * reader picked a tier and then a frequency, and the page printed a `/mo` figure for a yearly
 * charge divided by twelve. The artifact sells **one card per plan, each with one interval** —
 * Basic, the one plan left after the owner removed Family and then Single Annual on 2026-11-19 —
 * where the interval is a property of the plan. So the switch, the discount badge and the free
 * tier's card are removed rather than defaulted, and there is no reader-visible control on this
 * page but the one action.
 *
 * **This component owns no word and no figure.** The hero, every card and the strip arrive from
 * `lib/pricing-page.ts`, which joins `data/pages/pricing.ts` (the words) to
 * `data/membership-plans.ts` (the names, the capacities and the amounts — which that module in turn
 * reads out of `data/billing-plans.ts`). E23 attributes `components/pricing/**` to the page's
 * fixture at a budget of 0, so the next sentence typed here is a red build; and no `$` figure can
 * appear at all, because the only thing that turns cents into money is `formatCurrency` inside the
 * projection.
 *
 * **A card chooses; nothing charges (#1043, #1115 D3).** Each action is one link to the catalogue
 * carrying the plan's tier and interval. The plan is sold inside stage 5, behind the send, and this
 * page holds no checkout, no card field and no price input.
 *
 * `testMode` is drawn from the fixture's own sentence rather than assembled here, for the same
 * reason as every other line: the release candidate runs the hosted adapter on test keys, and the
 * band has to say so.
 */
export function PricingPlans({
  hero,
  cards,
  unsure,
  bands,
}: {
  hero: PricingHeroModel;
  cards: readonly PricingCardModel[];
  unsure: PricingUnsureModel;
  bands: PricingBandsModel;
}) {
  return (
    <>
      <section className="border-b bg-mist" aria-labelledby="pricing-title">
        <div className="mx-auto w-full max-w-content px-4 lg:px-6">
          <div className="space-y-3 py-10 text-center lg:py-12">
            <p className="text-xs font-semibold uppercase tracking-wider text-deep">
              {hero.eyebrow}
            </p>
            <h1
              className="text-3xl font-bold tracking-tight text-primary lg:text-4xl"
              id="pricing-title"
            >
              {hero.heading}
            </h1>
            <p className="mx-auto max-w-xl text-base text-foreground">{hero.subtitle}</p>
            {bands.testMode === null ? null : (
              <p className="mx-auto max-w-xl text-sm font-medium text-foreground" role="status">
                {bands.testMode}
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-content px-4 lg:px-6">
          <div className="space-y-6 py-10">
            <ul className="grid gap-6 pt-3 md:grid-cols-2">
              {cards.map((card) => (
                <PlanCard card={card} key={card.id} />
              ))}
            </ul>

            <div className="flex flex-col items-start gap-3 rounded-lg border border-status-line bg-status p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{unsure.lead}</span> {unsure.body}
              </p>
              <Link
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-action px-4 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
                href={unsure.cta.href}
                data-most-popular
              >
                {unsure.cta.label}
              </Link>
            </div>

            <section className="rounded-lg border border-billing-line bg-billing p-5">
              <h2 className="text-base font-semibold text-primary">{bands.stepsHeading}</h2>
              <ol className="mt-3 grid gap-4 md:grid-cols-3">
                {bands.steps.map((step) => (
                  <li className="flex gap-3" key={step.id}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-billing-chip text-xs font-semibold text-billing-ink">
                      {step.ordinal}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * One plan: the ribbon, the name and its capacity, the amount, the trial line, the features and
 * the one action.
 *
 * The ribbon is `card.popular`, which the projection sets from `POPULAR_PLAN_ID` — exactly one card
 * carries it, and the card that does is the one the outline and the filled action follow, so the
 * signals cannot point at different plans.
 *
 * A card the account already holds (`card.current`) says so and offers no action: a button that
 * would sell someone the plan they are on is the defect the marker replaces.
 */
function PlanCard({ card }: { card: PricingCardModel }) {
  return (
    <li
      className={`relative flex flex-col rounded-lg border bg-card p-5 ${
        card.popular ? "border-action ring-1 ring-action" : ""
      }`}
      data-plan-card={card.id}
    >
      {card.popular ? (
        <span className="absolute -top-3 left-5">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-transparent bg-action px-2.5 py-0.5 text-xs font-semibold text-action-foreground">
            <RibbonGlyph />
            {card.popularLabel}
          </span>
        </span>
      ) : null}
      <h3 className="text-lg font-semibold text-primary">{card.name}</h3>
      <p className="text-sm text-muted-foreground">{card.summary}</p>
      <p className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-primary">{card.price}</span>
        <span className="text-sm text-muted-foreground"> {card.interval}</span>
      </p>
      <p className="mt-1 text-sm font-medium text-billing-ink">{card.trialNote}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground">
        {card.features.map((feature) => (
          <li className="flex items-start gap-2" key={feature}>
            <CheckGlyph />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {card.current ? (
        <p className="mt-5 text-sm font-semibold text-primary" data-plan-current={card.id}>
          {card.currentLabel}
        </p>
      ) : (
        <Link
          className={`mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10 ${
            card.popular
              ? "bg-action text-action-foreground hover:bg-action-hover"
              : "border border-input bg-background text-primary hover:bg-mist"
          }`}
          data-plan-cta={card.id}
          href={card.cta.href}
        >
          {card.cta.label}
        </Link>
      )}
    </li>
  );
}

/** The tick the feature lines and the hero share — one glyph, so they read as one set. */
function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-deep"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** The ribbon's mark: a small star, so the badge reads as a claim rather than a label. */
function RibbonGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-3 shrink-0"
      fill="currentColor"
      stroke="none"
      viewBox="0 0 24 24"
    >
      <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 5.9 20.6 7.2 13.8l-5-4.7 6.8-.8Z" />
    </svg>
  );
}
