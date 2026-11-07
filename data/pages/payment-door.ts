/**
 * The payment door's copy — one home for both member surfaces (#t_e9212bf9).
 *
 * The door is drawn on two screens (`/dashboard/relationships` and
 * `/dashboard/relationships/[id]`) by one component, and the component writes no strings of its own
 * (E23 attributes it to both routes, so a literal there would have to live in two fixtures at once).
 * The sentences therefore live here, and each surface spreads them into its own `PageCopy` — the
 * screen that renders them is unchanged; where they come from is one file instead of two copies that
 * could drift apart on the day the wording changes.
 *
 *   payment            what is owed, how it is paid, when it is taken, and the two controls
 *   payment-refusals   one sentence per `PAYMENT_REFUSALS` word — the **pure** vocabulary, never the
 *                      action's codes (`payment-method-required`, `not-ready-to-complete`,
 *                      `payment-expired`). `lib/member/payment-door.ts::paymentRefusalOf()` is the
 *                      one translation between them, and `tests/payment-door.test.ts` fails the
 *                      build when a code the action can answer has no sentence here.
 *
 * **No clock, no arithmetic, no amount.** `{amount}` and `{date}` are filled by the band from the
 * door the read computed: the fee in integer cents through the repo's one currency formatter, and
 * `{date}` from `charge_due_at` — the instant `recordMethodCaptured()` stored — never from a clock a
 * render read.
 */
import type { PageCopySection } from "../../content/pages";

export const paymentDoorSections: readonly PageCopySection[] = [
  {
    id: "payment",
    heading: "Payment",
    body: "One fee covers this relationship, every round. The charge waits 7 days after you add a method, and it is only taken once both of you have answered every Aspect and accepted.",
    items: [
      { id: "method", label: "Payment method" },
      { id: "method-none", label: "None on file" },
      { id: "method-on-file", label: "Card on file" },
      { id: "fee", label: "Relationship fee" },
      {
        id: "nothing-today",
        label:
          "Nothing is charged today. Your {amount} fee is taken 7 days after you add a method.",
      },
      { id: "due", label: "Your {amount} fee is taken on {date}." },
      { id: "charged", label: "Paid {amount} on {date}. The Gap is open to both of you." },
      {
        id: "retrying",
        label:
          "The {amount} charge did not go through. The card is retried on a fixed ladder, and you can add another method meanwhile.",
      },
      {
        id: "expired",
        label:
          "The payment window closed on {date} and nothing was charged. A new round is a new relationship.",
      },
      { id: "capture", label: "Add a payment method" },
      { id: "capturing", label: "Opening the payment form…" },
      { id: "activate", label: "Activate Relationship" },
      { id: "activating", label: "Taking the fee…" },
      { id: "gap", label: "Gap Analysis" },
      {
        id: "captured-notice",
        label: "Your payment method is on file. Nothing has been charged yet.",
      },
      {
        id: "failed-notice",
        label: "No payment method was saved. Nothing was charged — you can try again.",
      },
    ],
  },
  {
    id: "payment-refusals",
    items: [
      {
        id: "method-required",
        label: "This relationship has no payment method yet. Add one, then activate it.",
      },
      {
        id: "not-ready",
        label: "The fee is taken once both of you have answered every Aspect and accepted.",
      },
      {
        id: "not-the-payer",
        label: "Only the person who started this relationship can pay for it.",
      },
      {
        id: "already-charged",
        label: "This relationship is already paid for, and the report is open to both of you.",
      },
      {
        id: "expired",
        label:
          "This relationship's payment window closed without the fee being taken. A new round is a new relationship.",
      },
      {
        id: "charge-declined",
        label:
          "The card was declined. We retry on a fixed ladder, and another method can be added meanwhile.",
      },
      { id: "invalid-plan", label: "That tier cannot carry a relationship fee." },
      /**
       * The passthrough codes — refused by the same actions, but facts about the session or the
       * row rather than about the obligation (`PAYMENT_PASSTHROUGH_CODES`). They live here so the
       * band's one lookup is total: a code with no row would be printed verbatim at a member.
       */
      { id: "signed-out", label: "Your session ended. Sign in and try again." },
      { id: "no-such-relationship", label: "That relationship is not in this database." },
      { id: "not-yours", label: "This relationship belongs to another account." },
      { id: "failed", label: "The change did not go through. Nothing was charged." },
    ],
  },
];
