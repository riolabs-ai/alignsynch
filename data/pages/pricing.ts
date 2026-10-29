/**
 * `/pricing` — the pricing route's copy (WU-9).
 *
 * The pricing page is three bands: the plan grid (`PricingPlans`), the FAQ
 * (`PricingFaq`) and the closing banner (`PricingCta`). `app/(mainlayout)/pricing/page.tsx`
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
 * `heading` is the route's page heading and the plan band renders it as its `h1`:
 * on this route the first band *is* the hero, so the page line and the section
 * heading spell the same words — the band reads its own section, the top-level
 * pair documents what the page is.
 *
 * Not here, on purpose: the plan rows themselves (`name`, `description`,
 * `features`, `limitations`, `cta`, `price`) and the FAQ question/answer rows are
 * record-shaped blocks with no schema in P2 — see the WU-9 report.
 */
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
        { id: "save-badge", label: "Save {percent}" },
        { id: "most-popular", label: "Most Popular" },
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
        { id: "contact-email", label: "support@quizhub.com" },
      ],
    },
    {
      id: "cta",
      heading: "Ready to create amazing quizzes?",
      body: "Join thousands of educators, content creators, and businesses who are engaging their audience with interactive quizzes.",
      items: [
        { id: "perk-no-card", label: "No credit card required to start" },
        { id: "perk-trial", label: "14-day free trial on all paid plans" },
        { id: "perk-cancel", label: "Cancel anytime, no questions asked" },
        { id: "perk-support", label: "Dedicated support to help you succeed" },
        { id: "get-started", label: "Get Started Free" },
        { id: "view-demo", label: "View Demo" },
      ],
    },
  ],
});
