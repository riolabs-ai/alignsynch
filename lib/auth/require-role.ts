/**
 * Who may reach an admin surface — and what a refusal looks like (#183, part 1 of 2).
 *
 * The rule this module exists for: **a refusal is never a 403.** A 403 is an answer, and an
 * answer is a confirmation — "this page exists, you are just not allowed in it" tells someone
 * probing the app exactly which URLs are worth attacking. So a signed-in person without the
 * role gets `notFound()`, which is the same 404 a URL that never existed returns, and a signed-
 * out person is sent to `/login` (a page that is public anyway) rather than told the surface
 * exists. Nobody who fails the check can tell a gated page from an absent one.
 *
 * Three states, and they are different:
 *
 *   signed out          → redirect to `/login?next=<where they were going>`
 *   signed in, wrong    → 404
 *   signed in, right    → the session and the role, and the caller proceeds
 *
 * **Server-side, and only server-side.** The decision is made from the request's own cookies
 * (`lib/auth/session.ts` resolves the session) and from `user_profile.role` read out of
 * Postgres; no part of it is a prop, a query string or a client claim, and nothing here is a
 * hint a component may render. That is why this module is not imported by a client component:
 * it reaches `pg` through `@/lib/db/user-profiles`, which cannot be bundled for the browser, and
 * the module-scope guard below turns a mistaken import into a loud failure rather than a
 * silently different answer in the browser. The repo has no `server-only` package on purpose
 * (adding one is a dependency), so the guard is the marker (`lib/db/client.ts` records the same
 * construction).
 *
 * The gate returns a grant instead of only throwing so a caller that wants to *use* the admin
 * (to read their own name, to log an action) does not have to ask twice.
 *
 * `roleAnswerFor()` is the whole policy as a pure function, and `tests/require-role.test.ts`
 * drives every branch of it with no session and no database — the questions "is a member
 * refused with a 404" and "is a signed-out visitor redirected rather than refused" are answerable
 * without a request.
 */
import { notFound, redirect } from "next/navigation";

import { DEFAULT_USER_ROLE, roleAdmits, type UserRole } from "@/content/identity";
import { loginPathFor, AFTER_SIGN_IN } from "@/lib/auth/paths";
import { currentUser, type SessionUser } from "@/lib/auth/session";
import { readUserProfileByUserId } from "@/lib/db/user-profiles";

/**
 * A mistaken client import fails loudly. `window` exists only in the browser, so this is the
 * one place the module can answer "am I on the server" without a dependency.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "lib/auth/require-role.ts is server-only: it reads the session and user_profile. Call it from a page, a server action or a route handler.",
  );
}

/* ------------------------------------------------------------------ *
 * The policy
 * ------------------------------------------------------------------ */

/** What the check decided. `allow` carries the role it *used*, not the role that was asked for. */
export type RoleAnswer =
  | { readonly kind: "allow"; readonly role: UserRole }
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "not-found" };

/** Where a signed-out visitor is sent. Public either way — `/login` is on the nav. */
export const DEFAULT_ROLE_NEXT = AFTER_SIGN_IN;

export interface RoleQuestion {
  /** The role the surface requires. `admin` is the only one anything gates today. */
  readonly needed: UserRole;
  readonly signedIn: boolean;
  /** `user_profile.role`, or `null` when the person has no profile row yet. */
  readonly role: UserRole | null;
  /** Where a signed-out visitor was going, so `/login` can bring them back. A path on this site. */
  readonly next?: string;
}

/**
 * The whole decision, as a value.
 *
 * A missing profile row is **not** a privilege: `null` is normalised to `DEFAULT_USER_ROLE`
 * (`member`), the same value the column defaults to, so "signed in but never saved settings"
 * and "signed in as a member" are answered identically. There is no order between the roles
 * (`roleAdmits` is equality), so a member is refused whatever the surface requires and there is
 * no comparison to get backwards.
 *
 * The `next` handed to `/login` goes through `loginPathFor`, which refuses an absolute or
 * protocol-relative value — an open redirect built out of a URL that looks like a login page is
 * exactly what that function exists to stop.
 */
export function roleAnswerFor(question: RoleQuestion): RoleAnswer {
  if (!question.signedIn) {
    return { kind: "redirect", to: loginPathFor(question.next ?? DEFAULT_ROLE_NEXT) };
  }
  const role = question.role ?? DEFAULT_USER_ROLE;
  if (!roleAdmits(question.needed, role)) return { kind: "not-found" };
  return { kind: "allow", role };
}

/* ------------------------------------------------------------------ *
 * The server reads the policy needs
 * ------------------------------------------------------------------ */

/**
 * The role a person is, from their profile row. `member` when they have no row — absence is the
 * default value, not an error (`DEFAULT_USER_ROLE`).
 *
 * A failed read throws. That is deliberate and it is the one distinction worth keeping: a
 * database that is down must not answer "404" on an admin surface, because a 404 is a
 * permission answer and this is an outage. The page fails, loudly, which is what a caller can
 * act on.
 */
export async function roleOfUser(userId: string): Promise<UserRole> {
  const profile = await readUserProfileByUserId(userId);
  return profile?.role ?? DEFAULT_USER_ROLE;
}

/** A granted check: who asked, and the role that let them through. */
export interface RoleGrant {
  readonly user: SessionUser;
  readonly role: UserRole;
}

/**
 * The gate. Call it at the top of a page, a layout, a server action or a route handler:
 *
 *   const { user } = await requireRole("admin");
 *
 * It returns or it answers — it never returns `null` for the caller to forget to check, and it
 * never throws a 403. `redirect()` and `notFound()` both throw a control-flow signal in Next,
 * so a caller cannot accidentally continue past a refusal.
 */
export async function requireRole(
  needed: UserRole,
  options: { readonly next?: string } = {},
): Promise<RoleGrant> {
  const user = await currentUser();
  const role = user === null ? null : await roleOfUser(user.userId);
  const answer = roleAnswerFor({
    needed,
    signedIn: user !== null,
    role,
    ...(options.next === undefined ? {} : { next: options.next }),
  });

  if (answer.kind === "redirect") redirect(answer.to);
  if (answer.kind === "not-found") notFound();

  // `answer.kind === "allow"` here, and `user` is non-null for the same reason: the only branch
  // that reaches this line required `signedIn`. Stated with a guard rather than a cast so the
  // assertion is checked if the policy ever changes.
  if (user === null) notFound();
  return { user, role: answer.role };
}

/** The one gate anything asks for today. Kept named so call sites read as intent, not as a role. */
export async function requireAdmin(options: { readonly next?: string } = {}): Promise<RoleGrant> {
  return requireRole("admin", options);
}
