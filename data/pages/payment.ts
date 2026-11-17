/**
 * `/dashboard/payment` — the member's billing surface (#1132).
 *
 * The surface ports `docs/specs/v2-bundles/08-spec-design-page-payment-v2/payment.html`: one
 * **billing panel per relationship** (Status, Trial Ends, After the Trial, Card), one note and its
 * actions; the aside's three cards (Payment Method, Billing History, How Trials Work); and the
 * Counterparty's view, which is one sentence and no money at all.
 *
 * **Every word here is the bundle's, verbatim**, including its Title Case and its curly
 * apostrophe. The prototype's own fixture data is *not* ported: the price is the plan's
 * (`data/billing-plans.ts` Basic, `$8.95`), the dates come from
 * `billing_subscription.current_period_end`, and a relationship's name is its own row's. Only the
 * sentences live here.
 *
 * **What is new, and why — the two states the bundle has no panel for.** The prototype toggles
 * between a card-free trial funnel and a Counterparty preview; it draws no panel for an account
 * with a **paid** subscription (nothing is counting down and nothing is paused) and none for a
 * lapse that was *not* the trial (a cancelled or failed payment read as `Paused` by
 * `lib/relationship/membership.ts`). Those two rows (`badge-paid` + `note-paid`, and
 * `trial-ended`'s sibling `ended`) exist so a paying member and a failed payment are told the
 * truth instead of being drawn as a trial that has not started, or not being drawn at all. Each is
 * a label or one sentence in the bundle's own voice, and nothing else on the surface moves for
 * them.
 *
 * **The copy #1132 forbids is absent on purpose.** The prototype's draft panel used to say the
 * trial starts when you send the invite; the bundle already corrected that, and this fixture says
 * what the rows do — a trial is granted by `grantAcceptanceTrial()` when the Counterparty accepts
 * (`lib/db/billing.ts`), so a draft and a sent invitation both say "when {name} accepts" and spend
 * no day. `tests/payment-panels.test.ts` holds that sentence to the model.
 *
 * Placeholders: `{price}`, `{days}`, `{name}`, `{date}` are the record's own facts, filled by
 * `fillLabel()` at the read. A missing one renders as written rather than as nothing, which is
 * what makes a drift visible in a screenshot.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const paymentPageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Billing",
  heading: "Payment",
  subtitle:
    "Each relationship has its own 7-day free trial, then {price} / month. People you invite are never charged.",
  sections: [
    {
      /**
       * The panels. Field labels, badge words, standing values, the notes and the three actions are
       * all here so the panel component holds no string of its own (E23) — the ids are the join
       * between `lib/billing/payment-view.ts`, which decides *which* row a relationship draws, and
       * this file, which decides what it says.
       */
      id: "memberships",
      heading: "Memberships",
      items: [
        // The `dl`'s field labels, in the order the bundle draws them.
        { id: "status", label: "Status" },
        { id: "trial-ends", label: "Trial Ends" },
        { id: "trial", label: "Trial" },
        { id: "trial-ended", label: "Trial Ended" },
        { id: "ended", label: "Ended" },
        { id: "extra-week", label: "Extra Week" },
        { id: "after-trial", label: "After the Trial" },
        { id: "after-resume", label: "After You Resume" },
        { id: "card", label: "Card" },
        // The statuses. A badge is a word plus a mark, never colour alone (locked rule 2).
        { id: "badge-trial", label: "Free Trial · {days} Days Left" },
        { id: "badge-accept", label: "Trial Starts When {name} Accepts" },
        { id: "badge-not-started", label: "Not Started" },
        { id: "badge-paused", label: "Paused" },
        { id: "badge-paid", label: "Membership Active" },
        // The standing values a field prints.
        { id: "card-none", label: "None on file" },
        { id: "card-not-needed", label: "Not needed" },
        { id: "card-on-file", label: "On file" },
        { id: "extra-week-available", label: "1 Free Week Available" },
        { id: "starts-when", label: "Starts When {name} Accepts" },
        // One note per state — the bundle's five, plus the two the model needs.
        { id: "note-trial", label: "Add a card before {date} to keep Stage 6 running." },
        {
          id: "note-accept",
          label: "Your 7-day free trial starts when {name} accepts. No card needed.",
        },
        {
          id: "note-draft",
          label: "Send the invite. Your 7-day free trial starts when {name} accepts.",
        },
        {
          id: "note-paused",
          label:
            "Stage 6 is paused. Add a card to resume, or take one free extra week. Everything is saved.",
        },
        {
          id: "note-trial-card",
          label: "Your trial ends {date}. Your card is charged then, and Stage 6 keeps running.",
        },
        {
          id: "note-paused-payment",
          label: "Stage 6 is paused. Add a card to resume. Everything is saved.",
        },
        {
          id: "note-paused-extended",
          label:
            "Stage 6 is paused. Add a card to resume. Everything is saved — the free extra week is one time only, and this relationship has used it.",
        },
        { id: "note-paid", label: "Your membership is active. Nothing to do here." },
        // The three actions, and the word the button wears while the write is in flight.
        { id: "add-card", label: "Add a Card" },
        { id: "continue-setup", label: "Continue Setup" },
        { id: "get-week", label: "Get 7 More Days Free" },
        { id: "get-week-pending", label: "Adding the week…" },
        // Names. `with` is the panel's second line; `partner-generic` stands in for a seat whose
        // name the rows do not carry, so a placeholder can never reach the screen.
        { id: "with", label: "With {name}" },
        { id: "partner-generic", label: "the other person" },
        // The one sentence a Memberships list with nothing in it can say.
        { id: "empty", label: "Nothing to bill yet. Relationships you start appear here." },
        /**
         * The read's failure. A member is told what happened to them, not which environment
         * variable is missing — the reason travels in a `data-` attribute for the operator and in
         * the server log, never as the sentence on the page.
         */
        {
          id: "unreadable",
          label:
            "Your billing details could not be loaded just now. Refresh the page to try again.",
        },
      ],
    },
    {
      /**
       * Payment Method. The bundle's inline card form is a **mock** ("Prototype only. Nothing is
       * charged.") and is not ported: since #912 the tree has exactly one card-capture surface —
       * stage 5's pay walk — and this card's action is a door into it.
       */
      id: "payment-method",
      heading: "Payment Method",
      body: "No card on file. You only pay for relationships after their trial.",
      items: [
        {
          id: "saved",
          label:
            "A card is on file. Paused relationships resume now. Trials convert when they end.",
        },
      ],
    },
    {
      id: "billing-history",
      heading: "Billing History",
      body: "No charges yet.",
    },
    {
      id: "how-trials",
      heading: "How Trials Work",
      items: [
        { id: "start", label: "Starts when the other person accepts" },
        { id: "length", label: "7 days free per relationship, no card needed" },
        { id: "lapse", label: "No card when it ends: Stage 6 pauses. Nothing is lost." },
        { id: "extension", label: "One free extra week, once" },
        { id: "cancel", label: "Cancel any time" },
      ],
    },
    {
      /**
       * The Counterparty's whole view (locked rule 5): one sentence, split where the bundle draws
       * the emphasis — the first clause bold, the second plain. `subtitle` is the page header's
       * line for a reader who pays for nothing.
       */
      id: "coverage",
      items: [
        { id: "subtitle", label: "Nothing to pay here." },
        { id: "covered", label: "{initiator} covers this relationship." },
        { id: "free", label: "You’re never charged." },
        { id: "aria", label: "Coverage" },
      ],
    },
  ],
});
