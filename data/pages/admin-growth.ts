/**
 * `/admin/growth` — the growth model's copy (#920).
 *
 * Every word on the screen is here, and the rule the fixture encodes is this screen's own: **a
 * chart is a claim about a business, so it says where the numbers came from**. Each band carries a
 * body that names the artifact (`data/demo/growth-model.json`), the command that writes it
 * (`pnpm growth`) and the check that holds it (`pnpm growth:check`) — because an operator reading a
 * $3M ramp has to be able to tell a solved model from a mock-up.
 *
 * Three consequences of that rule, visible in the items below:
 *
 *   - the solve is a **stat**, not a footnote: `stat-solve` prints the acquisition index and the
 *     pass count, so "the target was reached" is a number a reader can re-derive;
 *   - the invoice band is a **table**, not a fourth chart, because "2,125 invoices failed" is a
 *     count to reconcile, not a shape to eyeball;
 *   - `unreadable-*` is a panel, not an empty state: a missing artifact renders the reason and the
 *     command that writes it, never a page of zeroes. "No revenue" because nobody could read the
 *     file is the one lie this screen must not tell.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminGrowthPageCopy: PageCopy = zPageCopy.parse({
  heading: "Growth model",
  subtitle:
    "Thirty-six monthly cohorts on the way to a $3M run-rate: acquisition, the plan mix as the base matures, retention, churn and invoice outcomes. Every number on this page is one committed artifact — data/demo/growth-model.json, written by pnpm growth and held to these bytes by pnpm growth:check.",
  sections: [
    {
      id: "run-rate",
      heading: "Run rate",
      body: "The final month's ARR is the target the model was solved for, not a number tuned by hand: revenue is linear in the acquisition index, so the generator iterates that index until the last month lands inside ±1 % of the target and records the index and the pass count beside it.",
      items: [
        { id: "stat-final-arr", label: "Annual run rate, final month" },
        { id: "stat-target", label: "Solved for" },
        { id: "stat-mrr", label: "Monthly recurring revenue" },
        { id: "stat-accounts", label: "Active accounts" },
        { id: "stat-signups", label: "Signups, all cohorts" },
        { id: "stat-churned", label: "Accounts churned" },
        { id: "stat-solve", label: "Acquisition index" },
        { id: "series-arr", label: "ARR" },
        { id: "series-mrr", label: "MRR" },
        { id: "marker-target", label: "Target {amount}" },
        { id: "axis-month", label: "Month" },
      ],
    },
    {
      id: "retention",
      heading: "Cohort retention",
      body: "Each line is one cohort's share of its acquired accounts still active, by months since it started. The curves flatten because the entry tier churns faster than the upper one, so a cohort started earlier in the ramp — when the mix was heavier on the entry tier — settles lower than a recent one.",
      items: [
        { id: "axis-age", label: "Months since sign-up" },
        { id: "series-retention", label: "Retained" },
      ],
    },
    {
      id: "plan-mix",
      heading: "Plan mix",
      body: "Active accounts per month, split by plan. The mix ramps the way the model documents it: early cohorts land mostly on the entry tier, and the base matures onto the upper one, which is why the upper band widens across the series while the lower one narrows.",
      items: [{ id: "axis-plan-month", label: "Month" }],
    },
    {
      id: "churn",
      heading: "Churn",
      body: "Two rates, because they move separately: logo churn is the share of accounts lost in a month and revenue churn the share of revenue lost from the accounts that stay. Revenue churn sits under logo churn once the base has matured — a smaller share of companies leaving than of dollars.",
      items: [
        { id: "series-logo-churn", label: "Logo churn" },
        { id: "series-revenue-churn", label: "Revenue churn" },
        { id: "axis-churn-month", label: "Month" },
        { id: "axis-churn-percent", label: "% of the base" },
      ],
    },
    {
      id: "invoices",
      heading: "Invoices",
      body: "The operational half of the same model: one invoice per active account per month, with the first attempt's outcome recorded. A failed attempt is retried once in the sampled set, which is why the row count of data/generated/growth/payments.json is higher than the invoices counted here.",
      items: [
        { id: "invoice-plan", label: "Plan" },
        { id: "invoice-issued", label: "Issued" },
        { id: "invoice-paid", label: "Paid" },
        { id: "invoice-failed", label: "Failed" },
        { id: "invoice-refunded", label: "Refunded" },
        { id: "invoice-collected", label: "Collected" },
        { id: "invoice-total", label: "All plans" },
        { id: "invoice-month", label: "Final month, {month}" },
      ],
    },
  ],
  items: [
    {
      id: "footer-provenance",
      label:
        "{command} — {cohorts} cohorts, {churned} accounts churned, {failed} invoices failed and {refunded} refunded across the series.",
    },
    {
      id: "unreadable-heading",
      label: "The growth model could not be read",
    },
    {
      id: "unreadable-body",
      label: "{reason}",
    },
    {
      id: "unreadable-action",
      label: "Write the artifact: pnpm growth --seed 42 --months 36 --target-arr 3000000",
    },
  ],
});
