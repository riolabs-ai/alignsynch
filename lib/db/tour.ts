/**
 * The first-run tour's per-person "seen" mark — `user_profile.tour_seen_at` (#456).
 *
 * One column, one rule, two statements:
 *
 *   `NULL`      not seen — the tour shows (`data/pages/tour.ts` is S1's; the decision is here)
 *   an instant  seen — completing or dismissing the tour writes `now()`, replay clears it (#458)
 *
 * `tourStateOf()` is the whole rule as a pure function, so a page, a route handler and a test
 * cannot disagree about what "seen" means: `NULL ⇒ false`, anything parseable ⇒ `true` plus the
 * instant. Nothing compares that instant against another one; as with `party.unlock_seen_at`
 * (0007), NULL-versus-non-NULL is the fact, and the timestamp is kept for support questions
 * ("when was this dismissed?") rather than for logic.
 *
 * **Why this module is not `lib/db/user-profiles.ts`.** That file is the settings form's path and
 * its `COLUMNS` list is the model's fields (`content/identity.ts::zUserProfile`). The tour mark is
 * not one of them: no form writes it, `publicProfileOf()` drops it, and putting it in the model
 * would carry it through every profile read in the tree. The row is the profile's; the mark is
 * not the profile. Keeping it in its own module also keeps this card's diff out of the files S3
 * and S4 are likely to touch.
 *
 * **Why a route handler writes it and no component does (#453).** A React Server Component render
 * cannot write — Next 16 refuses `cookies().set()` there, and a row write during render has the
 * same problem one layer down: a render may run more than once, and a side effect that runs twice
 * is not a fact about the reader. `app/api/tour/route.ts` owns every write here, resolves the
 * session itself, and takes the `userId` from that session — never from the request body. No
 * `"use client"` module value-imports this file, so `data:check` E34 has nothing to catch and the
 * browser has no build for `pg`.
 *
 * **An absent row is unseen, and the first completion provisions one.** A brand-new account has
 * an auth user and no `user_profile` row until `/settings` is first saved — `lib/auth/shell-account.ts`
 * records that state and the shell renders it honestly. A plain `UPDATE … WHERE user_id = $1`
 * would match nothing for exactly the people a first-run tour is for, the mark would never land,
 * and the tour would show on every sign-in: the nag #454 rules out. So `seen = true` is an
 * upsert, and the row it creates carries a **provisioned** identity rather than a guess at the
 * person's URL:
 *
 *   handle        the email's local part when it survives `zHandle` — which is the same `@handle`
 *                 the shell header already prints for them (`lib/auth/shell-account.ts` falls
 *                 back to it), so provisioning changes nothing a reader sees — else
 *                 `user-<fragment of the auth user id>`, which is unique because the id is.
 *   displayName   the provider's name, else the email's local part, else `Member`.
 *
 * Both are the "first save" values, not a claim: `/settings` overwrites them the first time the
 * person saves, and `writeUserProfile` does not mention `tour_seen_at` at all, so saving your
 * profile can never mark the tour. Clearing (`seen = false`) never provisions — a missing row is
 * already "unseen", so replay (#458) has nothing to create.
 */
import { z } from "zod";

import { DISPLAY_NAME_MAX, HANDLE_MAX, zDisplayName, zHandle } from "@/content/identity";
import { queryRows } from "@/lib/db/client";
import { isoInstantOf } from "@/lib/db/rows";

/* ------------------------------------------------------------------ *
 * The state
 * ------------------------------------------------------------------ */

/**
 * What a page or a route handler needs to know, and nothing else. Plain data: the shape crosses
 * to a client component as props (a `type` import is erased, so E34 stays clean).
 */
export interface TourState {
  /** `false` ⇒ the tour has never been completed or dismissed for this person. */
  readonly seen: boolean;
  /** When it was marked, ISO-8601, or `null` when it is unseen. Never compared to a clock. */
  readonly seenAt: string | null;
}

/** The whole rule: no instant means unseen. `receivedAt` is `tour_seen_at`, in either shape `pg` returns. */
export function tourStateOf(seenAt: Date | string | null): TourState {
  if (seenAt === null) return { seen: false, seenAt: null };
  return { seen: true, seenAt: isoInstantOf(seenAt) };
}

/** One `user_profile` row's mark. Named after the column so the SELECT and this type cannot drift. */
interface TourRow {
  readonly tour_seen_at: Date | string | null;
}

/** The signed-in person's own mark. A person with no profile row has none: unseen. */
export async function readTourState(userId: string): Promise<TourState> {
  const rows = await queryRows<TourRow>(
    "SELECT tour_seen_at FROM user_profile WHERE user_id = $1",
    [userId],
  );
  return tourStateOf(rows[0]?.tour_seen_at ?? null);
}

/* ------------------------------------------------------------------ *
 * The provisioned identity a first completion needs
 * ------------------------------------------------------------------ */

/** `avery.person@example.test` -> `avery.person`; a string with no `@` is returned whole. */
function localPartOf(email: string): string {
  const at = email.indexOf("@");
  return (at > 0 ? email.slice(0, at) : email).trim().toLowerCase();
}

/** Every run of characters a handle cannot carry becomes one hyphen, and the ends are trimmed. */
function slugOf(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The candidates, in the order they are tried, each already bounded to the handle's shape. */
export function provisionedHandles(email: string, userId: string): string[] {
  const bounded = (value: string): string =>
    value.slice(0, HANDLE_MAX).replace(/-+$/g, "").replace(/^-+/g, "");
  const candidates = [bounded(slugOf(localPartOf(email))), bounded(`user-${slugOf(userId)}`)];
  const usable = candidates.filter((candidate) => zHandle.safeParse(candidate).success);
  if (usable.length === 0) {
    throw new Error(
      `no usable handle for a provisioned profile (email and user id both slug to nothing): ${userId}`,
    );
  }
  return usable;
}

/** The provider's name, else the email's local part, else `Member` — never an empty string. */
export function provisionedDisplayName(name: string, email: string): string {
  const candidates = [name.trim(), localPartOf(email), "Member"];
  for (const candidate of candidates) {
    if (candidate === "") continue;
    const parsed = zDisplayName.safeParse(candidate.slice(0, DISPLAY_NAME_MAX));
    if (parsed.success) return parsed.data;
  }
  return "Member";
}

/* ------------------------------------------------------------------ *
 * The write
 * ------------------------------------------------------------------ */

/** Who the mark belongs to, as the session resolved it. No `userId`: the caller passes that. */
export interface TourIdentity {
  readonly email: string;
  readonly name: string;
}

/**
 * What a write answers. `handle-taken` is the only user-visible failure and it is not this
 * person's fault: two provisioned handles collided, which means somebody already holds the URL
 * the shell would have printed for them. The route answers 409 and the tour simply shows again —
 * a mark that could not be written must not read as written.
 */
export type TourWriteOutcome =
  | { readonly ok: true; readonly state: TourState }
  | { readonly ok: false; readonly reason: "handle-taken"; readonly message: string };

/** Postgres' unique-violation code — the provisioned `handle` is somebody else's row. */
const UNIQUE_VIOLATION = "23505";

/**
 * A Postgres error code, read off the error or off the cause it arrives wrapped in.
 *
 * `queryRows` wraps a failed statement in `DatabaseUnavailableError` with the driver's error as
 * `cause` (`lib/db/client.ts::unavailableBecause`), so `error.code` is one level down and a check
 * that only looks at the top would never see `23505` — the fallback handle would never be tried and
 * a taken handle would surface as a 500. Measured on the demo branch: the unwrapped form throws
 * `duplicate key value violates unique constraint "user_profile_handle_key"` at the top of a
 * `cause` chain, exactly like this.
 */
function postgresCodeOf(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * `seen = true`: mark it, creating the row when this person has none.
 *
 * `ON CONFLICT (user_id)` is the returning-person path — one statement, so two tabs finishing the
 * tour at once cannot half-write it. `updated_at` is deliberately **not** touched: that column is
 * "the profile was saved" (`writeUserProfile` sets it), and a tour completion is not the person
 * saying anything about their profile. `RETURNING tour_seen_at` reads back what landed, so the
 * answer is the row's value rather than the value this function hoped for.
 */
const MARK_SQL = `
  INSERT INTO user_profile (user_id, handle, display_name, tour_seen_at)
  VALUES ($1, $2, $3, now())
  ON CONFLICT (user_id) DO UPDATE
    SET tour_seen_at = now()
  RETURNING tour_seen_at`;

/**
 * `seen = false`: clear it. No row is not a failure — an absent row already means unseen, so
 * replay (#458) needs to create nothing and a brand-new account's "replay" is a no-op.
 */
const CLEAR_SQL = `
  UPDATE user_profile SET tour_seen_at = NULL
   WHERE user_id = $1
  RETURNING tour_seen_at`;

/** Store this person's mark. The caller has already resolved the session. */
export async function writeTourSeen(
  userId: string,
  identity: TourIdentity,
  seen: boolean,
): Promise<TourWriteOutcome> {
  if (!seen) {
    const rows = await queryRows<TourRow>(CLEAR_SQL, [userId]);
    return { ok: true, state: tourStateOf(rows[0]?.tour_seen_at ?? null) };
  }

  const displayName = provisionedDisplayName(identity.name, identity.email);
  const handles = provisionedHandles(identity.email, userId);
  for (const handle of handles) {
    try {
      const rows = await queryRows<TourRow>(MARK_SQL, [userId, handle, displayName]);
      return { ok: true, state: tourStateOf(rows[0]?.tour_seen_at ?? null) };
    } catch (error) {
      // A provisioned handle that is already a URL tries the next candidate; anything else is a
      // real failure and belongs to the caller (a 500 is honest for a broken database).
      if (postgresCodeOf(error) !== UNIQUE_VIOLATION) throw error;
    }
  }
  return {
    ok: false,
    reason: "handle-taken",
    message: "the provisioned profile handle is already in use",
  };
}

/**
 * The request body `POST /api/tour` accepts — `strict()`, so an unknown key is a 400 rather than
 * a silently carried field, exactly like `zProfileFields` on `/api/profile`.
 *
 * There is no `userId` here on purpose: the row is the session's, and a body that could name a
 * user would be a route where one person marks another person's tour.
 */
export const zTourWrite = z.object({ seen: z.boolean() }).strict();

export type TourWriteRequest = z.infer<typeof zTourWrite>;
