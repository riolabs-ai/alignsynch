/**
 * `GET|POST /api/tour` — the first-run tour's per-person "seen" state (#456).
 *
 * One guarded HTTP verb for the write, for the reason `app/api/profile/route.ts` gives: the
 * acceptance is a `curl`, and a server action's authorization is a function nobody can call from
 * a shell. It is also the shape that keeps the column unreachable from a client module — the tour
 * component (S1) and the replay control (S4, #458) `fetch()` this route, so no `"use client"` file
 * value-imports `lib/db/**` and `data:check` E34 has nothing to catch in either direction.
 *
 * **Writes never happen during render (#453).** A React Server Component render cannot write —
 * Next 16 refuses `cookies().set()` there, and a row written during a render is the same defect
 * one layer down, because a render is not a single guaranteed-once event. The render side is the
 * read only: a page calls `readTourState()` from `lib/db/tour.ts` and passes a `TourState` down;
 * every change comes through `POST` here.
 *
 * Order of operations, which is the whole security argument:
 *
 *   1. `currentUser()` — the session is resolved from the request's cookies, server-side. No user
 *      ⇒ 401 and the body is never read, so an unauthenticated caller cannot even probe the
 *      validation.
 *   2. Parse the body with `zTourWrite` — `strict()`, so `{ seen: true, userId: "…" }` is a 400
 *      rather than a route where one person marks another person's tour. `userId` is not a field:
 *      the row written is the session's, always.
 *   3. Write that person's row and answer with what the row now says (`RETURNING`), never with
 *      what the request asked for.
 *
 * `GET` is the read half, guarded the same way, and it answers `{ seen, seenAt }` — `seen: false`
 * is "show the tour", which is what a first sign-in gets and a second one does not.
 *
 * `force-dynamic`: the route resolves a session per request, so it must never be prerendered. It
 * answers 503 rather than 500 when the tree has no connection string, so a build or an
 * environment without `DATABASE_URL` reports the missing configuration instead of a stack trace.
 */
import { currentUser } from "@/lib/auth/session";
import { databaseConfigured, DatabaseUnavailableError } from "@/lib/db/client";
import { readTourState, writeTourSeen, zTourWrite } from "@/lib/db/tour";

export const dynamic = "force-dynamic";

/** A JSON answer with a status and no caching, so every branch of both verbs says the same thing. */
function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The one answer a missing connection string gets, from either verb. */
function unavailable(): Response {
  return json(
    {
      error: "unavailable",
      message: "DATABASE_URL is not set — the tour mark has nowhere to be stored",
    },
    503,
  );
}

/** A database that stopped answering is a 503 that names the cause, not a 500. */
function fromDatabase(error: unknown): Response | null {
  if (!(error instanceof DatabaseUnavailableError)) return null;
  return json({ error: "unavailable", message: error.reason }, 503);
}

/** The signed-in person's own mark — 401 when there is no session. */
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (user === null) return json({ error: "unauthenticated" }, 401);
  if (!databaseConfigured()) return unavailable();

  try {
    return json(await readTourState(user.userId), 200);
  } catch (error) {
    const answered = fromDatabase(error);
    if (answered !== null) return answered;
    throw error;
  }
}

/**
 * Mark the tour seen (`{"seen": true}`) or unseen (`{"seen": false}`, which is #458's replay).
 * 401 without a session, 400 for a bad body, 409 when the provisioned profile handle collided.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (user === null) return json({ error: "unauthenticated" }, 401);
  if (!databaseConfigured()) return unavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid", message: "body is not JSON" }, 400);
  }

  const parsed = zTourWrite.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return json({ error: "invalid", message }, 400);
  }

  try {
    const outcome = await writeTourSeen(
      user.userId,
      { email: user.email, name: user.name },
      parsed.data.seen,
    );
    if (!outcome.ok) {
      return json({ error: outcome.reason, message: outcome.message }, 409);
    }
    return json(outcome.state, 200);
  } catch (error) {
    const answered = fromDatabase(error);
    if (answered !== null) return answered;
    throw error;
  }
}
