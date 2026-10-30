/**
 * `POST /api/profile` — the only write in the identity surface (issue #164).
 *
 * The route exists so that "editing your profile" is one guarded HTTP verb rather than a server
 * action hidden in a form: a server action is still a POST, but its authorization is a function
 * nobody can call with `curl`, and the card's acceptance asks for exactly that — *a direct
 * unauthenticated POST to a mutating handler returns 401*. This is that handler.
 *
 * Order of operations, which is the whole security argument:
 *
 *   1. `currentUser()` — resolve the session from the request's cookies, server-side. No user ⇒
 *      401 and the body is never read, so an unauthenticated caller cannot even probe the
 *      validation.
 *   2. Parse the body as the model's own shape (`zProfileFields`, inside `writeUserProfile`).
 *      `strict()`: an unknown key is a 400, never a silently carried field.
 *   3. Write **that** user's row. The `userId` comes from the session and is never accepted from
 *      the request — a caller cannot name the row they write.
 *
 * `GET` is the read half, and it is guarded the same way: it answers the caller's *own* profile
 * (or 404 when they have not saved one), never somebody else's. The public read is
 * `/profile/<handle>`, which is a page, not this API.
 *
 * `force-dynamic`: the route resolves the session per request, so it must never be prerendered.
 */
import { publicProfileOf } from "@/content/identity";
import { currentUser } from "@/lib/auth/session";
import { readUserProfileByUserId, writeUserProfile } from "@/lib/db/user-profiles";

export const dynamic = "force-dynamic";

/** A JSON answer with a status, so every branch of both verbs says the same thing. */
function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The signed-in person's own profile — 401 when there is no session, 404 when none is saved. */
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (user === null) return json({ error: "unauthenticated" }, 401);

  const profile = await readUserProfileByUserId(user.userId);
  if (profile === null) return json({ error: "no-profile" }, 404);

  return json({ profile: publicProfileOf(profile) }, 200);
}

/** Save the signed-in person's profile. 401 without a session, 400/409 with a bad body. */
export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (user === null) return json({ error: "unauthenticated" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid", message: "body is not JSON" }, 400);
  }

  const outcome = await writeUserProfile(user.userId, body);
  if (!outcome.ok) {
    // `handle-taken` is a conflict the form puts on the handle field; `invalid` is the model's
    // own rejection with the schema's message, so the form can show the field that failed.
    const status = outcome.reason === "handle-taken" ? 409 : 400;
    return json({ error: outcome.reason, message: outcome.message }, status);
  }

  return json({ profile: publicProfileOf(outcome.profile) }, 200);
}
