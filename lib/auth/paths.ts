/**
 * Where a login round-trip may return to (issue #164), and where it lands when nothing was
 * asked for (#351).
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
 *
 * ## The destination is per brand (#351)
 *
 * `AFTER_SIGN_IN` is QuizHub's account home. It is **not** every brand's: `/dashboard/user` calls
 * `requireQuizProduct()` before `currentUser()`, so on an AlignSynch build the route answers 404
 * — and because that 404 happens before the session is resolved, the
 * `?neon_auth_session_verifier=` Neon appends to the `callbackURL` is never exchanged and the
 * person lands signed out. So each brand names its own landing page in
 * `AFTER_SIGN_IN_BY_BRAND`, and the alignment brand lands on the console Overview.
 *
 * **This module stays pure string handling.** It is imported by client components
 * (`components/identity/settings-view.tsx`, `components/auth/login-view.tsx`), so it may not
 * import `lib/flags.ts` (server-only, and it throws in a browser) and may not call
 * `resolveBrand` — the brand is resolved by the server module that renders the form and passed
 * down. The `BrandId` import below is type-only and erased at build, and `lib/flow/paths.ts` is
 * a module of constants with no runtime of its own.
 */
import type { BrandId } from "@/data/brand";
import { OVERVIEW_PATH } from "@/lib/flow/paths";

/** QuizHub's signed-in landing page, and the default when no brand is named. */
export const AFTER_SIGN_IN = "/dashboard/user";

/**
 * The page a signed-in person lands on, per brand.
 *
 * `Record<BrandId, string>` is the point, not a convenience: a third brand fails `tsc` here until
 * somebody chooses its destination deliberately, which is the whole defect of #351 — one brand's
 * account home inherited by another.
 *
 * - `quizhub` → `/dashboard/user`, unchanged since #164.
 * - `alignsynch` → `/dashboard` (`lib/flow/paths.ts::OVERVIEW_PATH`), the console Overview: the one
 *   page whose docblock calls itself "what a person sees first after signing in", deliberately
 *   ungated by `requireQuizProduct()`, and it resolves the session first — a landing page that
 *   *establishes* the session instead of a 404 that throws it away.
 */
export const AFTER_SIGN_IN_BY_BRAND: Readonly<Record<BrandId, string>> = {
  quizhub: AFTER_SIGN_IN,
  alignsynch: OVERVIEW_PATH,
};

/** `/login?next=<path>` — the redirect an unauthenticated visit gets, remembering where it went. */
export function loginPathFor(next: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(next))}`;
}

/**
 * The query parameter `/login` reads to know a Google sign-in could not be finished (#351 follow-up).
 *
 * The finish route fails closed — every exchange failure redirects to `/login` signed out, which is
 * byte-for-byte the same page a person who never tried sees. Appending this parameter is how the two
 * are told apart: the page renders its one sentence ("We couldn't finish signing you in…") only for a
 * real attempt that failed, never for a cold visit.
 */
export const GOOGLE_FAILURE_QUERY = "google";

/** The one value that marks a failed finish. Anything else is a cold visit. */
export const GOOGLE_FAILURE_VALUE = "failed";

/**
 * `/login?next=<path>&google=failed` — a failed Google exchange, with the destination remembered so
 * the second attempt still returns the person where they were going.
 */
export function googleFailedLoginPath(next: string): string {
  return `${loginPathFor(next)}&${GOOGLE_FAILURE_QUERY}=${GOOGLE_FAILURE_VALUE}`;
}

/**
 * The inverse: a `?next=` value that is safe to navigate to, or the fallback.
 *
 * `startsWith("/")` alone is not enough — `//host/path` is protocol-relative and leaves the site —
 * so the second character is checked too.
 *
 * `fallback` defaults to `AFTER_SIGN_IN`, so every caller and every test written before #351 keeps
 * the answer it had; a brand-aware caller passes its own destination
 * (`AFTER_SIGN_IN_BY_BRAND[brandId]`). A same-site path is never rewritten here — whether this
 * build actually *ships* it is the server's second question
 * (`lib/auth/next-path.ts::signInDestination`), because only the server may read the flags.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string = AFTER_SIGN_IN,
): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/**
 * An absolute URL for a path on this site: `(origin, "/dashboard")` → `https://host/dashboard`.
 *
 * The Google handshake needs an absolute `callbackURL`, and it used to be composed by gluing the
 * origin and the path together (`${origin}${path}`) — string concatenation where a URL was meant.
 * That is the shape of bug that put a `?neon_auth_session_verifier=…` *into* the path
 * (`/dashboard/user/neon_auth_session_verifier-…`): the moment anything appends to the value with
 * the wrong separator, a signed-in-looking address 404s. `URL` is the fix — it parses the path,
 * keeps its query, its fragment and its percent-encoding exactly, and re-serialises one correct
 * absolute URL.
 *
 * A `path` that names another origin (`//host/x`, `https://host/x`) resolves *off* this site, so
 * it is refused here as well: `safeNextPath` is the caller's first gate, and this is the second,
 * because a value that reaches a `callbackURL` is a value the auth server will send a browser to.
 */
export function absoluteUrlFor(origin: string, path: string): string {
  const base = new URL(origin);
  const target = new URL(path, base);
  if (target.origin !== base.origin) return base.toString();
  return target.toString();
}
