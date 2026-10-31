/**
 * `/pricing` — the pricing route's copy (WU-9).
 *
 * The pricing page is three bands: the plan grid (`PricingPlans`), the FAQ
 * (`PricingFaq`) and the closing banner (`PricingCta`). `app/(marketing)/pricing/page.tsx`
 * resolves one section per band and passes it down, so the words below are the
 * only ones the three components render.
 *
 * Two things the page computes rather than spells:
 *
 *  - `save-badge` carries `{percent}`; the view fills it from
 *    `formatPercentValue(metric("pricing.annualDiscount").value)` — a number
 *    typed here as well would be a second source of truth for a metric.
 *  - `no-results` carries `{query}`; the view fills it from the live search box.
 *
 * `price-note` is the line that makes a published price honest now that billing is open. Jaden
 * ruled on 2026-10-31 that the four tiers and every price stay (they are `billing_plan` rows in
 * #289), so the page cannot stop showing a number — it has to say what the number is: US dollars,
 * monthly or yearly, through a card checkout, with the Free plan working today. `test-mode` is
 * the second half of that honesty: the release candidate runs the hosted adapter on test keys, so
 * the band says on one line that nothing is charged. Both are rendered by the plan band from this
 * fixture, and neither is a claim the code does not keep.
 *
 * The plan rows themselves are not here on purpose: their words live in `data/billing-plans.ts`
 * (the plan fixture) and their figures in `billing_plan`, so the grid reads one list rather than
 * a second copy under `data/pages/`.
 *
 * `heading` is the route's page heading and the plan band renders it as its `h1`:
 * on this route the first band *is* the hero, so the page line and the section
 * heading spell the same words — the band reads its own section, the top-level
 * pair documents what the page is.
 *
 * Not here, on purpose: the plan rows themselves (`name`, `description`,
 * `features`, `limitations`, `cta`, `price`) and the FAQ question/answer rows are
 * record-shaped blocks with no schema in P2 — see the WU-9 report.
 */
import { brand } from "../brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

export const pricingPageCopy: PageCopy = zPageCopy.parse({
  heading: "Simple, Transparent Pricing",
  subtitle: "Choose the perfect plan for your quiz creation and learning needs",
  sections: [
    {
      id: "plans",
      heading: "Simple, Transparent Pricing",
      body: "Choose the perfect plan for your quiz creation and learning needs",
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
        { id: "custom-plan", label: "Need a custom plan?" },
        { id: "custom-plan-link", label: "Contact us" },
        {
          id: "custom-plan-tooltip",
          label:
            "Contact our sales team for custom pricing options tailored to your organization's specific needs.",
        },
      ],
    },
    {
      id: "faq",
      heading: "Frequently Asked Questions",
      body: "Find answers to common questions about our platform, pricing, and features",
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
      heading: "Ready to create amazing quizzes?",
      body: "The free plan works today. A paid plan starts as soon as you choose one above — card checkout, monthly or yearly.",
      items: [
        { id: "perk-free", label: "Free plan, usable today" },
        { id: "perk-billing", label: "Paid plans are billed monthly or yearly" },
        { id: "get-started", label: "Get Started Free" },
        { id: "view-demo", label: "View Demo" },
      ],
    },
  ],
});
