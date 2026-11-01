/**
 * Who is asking — the server's answer, not the browser's (issue #164).
 *
 * Every protected read and every write goes through this module. The rule the card is explicit
 * about is that **authorization is server-side**: a page that hides a button, or a `redirect()`
 * that runs after the data was already read, is not enforcement. Here the session is resolved
 * from the request's own cookies by Neon's auth server on every call, and a caller that has no
 * user cannot proceed — there is no client-supplied identity anywhere in the path, and no
 * `userId` is ever accepted from a request body.
 *
 * Three states, and they are different:
 *
 *   a session          → `SessionUser`
 *   no session         → `null` (the caller redirects or answers 401)
 *   auth not configured → a thrown error naming the missing variable, because "signed out" would
 *                        turn a deployment mistake into an endless `/login` redirect, which is
 *                        the hardest kind of bug to see.
 *
 * `currentUser()` is deliberately narrower than the SDK's session: the app needs the id (the join
 * key to `user_profile`), the email (shown read-only on `/settings`) and the name (the display
 * name a brand-new account starts with). Nothing else from the auth user is copied into a page,
 * because nothing else is ours.
 */
import { authConfigured } from "@/lib/auth/config";
import { neonAuth } from "@/lib/auth/server";
import { grantAdminIfAllowlisted } from "@/lib/auth/admin-allowlist";

/** The session as the app uses it. No token, no session id, no roles. */
export interface SessionUser {
  /** Neon Auth's user id — `user_profile.user_id`. */
  readonly userId: string;
  readonly email: string;
  /** What the person typed at sign-up; empty when the provider holds no name. */
  readonly name: string;
}

/**
 * The signed-in person, or `null`.
 *
 * The auth server is built **outside** the `try` on purpose: `neonAuth()` throws when
 * `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` are missing, and that is a configuration
 * error the caller should surface, not a session that happens not to exist. Only the request
 * itself is guarded — a session fetch that fails (upstream 5xx, a reset connection) is treated
 * as "no session", because a page cannot do anything useful with a half-answered auth call and
 * a 500 on `/settings` would hide the real state.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const auth = neonAuth();
  let sessionUser: SessionUser;
  try {
    const result = await auth.getSession();
    const user = result?.data?.user;
    if (user === undefined || user === null) return null;
    sessionUser = {
      userId: user.id,
      email: user.email,
      name: typeof user.name === "string" ? user.name : "",
    };
  } catch (error) {
    console.error("auth: getSession failed — treating the request as signed out", error);
    return null;
  }
  // The allowlist grant is outside the `try`: a failed session read is "signed out", but the
  // grant must not be swallowed into that answer. It never throws (it fails closed and logs), and
  // it is the one place a session's user is promoted after sign-in (`lib/auth/admin-allowlist.ts`).
  await grantAdminIfAllowlisted(sessionUser);
  return sessionUser;
}

/**
 * The session, when this deployment could have one at all — `null` when it could not (#184's
 * rule, applied to a write that only *records* who was there).
 *
 * `currentUser()` deliberately throws on a missing `NEON_AUTH_*`, because a page behind an auth
 * wall that treats a configuration mistake as "signed out" sends everyone to `/login` forever.
 * The flow's two writes are the other case: creating and claiming an assessment work with no
 * account at all (#146 shipped them that way), and binding an account is an addition to that,
 * not a gate on it. So a tree with no auth env keeps working — `party.user_id` stays NULL,
 * exactly as a signed-out request's does — instead of turning `POST /assessment/new` into a 500
 * because a secret is missing.
 *
 * This is the same shape as `currentRole()` in `lib/auth/require-role.ts`: ask
 * `authConfigured()` first, then read the session, and let an outage with auth configured keep
 * answering the way `currentUser()` documents.
 */
export async function currentUserIfConfigured(): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  return currentUser();
}
