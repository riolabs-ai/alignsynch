/**
 * The broadcast's vocabulary and its numbers, as values with no imports (#507, epic #500).
 *
 * A module of its own because it is the piece **both sides of the client boundary** need: the server
 * action, the module that writes the send and the screen that composes it all speak the same refusal
 * codes and the same cap. `lib/admin/broadcast.ts` cannot be that module — it hashes with
 * `node:crypto` and opens a pool through `act()` — while this file imports nothing at all, so a
 * `"use client"` component may value-import it (the same argument `lib/news/states.ts` makes).
 *
 * **The cap and the window are here, not in the page.** They are the server's policy: the query
 * applies both, the dry run reports both and the screen prints both. A copy of either in a component
 * would be the drift the shared audience function exists to prevent.
 *
 * **A refusal code is not a sentence.** The words are `data/pages/admin-broadcast.ts`, keyed by
 * these strings, and E23 fails the build when the component asks for a code the fixture does not
 * carry — so a new refusal cannot ship as a bare code a person has to guess at.
 */

/**
 * The hard cap: **200 addresses per send**.
 *
 * A ceiling on the blast radius of a mistake, not a performance budget. Reaching more refuses
 * (`over-cap`) rather than truncating: sending to the first 200 of 900 is a broadcast that half
 * happens and a screen that reports success.
 */
export const BROADCAST_MAX_RECIPIENTS = 200;

/**
 * The per-address cooldown: **24 hours**.
 *
 * An address mailed in this window is excluded from the audience and counted instead, so a second
 * click is a refusal that says how many addresses are held and for how long.
 */
export const BROADCAST_COOLDOWN_HOURS = 24;

/** The subject's ceiling: long enough for a sentence, short enough to be a subject line. */
export const BROADCAST_SUBJECT_MAX = 200;

/** The body's ceiling, in characters. A one-off notice, not a newsletter builder. */
export const BROADCAST_BODY_MAX = 20_000;

/**
 * The two segments: everybody who consented, or everybody who consented on/after a date.
 *
 * Here rather than in the read module because the compose screen's radio group posts these values
 * across the client boundary, and `lib/db/**` has no browser build (E34).
 */
export const BROADCAST_SEGMENTS = ["all", "since"] as const;

export type BroadcastSegmentKind = (typeof BROADCAST_SEGMENTS)[number];

/** Is this string one of `BROADCAST_SEGMENTS`? The form's own closed field. */
export function isBroadcastSegmentKind(value: unknown): value is BroadcastSegmentKind {
  return typeof value === "string" && (BROADCAST_SEGMENTS as readonly string[]).includes(value);
}

/**
 * Why a broadcast did not happen — every value a fact about the request, the rows or the
 * deployment, and never a permission.
 *
 * Permissions are `act()`'s (`ActRefused`, and `role-too-low` is the one a `support` session gets
 * because `broadcast.send` is floored at `admin`).
 */
export const BROADCAST_REFUSALS = [
  /** The subject is empty after trimming. */
  "empty-subject",
  /** The body is empty after trimming. */
  "empty-body",
  /** The subject or the body is over its ceiling. */
  "too-long",
  /** A segment kind that is not `all` or `since`. */
  "invalid-segment",
  /** A `since` segment whose date does not parse. */
  "invalid-date",
  /** The segment matches no consented address at all. */
  "no-recipients",
  /** Every consented address in the segment was mailed inside the cooldown window. */
  "cooldown",
  /** The segment is larger than the cap; refused rather than truncated. */
  "over-cap",
  /** The deployment's key is a test key. Refused whatever the screen says. */
  "test-key",
  /** No mail key at all: nothing would go out, so nothing is claimed. */
  "no-mail-key",
] as const;

export type BroadcastRefusal = (typeof BROADCAST_REFUSALS)[number];

/**
 * Every code a caller may see: this file's refusals, plus the three `act()` can answer with at this
 * call site.
 *
 * `act()` has four; `unknown-action` and `unknown-target-table` cannot come from
 * `sendBroadcast()` — both are literals in that function — so they are not given a sentence a
 * person could never reach.
 */
export const BROADCAST_FAILURES = [
  ...BROADCAST_REFUSALS,
  "role-too-low",
  "reason-too-short",
  "signed-out",
] as const;

export type BroadcastFailure = (typeof BROADCAST_FAILURES)[number];

/** Is this string one of `BROADCAST_FAILURES`? The runtime half of the union a result carries. */
export function isBroadcastFailure(value: unknown): value is BroadcastFailure {
  return typeof value === "string" && (BROADCAST_FAILURES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ *
 * The form's two answers
 * ------------------------------------------------------------------ */

/** What the compose screen posts. All `string`, because a form post is all strings. */
export interface BroadcastFormInput {
  readonly subject: string;
  readonly body: string;
  readonly segmentKind: string;
  readonly segmentSince: string;
  readonly reason: string;
}

/** What a dry run answers: counts and the hash, and no field an address could be returned in. */
export type BroadcastPreviewResult =
  | {
      readonly ok: true;
      readonly count: number;
      readonly consented: number;
      readonly heldByCooldown: number;
      readonly overCap: boolean;
      readonly cap: number;
      readonly bodyHash: string;
    }
  | { readonly ok: false; readonly code: BroadcastFailure; readonly detail?: string };

/** What a send answers. `sent` and `failed` are transport outcomes, never addresses. */
export type BroadcastSendResult =
  | {
      readonly ok: true;
      readonly sendId: string;
      readonly actionId: string;
      readonly bodyHash: string;
      readonly recipientCount: number;
      readonly sent: number;
      readonly failed: number;
      readonly keyMode: string;
    }
  | { readonly ok: false; readonly code: BroadcastFailure; readonly detail?: string };
