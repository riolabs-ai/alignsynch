/**
 * The spec register's cached read — one entry, one tag, one refresh control (#1296).
 *
 * **The page must not call GitHub on every render.** `unstable_cache` holds the mapped set under
 * `SPEC_ISSUES_TAG` for 60 seconds, so a render reads Next's data cache and returns; the window is
 * 60 s because the *unauthenticated* REST ceiling is 60 requests an hour — a token makes it
 * comfortable, and an anonymous deployment still sits inside the limit instead of discovering it as
 * a 403 in the middle of an afternoon.
 *
 * **A failure is never an empty register.** Three answers, and the third is the important one:
 *
 *   ready         the set, from the cache or from GitHub
 *   stale         GitHub did not answer, so the last copy *this process* read is served instead —
 *                 the issue column still draws and the page says it is a copy
 *   unavailable   nothing has ever been read, so the page draws the register without the issue
 *                 column and says so
 *
 * Caching `unavailable` too — `unstable_cache` stores whatever the callback returns — is what keeps
 * an outage from making a network call on *every* render: one attempt per window, not one per page
 * view. `specIssuesAnswerOf` is the policy and lives in `lib/spec/issues.ts`, pure, so the three
 * branches are tested without a network; this module supplies the facts and holds the cache.
 *
 * **Where the revalidation is called from, and why it is not a write.** `revalidateTag` is legal in
 * a Server Action and in a Route Handler and nowhere else, so the "Refresh from GitHub" control is
 * a GET at `app/api/admin/spec-issues/refresh/route.ts` that clears the tag and redirects back to
 * the page it was pressed on. It creates nothing, toggles no label, comments nowhere and closes
 * nothing — there is no write path against GitHub in this tree (AS-15), and no server action or
 * mutation route under `/admin/spec`; the refresh lives outside that tree so the spec routes stay
 * free of anything that could be mistaken for one.
 *
 * **`lastGood` is module state on purpose.** It is a best effort, not a store: a restarted process
 * has nothing to serve and degrades to `unavailable`, which is the honest answer for a machine that
 * has never reached GitHub. Nothing is written to Postgres, no table is added, and two servers
 * answering differently is a cache, not a disagreement — the register itself is still
 * `data/spec/validation.json`.
 */
import { unstable_cache } from "next/cache";

import { specIssuesAnswerOf, type SpecIssuesRead, type SpecIssuesReady } from "./issues";
import { fetchSpecIssues } from "./issues-github";

/** The cache tag the refresh control clears. One spelling, imported by the route handler. */
export const SPEC_ISSUES_TAG = "spec-issues";

/** How long a mapped set is served before GitHub is asked again. */
export const SPEC_ISSUES_REVALIDATE_SECONDS = 60;

/**
 * The cached read. `unstable_cache` keys on the argument list and on the callback, so the constant
 * `[]` is what makes every request share one entry; the tag is what the refresh control clears.
 */
const readCached = unstable_cache(
  async (): Promise<SpecIssuesRead> => fetchSpecIssues(),
  [SPEC_ISSUES_TAG],
  { tags: [SPEC_ISSUES_TAG], revalidate: SPEC_ISSUES_REVALIDATE_SECONDS },
);

/** The last set this process read — what a failed cache read falls back to. */
let lastGood: SpecIssuesReady | null = null;

/**
 * What the page reads. Wrapped so a cache layer that throws (a cold start, a corrupt entry) is
 * still a degraded column rather than a 500 — this function has no failure mode.
 */
export async function readSpecIssues(): Promise<SpecIssuesRead> {
  let fresh: SpecIssuesRead;
  try {
    fresh = await readCached();
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(`[spec-issues] the cached read threw (${name})`);
    fresh = { kind: "unavailable", reason: "failed" };
  }

  const served = specIssuesAnswerOf(fresh, lastGood);
  if (fresh.kind === "ready") lastGood = fresh;
  return served;
}
