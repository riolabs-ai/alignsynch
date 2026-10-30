/**
 * "Is this flagged surface on for the person who just asked?" — the one question a gated route
 * asks, with the session decided server-side (#184).
 *
 * `lib/flags.ts` answers the flag's precedence from its own record and the environment, and it
 * takes the caller's role as an **argument**. Something has to produce that argument from the
 * request, and that something must not be a component, a client hook or a header read — which is
 * what this module is: the bridge between `isEnabled(name, { role })` and the session
 * (`lib/auth/require-role.ts::currentRole`).
 *
 * The order below is the cost order, not just the precedence:
 *
 *   1. the flag's own three steps first — an env override or a `default: true` decides without
 *      touching auth or Postgres, so a surface that is on for everyone stays cheap;
 *   2. then, only for a flag that **opted in** (`adminBypass: true`), the role. A flag that did
 *      not opt in is already decided: `false` is the answer and the session is never read.
 *
 * That second rule is what keeps a tree with no `NEON_AUTH_*` env honest. `currentRole()` answers
 * `null` there rather than throwing, so `/leaderboard` on CI, in the parity render and on a gate
 * run is the plain 404 it has always been — a flagged-off surface must not become a 500 because
 * the box has no auth secret.
 *
 * What this module refuses to accept, by construction: the role arrives from `currentUser()` and
 * `user_profile.role` only. There is no parameter for a header, a cookie, a query string or a
 * prop, so "forged role" is not an input that can be expressed here.
 */
import { declaresAdminBypass, isEnabled } from "@/lib/flags";
import { currentRole } from "@/lib/auth/require-role";
import type { FlagName } from "@/data/flags";

/**
 * The flag's answer for *this request's* caller.
 *
 * `true` when the flag is on by its own precedence, or when it declared `adminBypass` and the
 * session's role is `admin`. `false` for a signed-out visitor and for a member — the same answer,
 * because a caller who may not see a surface and a caller who has no business knowing it exists
 * must not be distinguishable by the response.
 */
export async function enabledForCaller(name: FlagName): Promise<boolean> {
  if (isEnabled(name)) return true;
  if (!declaresAdminBypass(name)) return false;
  return isEnabled(name, { role: await currentRole() });
}
