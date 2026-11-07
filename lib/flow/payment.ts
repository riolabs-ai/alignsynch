/**
 * Pay to complete — the payment fact, derived from stored instants (#619).
 *
 * #619 moves the charge from **creation** to **completion**, and this module is the decision half
 * of that move: what the obligation's phase is, whether it arms a completion, when the charge is
 * due, when the relationship may be expired, and which nag is owed. The write paths
 * (`lib/member/payment.ts`, `lib/db/relationship-payment.ts`) carry out the answers, and the
 * scheduled job (`lib/flow/payment-jobs.ts`) asks this module what is due — it never decides for
 * itself.
 *
 * **Four facts are rows and three are derived.**
 *
 * | fact                     | where it lives                                  |
 * | ------------------------ | ----------------------------------------------- |
 * | a method came on file    | `relationship_payment.method_captured_at`        |
 * | the fee was taken        | `relationship_payment.charged_at`                |
 * | attempts and the first failure | `charge_attempts`, `first_failed_at`       |
 * | the terminal outcome     | `expired_at`, `expire_reason`                    |
 * | the 7-day charge delay   | `method_captured_at + 7 days`                    |
 * | the 14-day payment window| the **second** `party.accepted_at` + 14 days     |
 * | the day-3 / day-10 nags  | that same sealed instant + 3 and +10 days         |
 *
 * The last three are arithmetic over instants the rows already hold, so they are functions here
 * rather than columns — the rule `lib/flow/state.ts` states for the session's status (#146) and
 * `lib/flow/invite-state.ts` states for an invitation's. A stored deadline would have to be
 * backfilled for every session that completed before this card (inventing an obligation nobody
 * had) and would drift the moment a seat is re-accepted.
 *
 * **No clock of its own.** `now` is an argument everywhere. A render never reads a clock (the
 * React #418 hydration trap), and a job hands down the one instant it decided to run at, so a test
 * pins "day 3 has arrived" exactly.
 *
 * **Not measured is a third answer, not `false`.** `paymentArmedOf(null)` is `undefined`: a
 * relationship created before this card has no obligation row, and calling that "unpaid" would
 * flip every existing completed session back into a payment state. `instanceStatusOf()` therefore
 * reads `false` as a gate and `undefined` as "nobody asked", and `relationship_payment` is written
 * at creation from now on, so every new relationship is measured.
 *
 * Pure: no `pg`, no `process.env`, no `new Date()`, no React. `tests/flow-payment.test.ts` drives
 * every branch with literals.
 */

/** One day, in milliseconds. `86_400_000` is not a leap-second question here — these are windows. */
export const DAY_MS = 86_400_000;

/**
 * How long a captured method may sit before the fee is taken (#619's kept trial).
 *
 * The delay is on the **charge**, never on the obligation: the method is required before the
 * session may complete, and this is only how long the money waits.
 */
export const METHOD_TRIAL_DAYS = 7;

/**
 * How long "both sheets sealed, nobody has paid" may live before the relationship expires (#619).
 *
 * Measured from the **second** acceptance — the instant both sheets were sealed — not from
 * creation: a relationship that took three weeks to answer must not expire on the day it becomes
 * completable.
 */
export const PAYMENT_WINDOW_DAYS = 14;

/** The two nags, in days after the sheets sealed. `PAYMENT_REMINDER_DAYS` is what the job reads. */
export const PAYMENT_REMINDER_DAYS = [3, 10] as const;

export type PaymentReminderDay = (typeof PAYMENT_REMINDER_DAYS)[number];

/**
 * The retry ladder after a declined charge, in days after the **first** failure.
 *
 * Three retries, the last on day 5 — "retry ×3 across a week" (#619). A seventh day is deliberately
 * not used: the expiry window is measured from the first failure and the ladder must finish inside
 * it, or a retry could be due after the relationship has already expired.
 */
export const CHARGE_RETRY_OFFSET_DAYS = [1, 3, 5] as const;

/** Attempts in all: the initial one plus every retry. `4` is "the ladder is spent". */
export const CHARGE_ATTEMPT_LIMIT = 1 + CHARGE_RETRY_OFFSET_DAYS.length;

/**
 * How long a failing charge is retried before the relationship expires (#619: "then expire").
 *
 * A week, measured from the first failure. The ladder above finishes inside it; this is the
 * backstop for a provider that keeps answering something other than a clean decline.
 */
export const CHARGE_RETRY_WINDOW_DAYS = 7;

/** The terminal reasons, mirroring the `0036` CHECK. A fourth reason needs a migration. */
export const PAYMENT_EXPIRY_REASONS = ["unpaid", "charge-failed"] as const;

export type PaymentExpiryReason = (typeof PAYMENT_EXPIRY_REASONS)[number];

/** The phases a screen and the job both read. `none` is "no method captured yet". */
export const PAYMENT_PHASES = [
  /** Nothing captured: the optional "pay later" branch, and what a fresh row carries. */
  "none",
  /** A method is on file; the fee is scheduled for `charge_due_at` or for completion. */
  "method-on-file",
  /** A charge was attempted and declined; the ladder is running. */
  "retrying",
  /** The fee landed. Terminal, and one fee covers every round. */
  "charged",
  /** The obligation ended without money: `unpaid` or `charge-failed`. Terminal. */
  "expired",
] as const;

export type PaymentPhase = (typeof PAYMENT_PHASES)[number];

/**
 * The facts, as `lib/db/relationship-payment.ts` reads them. Every instant is optional and every
 * one accepts an ISO string as well as a `Date`, because a row read through `pg` is a `Date` and
 * the same facts crossing into a view model are strings (`lib/billing/types.ts` says why).
 */
export interface PaymentFacts {
  readonly methodCapturedAt?: Date | string | null;
  readonly chargedAt?: Date | string | null;
  readonly chargeAttempts?: number | null;
  readonly firstFailedAt?: Date | string | null;
  readonly expiredAt?: Date | string | null;
  readonly expireReason?: string | null;
  /** The instant both sheets were sealed — the **second** `party.accepted_at`. `null` while one is missing. */
  readonly sealedAt?: Date | string | null;
  /** When each nag went out. Absent is "not sent yet" — the job's idempotency. */
  readonly reminderDay3At?: Date | string | null;
  readonly reminderDay10At?: Date | string | null;
}

/** A row's instant → a `Date`, or `null` for absent and unparseable values alike. */
function instantOf(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `from` plus `days`, or `null` when `from` is absent. One helper, so no caller does the arithmetic twice. */
export function plusDays(from: Date | null, days: number): Date | null {
  return from === null ? null : new Date(from.getTime() + days * DAY_MS);
}

/* ------------------------------------------------------------------ *
 * The phase and the gate
 * ------------------------------------------------------------------ */

/**
 * Does this obligation arm a completion? `undefined` means "no obligation row" — not measured.
 *
 * **Armed is not "charged".** #619's sequence is: both accept → the fee is taken → the Gap opens.
 * A method on file with the charge scheduled for day 7 still arms the completion, because the
 * delay is on the money, not on the product. What disarms it is a terminal failure: an expired
 * obligation arms nothing, and neither does one whose ladder has been spent but whose expiry the
 * job has not yet stamped.
 *
 * `false` is therefore the gate, and `undefined` is the honest "this relationship predates the
 * obligation" — a relationship charged at creation under the retired model is not retroactively
 * unpaid.
 */
export function paymentArmedOf(facts: PaymentFacts | null | undefined): boolean | undefined {
  if (facts === null || facts === undefined) return undefined;
  if (instantOf(facts.expiredAt) !== null) return false;
  if (instantOf(facts.chargedAt) !== null) return true;
  if (instantOf(facts.methodCapturedAt) === null) return false;
  if (chargeExhaustedOf(facts)) return false;
  return true;
}

/** The phase, from the facts. See `PAYMENT_PHASES` for what each word means on a screen. */
export function paymentPhaseOf(facts: PaymentFacts | null | undefined, now: Date): PaymentPhase {
  if (facts === null || facts === undefined) return "none";
  if (instantOf(facts.chargedAt) !== null) return "charged";
  if (instantOf(facts.expiredAt) !== null) return "expired";
  if (instantOf(facts.methodCapturedAt) === null) return "none";
  if (instantOf(facts.firstFailedAt) !== null && chargeAttemptsOf(facts) > 0) return "retrying";
  return "method-on-file";
}

/** How many attempts have been made. Absent is `0`, and a negative or fractional count is `0`. */
export function chargeAttemptsOf(facts: PaymentFacts): number {
  const raw = facts.chargeAttempts ?? 0;
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/* ------------------------------------------------------------------ *
 * The two windows
 * ------------------------------------------------------------------ */

/**
 * When the fee is taken for a method captured at `capturedAt`: seven days later (#619).
 *
 * Stored as `charge_due_at` at capture time so a reader states the same instant a second time
 * without re-deriving it, and so a job can index on it.
 */
export function chargeDueAtOf(capturedAt: Date | string | null | undefined): Date | null {
  return plusDays(instantOf(capturedAt), METHOD_TRIAL_DAYS);
}

/** When "sealed, unpaid" expires: fourteen days after the **second** acceptance. */
export function paymentDeadlineOf(sealedAt: Date | string | null | undefined): Date | null {
  return plusDays(instantOf(sealedAt), PAYMENT_WINDOW_DAYS);
}

/** When the day-3 nag is owed. */
export function reminderAtOf(
  sealedAt: Date | string | null | undefined,
  day: PaymentReminderDay,
): Date | null {
  return plusDays(instantOf(sealedAt), day);
}

/**
 * Which nag is owed at `now`, or `null`.
 *
 * The **earliest unsent** one, and the day-10 nag does not wait for the day-3 one to have been
 * sent: a job that was down on day 4 still owes both, and the day-10 sentence is the more urgent
 * of them. A nag already sent is never re-sent — that is what the two stamps are for, and it is
 * why this returns a day rather than a boolean.
 */
export function reminderDueOf(input: {
  readonly facts: PaymentFacts;
  readonly now: Date;
}): PaymentReminderDay | null {
  const { facts, now } = input;
  if (instantOf(facts.chargedAt) !== null) return null;
  if (instantOf(facts.expiredAt) !== null) return null;
  const sealedAt = instantOf(facts.sealedAt);
  if (sealedAt === null) return null;

  const sent = facts as PaymentFacts & {
    readonly reminderDay3At?: Date | string | null;
    readonly reminderDay10At?: Date | string | null;
  };
  const day3 = reminderAtOf(sealedAt, 3);
  const day10 = reminderAtOf(sealedAt, 10);
  if (day10 !== null && now >= day10 && instantOf(sent.reminderDay10At) === null) return 10;
  if (day3 !== null && now >= day3 && instantOf(sent.reminderDay3At) === null) return 3;
  return null;
}

/* ------------------------------------------------------------------ *
 * The first charge
 * ------------------------------------------------------------------ */

/**
 * Is the fee owed and not yet taken — the trial falling due?
 *
 * Five conditions and every one of them is a row: a method is on file, **both sheets are sealed**,
 * no charge landed, no failure is on the ladder, and the seven-day delay has run out.
 *
 * The seal is required even though the delay is measured from the capture. The fee buys a completed
 * assessment, so an obligation nobody sealed owes nothing however long the method sits — the job
 * must never take money for a Gap that does not exist, and the fourteen-day unpaid window (which
 * *is* measured from the seal) is what ends that obligation instead.
 *
 * The failure clause hands the obligation to `chargeRetryAt()`: once a charge has been declined the
 * ladder owns the schedule, and two schedules both claiming the same day is how one fee gets taken
 * twice.
 */
export function chargeDueOf(input: { readonly facts: PaymentFacts; readonly now: Date }): boolean {
  const { facts, now } = input;
  if (instantOf(facts.chargedAt) !== null) return false;
  if (instantOf(facts.expiredAt) !== null) return false;
  if (instantOf(facts.methodCapturedAt) === null) return false;
  if (instantOf(facts.sealedAt) === null) return false;
  if (instantOf(facts.firstFailedAt) !== null) return false;
  const due = chargeDueAtOf(facts.methodCapturedAt);
  return due !== null && now.getTime() >= due.getTime();
}

/* ------------------------------------------------------------------ *
 * Charge retries
 * ------------------------------------------------------------------ */

/**
 * When the next charge attempt is due, or `null` when there is nothing to retry.
 *
 * `charge_attempts` counts the **initial** attempt, so an obligation that has failed once has
 * `attempts = 1` and the first retry is due a day after `first_failed_at`. The offset is read from
 * the ladder by index, which makes "retry ×3" a constant rather than a loop someone has to count.
 */
export function chargeRetryAt(facts: PaymentFacts): Date | null {
  if (instantOf(facts.chargedAt) !== null) return null;
  if (instantOf(facts.expiredAt) !== null) return null;
  const firstFailedAt = instantOf(facts.firstFailedAt);
  if (firstFailedAt === null) return null;
  const attempts = chargeAttemptsOf(facts);
  const offset = CHARGE_RETRY_OFFSET_DAYS[attempts - 1];
  return offset === undefined ? null : plusDays(firstFailedAt, offset);
}

/** Has the ladder been spent? The initial attempt plus every retry is `CHARGE_ATTEMPT_LIMIT`. */
export function chargeExhaustedOf(facts: PaymentFacts, now?: Date): boolean {
  if (instantOf(facts.firstFailedAt) === null) return false;
  if (chargeAttemptsOf(facts) >= CHARGE_ATTEMPT_LIMIT) return true;
  const firstFailedAt = instantOf(facts.firstFailedAt);
  if (now === undefined || firstFailedAt === null) return false;
  return now.getTime() >= firstFailedAt.getTime() + CHARGE_RETRY_WINDOW_DAYS * DAY_MS;
}

/* ------------------------------------------------------------------ *
 * Expiry
 * ------------------------------------------------------------------ */

/**
 * Whether the obligation should be expired at `now`, and why — `null` when it should not.
 *
 * The two reasons are checked in order of specificity:
 *
 *   1. **`charge-failed`** — a charge was attempted and the ladder is spent (or the week ran out).
 *      This is the more specific news: the card exists and keeps declining.
 *   2. **`unpaid`** — fourteen days have passed since both sheets sealed and the fee never landed.
 *      That covers "no method was ever captured" and "a method was captured but the charge never
 *      succeeded", which for the reader are the same sentence: nobody paid.
 *
 * An obligation that is already charged or already expired answers `null`: expiry is not a
 * transition to re-run, and `0036` refuses a row carrying both instants.
 */
export function expiryDueOf(input: {
  readonly facts: PaymentFacts;
  readonly now: Date;
}): PaymentExpiryReason | null {
  const { facts, now } = input;
  if (instantOf(facts.chargedAt) !== null) return null;
  if (instantOf(facts.expiredAt) !== null) return null;

  if (chargeExhaustedOf(facts, now)) return "charge-failed";

  const deadline = paymentDeadlineOf(facts.sealedAt);
  if (deadline !== null && now.getTime() >= deadline.getTime()) return "unpaid";
  return null;
}

/* ------------------------------------------------------------------ *
 * The refusal codes
 * ------------------------------------------------------------------ */

/**
 * Why a completion was refused, as one word a screen maps to its own sentence (E23).
 *
 *   not-the-payer        only the relationship's payer — its original initiator — may pay
 *   not-ready            both sheets are not yet sealed (answered **and** accepted by both)
 *   method-required      nothing is on file: capture a method, then complete
 *   already-charged      the fee landed; nothing to do, and no second charge
 *   expired              the obligation ended without money — a new round is a new relationship
 *   charge-declined      the provider refused the card; the ladder will retry, or it is spent
 */
export const PAYMENT_REFUSALS = [
  "not-the-payer",
  "not-ready",
  "method-required",
  "already-charged",
  "expired",
  "charge-declined",
] as const;

export type PaymentRefusal = (typeof PAYMENT_REFUSALS)[number];

/**
 * May this phase be completed right now? `null` means yes; a refusal code means no.
 *
 * Pure, and asked by the write path **before** it opens its transaction, because a refusal that
 * costs a lock is a refusal that could have been answered without one. The transaction re-reads
 * the row under `FOR UPDATE` and refuses again if it moved — the status question is never answered
 * only here.
 */
export function completionRefusalOf(facts: PaymentFacts | null | undefined): PaymentRefusal | null {
  if (facts === null || facts === undefined) return "method-required";
  if (instantOf(facts.chargedAt) !== null) return "already-charged";
  if (instantOf(facts.expiredAt) !== null) return "expired";
  if (instantOf(facts.methodCapturedAt) === null) return "method-required";
  if (chargeExhaustedOf(facts)) return "charge-declined";
  return null;
}
