"use client";

import { authClient } from "./client";

/**
 * End the session — the one step every sign-out control runs (issue #272).
 *
 * Two surfaces offer sign-out: the account page's button (`components/identity/sign-out-button.tsx`)
 * and the shell's sidebar row. The sidebar's was a `href="#"` link: it rendered "Logout", took
 * focus, announced as a link, and revoked nothing — so the cookie stayed valid and the next
 * request was still signed in. Both controls run this function now, which is what stops the step
 * drifting between them.
 *
 * `signOut` reaches `/api/auth/sign-out` through the same-origin proxy, so the session row is
 * revoked **server-side** and the response clears the cookie. A client-side "forget who we are"
 * would leave the cookie valid, which is the failure this exists to avoid.
 *
 * `true` means the session is gone and the caller may navigate; `false` means the SDK reported an
 * error and the caller must say so rather than pretend the person is signed out.
 */
export async function endSession(): Promise<boolean> {
  /**
   * A rejected `signOut` is a failed sign-out, not an exception the caller forgot to catch.
   *
   * `authClient.signOut()` rejects rather than answering `{ error }` when the request itself
   * fails — the gate and CI build with no `NEON_AUTH_BASE_URL`, where `/api/auth/sign-out`
   * answers 500, so the SDK's promise rejects. Without this `try` the caller's `await` throws,
   * its pending state never clears and the control sits on "Signing out…" forever: a button
   * that looks like it is still working, which is the same lie as the link that did nothing.
   */
  try {
    const { error } = await authClient.signOut();
    return !error;
  } catch {
    return false;
  }
}
