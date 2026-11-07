/**
 * The payment door — the one place a screen and a server action agree about payment (#t_e9212bf9).
 *
 * #619 shipped the engine: a method can be captured, a fee charged, a relationship completed. What
 * it did not ship is a **door** — `capturePaymentMethodAction` and `completeRelationshipAction` were
 * exported and nothing in `components/` called them, so a member with both sheets sealed could not
 * add a card, could not pay and could not open the Gap.
 *
 * Two things the door needs that neither layer owned before, and both live here:
 *
 *   1. **One refusal vocabulary.** The pure model (`lib/flow/payment.ts::PAYMENT_REFUSALS`) says
 *      `method-required` / `not-ready` / `expired` / `already-charged` / `charge-declined` /
 *      `not-the-payer`. The server action answers `payment-method-required` /
 *      `not-ready-to-complete` / `payment-expired` — the names of the writes' exceptions. A screen
 *      that looks its sentence up by the action's code finds nothing and prints the raw code, which
 *      is what a fixture keyed on one vocabulary and an action answering in the other produces.
 *      `paymentRefusalOf()` is that translation, in one function, and
 *      `tests/payment-door.test.ts` reads `actions.ts` and fails on a code it does not cover.
 *   2. **A view model with no clock in it.** The trial date a payer reads is `charge_due_at`, the
 *      instant `recordMethodCaptured()` stored at capture — never `new Date() + 7 days` computed in
 *      a render, which is the React #418 hydration trap (`AGENTS.md` § Pitfalls). `chargeDueAt` is
 *      handed down as an ISO string and the screen formats it with `formatDate`.
 *
 * **`canComplete` is a courtesy, never the enforcement.** The action refuses on its own, from the
 * row it reads and re-reads under the lock; this field only decides whether the band says "add a
 * method" or "take the fee". `lib/member/payment.ts::completeRelationship` is the authority.
 *
 * Pure: no `pg`, no `process.env`, no `new Date()`, no React — so `"use client"` components may
 * import it (E34) and a test drives every branch with literals.
 */
import {
  type PaymentFacts,
  type PaymentPhase,
  type PaymentRefusal,
  PAYMENT_REFUSALS,
  chargeDueAtOf,
  completionRefusalOf,
  paymentDeadlineOf,
  paymentPhaseOf,
} from "@/lib/flow/payment";

/**
 * The action's code → the one word the screen's sentence is keyed on.
 *
 * Every entry names a member of `PAYMENT_REFUSALS`, so a fixture holds one sentence per word and
 * both write paths draw from it. `already-charged` is deliberately **absent**: the library answers a
 * second completion with an idempotent `{ ok: true }` (the fee landed; there is nothing to refuse),
 * so that word never reaches a screen from a code — the fixture carries its sentence anyway for the
 * band that draws an already-paid relationship, which reads it from the phase.
 */
export const PAYMENT_REFUSAL_OF_CODE = {
  "payment-method-required": "method-required",
  "not-ready-to-complete": "not-ready",
  "not-the-payer": "not-the-payer",
  "charge-declined": "charge-declined",
  "payment-expired": "expired",
} as const satisfies Record<string, PaymentRefusal>;

/**
 * Codes a payment action can answer that are **not** payment facts: the session ended, the row is
 * somebody else's, the tier cannot carry a fee, the write failed. They are refused by the same
 * actions and need a sentence, but they are not words about the obligation — they are drawn from
 * the surface's own `refusals` section, which already carries them.
 *
 * The split is explicit so the test can prove the union covers every code `actions.ts` returns: a
 * code in neither list is a refusal a member reads as a raw token.
 */
export const PAYMENT_PASSTHROUGH_CODES = [
  "signed-out",
  "no-such-relationship",
  "not-yours",
  "invalid-plan",
  "failed",
] as const;

/** The screen's word for an action's code, or `null` when the code is not a payment fact. */
export function paymentRefusalOf(code: string): PaymentRefusal | null {
  const known = PAYMENT_REFUSAL_OF_CODE as Readonly<Record<string, PaymentRefusal>>;
  return known[code] ?? null;
}

/** Every word a payment sentence can be keyed on — the fixture's ids, asserted by the test. */
export const PAYMENT_SENTENCE_IDS: readonly string[] = [...PAYMENT_REFUSALS];

/**
 * A relationship's obligation, as one screen reads it.
 *
 * `chargeDueAt` is the stored `charge_due_at` when the row carries one, and `capturedAt + 7 days`
 * otherwise — the same arithmetic `chargeDueAtOf()` does, over an instant the row already holds.
 * Neither branch reads a clock.
 */
export interface PaymentDoor {
  readonly phase: PaymentPhase;
  /** The fee, integer cents. */
  readonly amountCents: number;
  /** When the fee is taken. ISO, or `null` when no method is on file. */
  readonly chargeDueAt: string | null;
  /** When the fee landed. ISO, or `null`. */
  readonly chargedAt: string | null;
  /** When "sealed and unpaid" expires — `sealedAt + 14 days`. ISO, or `null`. */
  readonly paymentDeadlineAt: string | null;
  /** May the payer complete right now? A courtesy; the action refuses independently. */
  readonly canComplete: boolean;
  /** Why not — the word the band's sentence is keyed on. `null` when nothing is in the way. */
  readonly refusal: PaymentRefusal | null;
}

/** An instant → ISO, or `null`. Kept here so a band cannot print `Invalid Date`. */
function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** A fact's instant (a `Date` from `pg`, or an ISO string) → a `Date`, or `null`. */
function instantOf(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The door's view of one obligation.
 *
 * `sealed` is the fact the engine's own pre-flight uses (`sealedOf()` in `lib/member/payment.ts`):
 * both seats answered every Aspect **and** both accepted. A screen that offered the fee before the
 * seal would be offering a charge for a Gap that does not exist, which is exactly the clause
 * `chargeDueOf()` refuses to drop.
 */
export function paymentDoorOf(input: {
  readonly facts: PaymentFacts | null;
  readonly sealed: boolean;
  readonly amountCents: number;
  /** The instant the read was handed — never a clock this module reads. */
  readonly now: Date;
}): PaymentDoor {
  const { facts, sealed, amountCents, now } = input;
  const phase = paymentPhaseOf(facts, now);
  const due =
    facts === null
      ? null
      : facts.chargeDueAt === undefined || facts.chargeDueAt === null
        ? chargeDueAtOf(facts.methodCapturedAt)
        : new Date(facts.chargeDueAt);
  const deadline = paymentDeadlineOf(facts?.sealedAt ?? null);
  const refusal = sealed ? completionRefusalOf(facts) : "not-ready";
  return {
    phase,
    amountCents,
    chargeDueAt: iso(due),
    chargedAt: iso(facts === null ? null : instantOf(facts.chargedAt)),
    paymentDeadlineAt: iso(deadline),
    canComplete: refusal === null,
    refusal,
  };
}
