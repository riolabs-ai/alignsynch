/**
 * The account menu's "My Profile" target — the session's own handle, or nothing (#226).
 *
 * This lives in its own module for a build-level reason, not a stylistic one: the header is a
 * **client** component, and `lib/auth/shell-account.ts` imports `lib/db/user-profiles.ts` (which
 * imports `pg`). A `import type` of its `ShellAccount` is erased before the bundle, but a value
 * import of a function defined in that file is not — the browser bundle would then trace into
 * `pg`, and `next build` fails on `Can't resolve 'dns' / 'fs' / 'net'` in the client graph. So the
 * one derivation the header needs is a pure function here, importing the type and nothing else.
 *
 * What it is about: the row used to link a demo player's profile — a row in `data/players.ts`, and a
 * real 200 — so it passed every link check while sending the whole quiz brand (and an alignment
 * admin, who carries `quiz-surfaces`) to a stranger. A fixture handle is not a target: the only
 * person this menu may open is the one the session belongs to, and when there is no session there
 * is no target at all — the caller hides the row rather than reaching for a substitute.
 *
 * `null` is the answer for both "nobody is signed in" and "an account with no handle". There is no
 * third state, and nothing here reads a fixture, so no substitute exists to reach for.
 *
 * Trimmed for the URL only: `ShellAccount.handle` is already lowercased by `shellAccountOf`, and a
 * handle the profile schema allows (`[a-z0-9]` and `-`) needs no escaping.
 */
import type { ShellAccount } from "./shell-account";

/** `/profile/<the session's handle>`, or `null` when there is no person or no handle to open. */
export function accountProfileHref(account: ShellAccount | null): string | null {
  const handle = account?.handle.trim() ?? "";
  return handle === "" ? null : `/profile/${handle}`;
}
