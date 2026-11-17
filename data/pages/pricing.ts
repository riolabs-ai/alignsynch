/**
 * `/pricing` — the pricing route's copy, in bundle 02's bands (#1127).
 *
 * The page is five bands, in the order a reader meets them
 * (`docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/pricing.html`):
 *
 *   1. **the hero** — the promise, and the three facts a reader deciding needs (a trial, no card,
 *      the invitee pays nothing);
 *   2. **the plans** — three cards, one per plan the catalogue sells. The **names, summaries and
 *      amounts are not here**: they are `data/membership-plans.ts` (which reads its money out of
 *      `data/billing-plans.ts`), so a price typed into this file would be a second source for the
 *      one number a checkout charges. What *is* here is everything around the figure — the ribbon,
 *      the trial line, the card's action frame, and one line of features per plan;
 *   3. **the unsure strip** — the honest nudge for a reader who cannot choose;
 *   4. **How Billing Works** — three steps, because the plan is chosen here and sold nowhere;
 *   5. **the questions** and **the closing band**.
 *
 * **No price, no currency and no fourth plan.** The three feature lists are the artifact's own
 * lines for the three approved plans; `tests/pricing-page-v2.test.tsx` pins that nothing under
 * `components/pricing/**` holds a `$` figure, and the catalogue's own invariants
 * (`membershipPlanProblems()`) pin the plan set.
 *
 * Two things the page computes rather than spells:
 *
 *  - `plan-cta` carries `{plan}`; the view fills it with the catalogue's name, so "Start With
 *    Single" and the card's title cannot disagree;
 *  - `unsure-body` carries `{plan}` for the same reason.
 *
 * `test-mode` is the honesty line the release candidate needs: the hosted checkout runs on test
 * keys, so the band says on one line that nothing is charged.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const pricingPageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Pricing",
  heading: "Simple Pricing. Start Free.",
  subtitle:
    "Every plan starts with a 7-day free trial and no card. The trial begins when the other person accepts. The person you invite never pays.",
  sections: [
    {
      id: "plans",
      items: [
        { id: "most-popular", label: "Most Popular" },
        { id: "trial-note", label: "After a 7-day free trial · No card to start" },
        { id: "plan-cta", label: "Start With {plan}" },
        { id: "price-per-month", label: "/ month" },
        { id: "price-per-year", label: "/ year" },
        { id: "current-plan", label: "Your current plan" },
        {
          id: "test-mode",
          label: "Test mode: the card checkout runs on test keys, so no card is charged.",
        },
        /**
         * The artifact's four lines per card. They describe what the build does — one
         * relationship, both modes, the report and its Steps, the invitee paying nothing — and no
         * line claims a capability the server refuses.
         */
        { id: "feature-single-1", label: "1 relationship, any template" },
        { id: "feature-single-2", label: "Basic and Advanced Mode" },
        { id: "feature-single-3", label: "Align, Chat and Next Step" },
        { id: "feature-single-4", label: "Invitee never pays" },
        { id: "feature-family-1", label: "Up to 4 relationships" },
        { id: "feature-family-2", label: "Everything in Single" },
        { id: "feature-family-3", label: "Save and reuse My Templates" },
        { id: "feature-family-4", label: "Invitees never pay" },
        { id: "feature-annual-1", label: "1 relationship for a year" },
        { id: "feature-annual-2", label: "Everything in Single" },
        { id: "feature-annual-3", label: "2 months free vs monthly" },
        { id: "feature-annual-4", label: "Invitee never pays" },
      ],
    },
    {
      /**
       * The strip under the grid. It carries no plan *name* of its own: `{plan}` is filled from
       * the catalogue by whatever plan the ribbon marks, so the nudge cannot point at one plan
       * while the ribbon sits on another.
       */
      id: "unsure",
      items: [
        { id: "unsure-lead", label: "Not sure?" },
        {
          id: "unsure-body",
          label:
            "Start with the most popular: the {plan} plan — one relationship, any template, no card.",
        },
        { id: "unsure-cta", label: "Start With the Most Popular" },
      ],
    },
    {
      id: "billing",
      heading: "How Billing Works",
      items: [
        {
          id: "step-1",
          label: "Pick a Template",
          body: "Your plan is saved while you choose.",
        },
        {
          id: "step-2",
          label: "Set Up and Invite",
          body: "Your trial starts when they accept. No card.",
        },
        {
          id: "step-3",
          label: "Add a Card When Ready",
          body: "Only after the trial, if you want to keep going.",
        },
      ],
    },
    {
      id: "faq",
      heading: "Questions",
      body: "Answers about the assessment, the plans and the data behind them.",
      items: [
        { id: "search-placeholder", label: "Search questions..." },
        { id: "no-results", label: 'No results found for "{query}"' },
        { id: "no-results-hint", label: "Try a different search term or" },
        { id: "clear-search", label: "clear your search" },
        { id: "contact-prompt", label: "Still have questions?" },
        { id: "contact-link", label: "Send us a message from the contact form" },
      ],
    },
    {
      id: "cta",
      heading: "Start Your First Relationship",
      body: "7 days free. No card. Your invitee never pays.",
      items: [{ id: "get-started", label: "Browse Templates" }],
    },
  ],
});
