/**
 * The tour's write half, from the browser (#456) — one `POST` and no opinion about the answer.
 *
 * `lib/db/tour.ts` owns the column and `app/api/tour/route.ts` owns the guarded write; this module
 * is the only thing in the tour that speaks to them, so neither the shell (S1) nor the replay
 * control (S4) has to know a path, a verb or a body shape. A `"use client"` file that value-imported
 * `lib/db/**` would ship `pg` into the browser graph and 500 every route behind the shell
 * (`data:check` E34 exists for exactly that) — a `fetch` to the route is the crossing that is
 * allowed, and this is the one place it is written.
 *
 * **No zod here, on purpose.** The body is one boolean and the route re-validates it with
 * `zTourWrite`; importing the schema would put zod in the browser bundle of every console page for
 * a shape the route already enforces, which is the split `lib/page-copy.ts` exists to keep.
 *
 * **It never throws at the caller.** The mark is bookkeeping about a tour the reader is looking at,
 * so a network failure must not surface as an unhandled rejection inside an effect; the answer is
 * reported as a boolean and a caller that does not care can drop it. The route answers 401 for no
 * session and 503 for no database, and both of those are simply "not marked" — the tour still
 * works, it just shows again next time.
 */

/** The route `app/api/tour/route.ts` answers: `GET` reads the mark, `POST` writes it. */
export const TOUR_MARK_PATH = "/api/tour";

/** The body the route accepts — `zTourWrite` in `lib/db/tour.ts` is { seen: boolean }, strictly. */
export interface TourMarkBody {
  readonly seen: boolean;
}

/**
 * Mark the tour seen (`seen: true`) or unseen (`seen: false`, which is #458's replay).
 *
 * Returns whether the route accepted it. `request` is injectable so a test can drive every branch
 * without a server — the default is the browser's `fetch`.
 */
export async function sendTourMark(seen: boolean, request: typeof fetch = fetch): Promise<boolean> {
  const body: TourMarkBody = { seen };
  try {
    const response = await request(TOUR_MARK_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
