/**
 * `/admin/billing` — the operator's billing control screen's copy (#505, epic #500).
 *
 * Every word on the screen is here. Three things about the fixture are load-bearing:
 *
 *   - **`mode` is a banner, not a footnote.** The card's first acceptance is that a live-mode row
 *     and a test-mode row are distinguishable on one list, so `mode-banner-*` is a sentence with
 *     the two counts in it (`{test}`, `{billed}`) and the badge words are their own section. A
 *     reader learns how much of this screen is play money without reading a column caption.
 *   - **`refusals` carries the plan limit's own sentence.** `relationship-limit` is what the
 *     server action and the create form both answer when an account has used the relationship its
 *     tier includes — the sentence names the plan and the number, because "limit reached" is a bug
 *     report and "the Free plan includes one active relationship" is a person learning what they
 *     bought.
 *   - **`limits` is the plan table as a reader sees it**, filled from `entitlementForPlan()` — the
 *     same function the gate calls — so a screen saying "Free: 1" cannot disagree with a refusal
 *     that says the same thing. The numbers are `{limit}` placeholders, never authored twice.
 *
 * `plan-source` is the honesty the card asks for in its third hard rule: the tier this screen
 * prints can come from the relationship's own row (an operator's comp), from the account's paid
 * subscription, or from Free because neither exists. The table says which, so nobody has to guess
 * whether a plan name was invented.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminBillingPageCopy: PageCopy = zPageCopy.parse({
  heading: "Billing",
  subtitle:
    "Every relationship's plan, the period it is covered for, the provider state behind it and whether the checkout that bought it ran on test keys. This screen reads; its one write is a comp, and a comp is the owner's.",
  sections: [
    {
      id: "mode",
      heading: "What paid for this",
      body: "A subscription row carries the provider's own live/test flag. Test mode means no money moved: the checkout ran on test keys, the row is real, and nothing about it will ever appear on a statement.",
      items: [
        {
          id: "banner-test",
          label:
            "Test mode — {test} of {billed} subscriptions on this list were bought on test keys, so no money moved for those rows.",
          body: "That is the deployment's state, not a mistake in the data: this build refuses a live provider key, so every checkout it takes is a test checkout. A live row appears here only when one was written by a live-mode provider.",
        },
        {
          id: "banner-live",
          label: "Every subscription on this list was bought on live keys.",
          body: "A live row means a provider charged somebody. The console stores the provider's id and state and never a payment instrument, so there is nothing here to redact.",
        },
        {
          id: "banner-none",
          label: "No subscription on this list carries a provider mode yet.",
          body: "Nothing has been bought against these relationships, so there is no live or test row to draw. Every plan below is the tier the relationship carries or the Free default.",
        },
      ],
    },
    {
      id: "stats",
      heading: "The list in five counts",
      items: [
        { id: "relationships", label: "Relationships" },
        { id: "paid", label: "On a plan" },
        { id: "live", label: "Live subscriptions" },
        { id: "test", label: "Test subscriptions" },
        { id: "granted", label: "Comped or extended" },
        { id: "blocked", label: "At their plan's limit" },
      ],
    },
    {
      id: "columns",
      heading: "Relationships and their plans",
      items: [
        { id: "relationship", label: "Relationship" },
        { id: "template", label: "Template" },
        { id: "account", label: "Account" },
        { id: "plan", label: "Plan" },
        { id: "period-end", label: "Period ends" },
        { id: "provider", label: "Provider" },
        { id: "state", label: "State" },
        { id: "mode", label: "Mode" },
        { id: "grant", label: "Grant" },
      ],
    },
    {
      id: "mode-badge",
      items: [
        { id: "live", label: "Live" },
        { id: "test", label: "Test" },
        { id: "none", label: "Not bought" },
      ],
    },
    {
      id: "status",
      items: [
        { id: "active", label: "Active" },
        { id: "trialing", label: "Trialing" },
        // The provider's word is `past_due`; a copy id is kebab-case, so the join is stated in the
        // view rather than by a `replace()` that would pass an unknown status through silently.
        { id: "past-due", label: "Past due" },
        { id: "canceled", label: "Canceled" },
        { id: "incomplete", label: "Incomplete" },
        { id: "none", label: "No subscription" },
      ],
    },
    {
      id: "plan-source",
      items: [
        { id: "relationship", label: "From this relationship" },
        { id: "subscription", label: "From the account's plan" },
        { id: "free", label: "Free — nothing bought" },
        { id: "none", label: "No account on this relationship" },
      ],
    },
    {
      id: "grant-cell",
      items: [
        { id: "none", label: "None" },
        { id: "comp", label: "Comped" },
        { id: "extend", label: "Extended" },
        { id: "period", label: "{from} to {to}" },
      ],
    },
    {
      id: "limits",
      heading: "How many relationships a plan allows",
      body: "The limit is enforced in the server, on the create that sends an invitation — not by a disabled button. A refused invite names the plan and the number, and a comp is how an operator lifts it.",
      items: [
        { id: "plan-limit", label: "{plan}: {limit}" },
        { id: "unlimited", label: "unlimited" },
        { id: "limit-singular", label: "{limit} active relationship" },
        { id: "limit-plural", label: "{limit} active relationships" },
        {
          id: "blocked-count",
          label: "{blocked} of {accounts} accounts are at their plan's limit.",
        },
        { id: "refusal", label: "{message}" },
      ],
    },
    {
      id: "form",
      heading: "Comp or extend a plan",
      body: "One audited write: the period is granted once, and the row it writes is a grant rather than a purchase — no money moved, so nothing here can be mistaken for a payment.",
      items: [
        { id: "relationship", label: "Relationship" },
        { id: "plan", label: "Tier to grant" },
        { id: "kind", label: "What it does" },
        { id: "kind-comp", label: "Comp — give this tier for the period" },
        { id: "kind-extend", label: "Extend — push this plan's period out" },
        { id: "interval", label: "Period length" },
        { id: "interval-month", label: "One month" },
        { id: "interval-year", label: "One year" },
        { id: "start", label: "Period starts" },
        { id: "submit", label: "Grant the plan" },
        { id: "submitting", label: "Granting…" },
      ],
    },
    {
      id: "floor",
      heading: "Who may comp",
      body: "A comp is an owner action: `plan.comp` is floored at `owner` in `lib/admin/roles.ts`, so an admin reads every row on this page and cannot give a tier away. The button below is drawn either way — the refusal is the server's, not the button's.",
      items: [
        { id: "your-role", label: "Your role: {role}" },
        { id: "may-comp", label: "You may grant a plan." },
        {
          id: "may-not-comp",
          label: "Only an owner may grant a plan. The submit will be refused.",
        },
      ],
    },
    {
      id: "refusals",
      items: [
        {
          id: "no-such-relationship",
          label: "That relationship is not in this database. Reload the page before granting.",
        },
        { id: "unknown-plan", label: "That tier is not one this product sells." },
        { id: "invalid-period", label: "That period start is not a date a period can begin on." },
        {
          id: "period-already-granted",
          label:
            "That period already carries a grant for this relationship. A period is granted once — start the next one at a later date to extend it.",
        },
        {
          id: "role-too-low",
          label: "A comp needs the owner rung. Nothing was written and no audit row exists.",
        },
        {
          id: "signed-out",
          label: "This session ended before the grant was sent. Sign in again and retry.",
        },
        {
          id: "unknown-action",
          label: "This build does not know the comp action. Nothing was written.",
        },
        {
          id: "unknown-target-table",
          label:
            "The audit target this comp names is not one the log records. Nothing was written.",
        },
        { id: "failed", label: "The grant failed before it wrote anything. The reason is above." },
      ],
    },
    {
      id: "done",
      heading: "The grant was written",
      body: "The grant row and its audit row committed together. The relationship now reads on this tier, and the comp is auditable separately from any paid period.",
      items: [
        { id: "logged", label: "Recorded as {action}." },
        { id: "period", label: "Period {from} to {to}." },
        { id: "audit", label: "See the audit log" },
      ],
    },
    {
      id: "empty",
      heading: "No relationships yet",
      body: "This database holds no relationships, so there is no plan to report and nothing to comp. A relationship appears here the moment somebody starts one from a template.",
    },
    {
      id: "unreadable",
      heading: "Billing could not be read",
      body: "This list is read from the database on every visit, and this visit did not get an answer. Nothing here came from a cache and no plan was guessed.",
    },
  ],
});
