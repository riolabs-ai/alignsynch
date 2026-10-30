/**
 * Where a login round-trip may return to (issue #164).
 *
 * Pure string handling, in its own module for one reason: both halves of the round-trip live in
 * different runtimes. `/settings` and `/dashboard/user` build the redirect **on the server**
 * (`lib/auth/session.ts` needs a session for that, and a session is not a browser thing), while
 * the sign-in view and the settings form read it back **in the browser**. Importing the session
 * module into a client component would drag `@neon/auth/next/server` into the bundle, so the two
 * functions that only touch a string live here instead.
 *
 * The rule they encode is the one an open redirect is built from: a `next` value is a **path on
 * this site**, never an absolute or protocol-relative URL. `//evil.example` and
 * `https://evil.example` both fail the test, and both are what an attacker puts in a link that
 * looks like a login page.
 */

/** The page a signed-in person lands on when nothing else was asked for. */
export const AFTER_SIGN_IN = "/dashboard/user";

/** `/login?next=<path>` — the redirect an unauthenticated visit gets, remembering where it went. */
export function loginPathFor(next: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(next))}`;
}

/**
 * The inverse: a `?next=` value that is safe to navigate to, or the default.
 *
 * `startsWith("/")` alone is not enough — `//host/path` is protocol-relative and leaves the site —
 * so the second character is checked too.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0) return AFTER_SIGN_IN;
  if (!next.startsWith("/") || next.startsWith("//")) return AFTER_SIGN_IN;
  return next;
}
