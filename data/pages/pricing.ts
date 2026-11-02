/**
 * `/pricing` — the pricing route's copy.
 *
 * The pricing page is three bands: the plan grid (`PricingPlans`), the FAQ
 * (`PricingFaq`) and the closing banner (`PricingCta`). `app/(marketing)/pricing/page.tsx`
 * resolves one section per band and passes it down, so the words below are the
 * only ones the three components render.
 *
 * **This page sells relationship alignment** (owner, 2026-11-02). It used to carry the QuizHub
 * fixture — "quiz creation and learning needs", a quiz FAQ, a "create amazing quizzes" banner —
 * and none of it described this product. Every line here is now about what the build does: the
 * two-party assessment, the template a practice authors, the blind answer, the report, the Gap,
 * the Steps that follow from it, and the coach seat that runs the session. There is no proof
 * claim anywhere on the page — no customer count, logo, rating, "trusted by", or earnings
 * figure — because the product has no such evidence to show and a pricing page is where a
 * fabricated one would be most expensive.
 *
 * Two things the page computes rather than spells:
 *
 *  - `save-badge` carries `{percent}`; the view fills it from
 *    `formatPercentValue(metric("pricing.annualDiscount").value)` — a number
 *    typed here as well would be a second source of truth for a metric. The 20% it prints is
 *    the discount the fixture's `yearlyCents` values actually apply.
 *  - `no-results` carries `{query}`; the view fills it from the live search box.
 *
 * `price-note` is the line that makes a published price honest now that billing is open: US
 * dollars, monthly or yearly, through a card checkout, with the Free plan working today.
 * `test-mode` is the second half of that honesty: the release candidate runs the hosted adapter
 * on test keys, so the band says on one line that nothing is charged. Both are rendered by the
 * plan band from this fixture, and neither is a claim the code does not keep.
 *
 * **The plan rows themselves are not here on purpose**: their words live in
 * `data/billing-plans.ts` (the plan fixture) and their figures in `billing_plan`, so the grid
 * reads one list rather than a second copy under `data/pages/`. There is likewise no
 * "need a custom plan? contact sales" item any more — that was the removed Enterprise tier's
 * copy, and an invitation to agree terms that no plan in the catalogue offers is a promise the
 * checkout cannot keep.
 *
 * `heading` is the route's page heading and the plan band renders it as its `h1`:
 * on this route the first band *is* the hero, so the page line and the section
 * heading spell the same words — the band reads its own section, the top-level
 * pair documents what the page is.
 */
import { brand } from "../brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

export const pricingPageCopy: PageCopy = zPageCopy.parse({
  heading: "Simple, transparent pricing for relationship alignment",
  subtitle:
    "Every plan runs the same assessment: templates you author, blind answers from both parties, and a report that names every Gap. The Free plan runs one relationship at a time; the paid plans run as many as your practice can hold.",
  sections: [
    {
      id: "plans",
      heading: "Simple, transparent pricing for relationship alignment",
      body: "Every plan runs the same assessment: templates you author, blind answers from both parties, and a report that names every Gap. The Free plan runs one relationship at a time; the paid plans run as many as your practice can hold.",
      items: [
        { id: "monthly", label: "Monthly" },
        { id: "yearly", label: "Yearly" },
        { id: "save-badge", label: "Save up to {percent}" },
        {
          id: "price-note",
          label:
            "Prices are in US dollars. The Free plan works today; the paid plans are billed monthly or yearly through a card checkout.",
        },
        {
          id: "test-mode",
          label: "Test mode: the card checkout runs on test keys, so no card is charged.",
        },
        { id: "most-popular", label: "Recommended" },
        { id: "current-plan", label: "Your current plan" },
        { id: "not-available", label: "Not available to buy right now." },
        { id: "checkout-busy", label: "Opening checkout…" },
        { id: "checkout-error", label: "Checkout did not start — try again" },
        { id: "whats-included", label: "WHAT'S INCLUDED:" },
        { id: "limitations", label: "LIMITATIONS:" },
        { id: "price-per-month", label: "mo" },
        { id: "price-per-month-yearly", label: "mo, billed yearly" },
      ],
    },
    {
      id: "faq",
      heading: "Frequently Asked Questions",
      body: "Answers about the assessment, the plans and the data behind them",
      items: [
        { id: "search-placeholder", label: "Search questions..." },
        { id: "no-results", label: 'No results found for "{query}"' },
        { id: "no-results-hint", label: "Try a different search term or" },
        { id: "clear-search", label: "clear your search" },
        { id: "contact-prompt", label: "Still have questions? Contact our support team at" },
        { id: "contact-email", label: brand.supportEmail },
      ],
    },
    {
      id: "cta",
      heading: "Run your first alignment",
      body: "The free plan works today, one relationship at a time. A paid plan starts as soon as you choose one above — card checkout, monthly or yearly.",
      items: [
        { id: "perk-free", label: "Free plan, usable today" },
        { id: "perk-billing", label: "Paid plans are billed monthly or yearly" },
        { id: "get-started", label: "Get Started Free" },
        { id: "view-demo", label: "View Demo" },
      ],
    },
  ],
});
