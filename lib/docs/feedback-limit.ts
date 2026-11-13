/**
 * How many notes one admin may file inside a window (#894).
 *
 * **The bucket is a digest, never an identity.** `bucketHashOf()` from `lib/forms/ip.ts` — the
 * function the contact form, the news signup and the auth proxy already count with — turns the
 * signed-in actor's id into a 32-character digest, so the only thing a counter holds is "the same
 * person as those four". That is the shape the card asks for, and it is the same shape as
 * `form_guard_attempt`, without a row in it.
 *
 * **Why this is an in-process counter and the public forms' is not.** `lib/forms/attempts.ts` is
 * right about `news` and `auth`: a limit that resets on every cold start is a suggestion, so those
 * counters live in Postgres. This one cannot, for two reasons that are both decisions on this card:
 * a note writes **no row anywhere** ("the issue is the record"), so there is no table to count in
 * without adding one, and the surface is not public — `requireAdmin()` has already refused every
 * caller who is not an admin of this installation. What the window is for here is a brake: a
 * panel stuck in a retry loop, or a double submit, filing five issues in ten seconds. Held per
 * instance is honest for that job, and the docstring says so rather than implying a wall.
 *
 * The alternative — a `docs_feedback` form kind in `form_guard_attempt` — was measured and
 * rejected: the table's `form` column accepts the value, so it would work, but the counter would
 * then be the only trace of a note, in a table whose docstring promises it holds attempts and not
 * records. A refused note is not an attempt to keep.
 */
import { bucketHashOf } from "@/lib/forms/ip";

/** Five notes per ten minutes: room for a review pass, not for a loop. */
export const FEEDBACK_RATE_MAX = 5;

/** The window the limit counts over. */
export const FEEDBACK_RATE_WINDOW_MS = 10 * 60 * 1_000;

/** The digest of one actor, namespaced so it cannot collide with a client or address bucket. */
export function feedbackBucketOf(actorId: string): string {
  return bucketHashOf(`docs-feedback:${actorId}`);
}

/** Stamps per bucket, oldest first. Module scope, so it survives the request and not the process. */
const attempts = new Map<string, number[]>();

/** How many of the stamps fall inside the window ending at `now`. Pure, so it is a test. */
export function windowCountOf(stamps: readonly number[], now: number, windowMs: number): number {
  const from = now - windowMs;
  return stamps.filter((stamp) => stamp > from).length;
}

export interface FeedbackWindowVerdict {
  /** Whether this note may be filed. */
  readonly allowed: boolean;
  /** How many attempts the bucket had inside the window, before this one. */
  readonly recent: number;
}

/**
 * Count this attempt and answer whether it is inside the budget.
 *
 * Every attempt is recorded, refused or not — the same rule `attempts.ts` states, for the same
 * reason: if only the admitted ones were counted, the sixth submit would always see five and the
 * window would never close.
 */
export function decideFeedbackWindow(input: {
  readonly bucket: string;
  readonly now: number;
  readonly windowMs?: number;
  readonly max?: number;
}): FeedbackWindowVerdict {
  const windowMs = input.windowMs ?? FEEDBACK_RATE_WINDOW_MS;
  const max = input.max ?? FEEDBACK_RATE_MAX;
  const from = input.now - windowMs;

  const kept = (attempts.get(input.bucket) ?? []).filter((stamp) => stamp > from);
  const recent = kept.length;
  kept.push(input.now);
  attempts.set(input.bucket, kept);

  return { allowed: recent < max, recent };
}

/** Empty the counter. For tests: a suite must not inherit another case's window. */
export function resetFeedbackWindows(): void {
  attempts.clear();
}
