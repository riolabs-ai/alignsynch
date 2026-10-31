/**
 * The account the shell's header renders — the session's own identity, never a fixture (#212).
 *
 * The header used to print a hardcoded demo person: a placeholder monogram, a made-up name and a
 * made-up handle, out of `data/pages/shell.ts`. Signed in as the demo **Admin**, `/leaderboard`
 * and every other page behind the shell announced a stranger — the chrome disagreed with the
 * session it was rendered inside. A copy fixture is the wrong place to store a person, so the
 * person is not stored at all: this module reads the request's session and derives the three
 * fields the header renders from it.
 *
 * What the header gets, and where each field comes from:
 *
 *   name    `user_profile.display_name` when the person has saved a profile, else the name the
 *           auth provider holds, else the email's local part. It is the initials source and the
 *           line under the avatar.
 *   handle  `user_profile.handle` when there is a row, else the email's local part, else the auth
 *           user id. It is the `@handle` line **and the avatar's colour seed** — the same pair
 *           `/profile/<handle>` and `/leaderboard` hand `GeneratedAvatar` (#152), so one person is
 *           one monogram and one gradient everywhere in the app.
 *   email   the session's address. Never the brand's support mailbox acting as one.
 *
 * Both fallbacks are deliberate. A brand-new account has an auth user and no `user_profile` row
 * until it first saves `/settings` (`lib/db/user-profiles.ts` calls that out), and `user.name` is
 * empty when the provider holds no name — so "no handle yet" is a state the shell has to render
 * honestly rather than a reason to reach for a fixture. The chain always ends on something stable
 * for that user, which is what keeps the gradient a pure function of identity: no index, no
 * `Math.random()`, no clock, so the server and the browser paint the same disc and a screenshot
 * diff stays still (`components/media/generated-avatar.tsx` explains the same constraint).
 *
 * **Why `cookies()` is read here, before the session.** `currentUser()` wraps its session fetch in
 * a `try` that answers `null` for *any* failure — correct for a request, but it also swallows the
 * control-flow error Next throws when a dynamic API is used during static generation. Called from
 * a layout without this line, a production build would prerender every page behind the shell with
 * a signed-out header and the swallow would make the build look clean. Touching the cookie store
 * first, outside any `catch`, opts the route into dynamic rendering where a session can exist, so
 * the shell is rendered per request by the only caller that has one.
 *
 * **And why the auth env is checked first.** `lib/auth/server.ts` throws when
 * `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` are missing, on purpose — a deployment that
 * forgot them must not look like an endless signed-out session. The gate and CI build with
 * neither set (`AGENTS.md`: the gate is database-free and needs no auth secret), and a `build`
 * that throws on every page is not the way to report it. `lib/auth/config.ts::authConfigured()` is
 * the one place that question is answered (the feature flags' admin bypass asks it too), so no
 * auth configuration means no session *can* exist, the shell renders its signed-out state, and the
 * page stays prerenderable instead of pretending to be dynamic. `/settings` still surfaces the
 * missing configuration to anyone who asks for a protected page.
 */
import { currentUser, type SessionUser } from "@/lib/auth/session";
import { DEFAULT_USER_ROLE, type UserProfile, type UserRole } from "@/content/identity";
import { readUserProfileByUserId } from "@/lib/db/user-profiles";
import { cookies } from "next/headers";
import { authConfigured } from "@/lib/auth/config";

/** What the header renders for the signed-in person. Plain data: it crosses to a client component. */
export interface ShellAccount {
  /** The display name — the initials source and the line under the avatar. Never empty in practice. */
  readonly name: string;
  /** The stable identity: the `@handle` line, and the seed `GeneratedAvatar` colours from. */
  readonly handle: string;
  /** The session's own address. */
  readonly email: string;
}

/** `avery@demo.alignsynch.test` -> `avery`; a string with no `@` is returned as it is. */
function localPartOf(email: string): string {
  const at = email.indexOf("@");
  return (at > 0 ? email.slice(0, at) : email).trim().toLowerCase();
}

/** The first candidate with a letter in it, or `""`. Order is the caller's decision. */
function firstOf(...candidates: readonly (string | undefined)[]): string {
  for (const candidate of candidates) {
    const trimmed = (candidate ?? "").trim();
    if (trimmed !== "") return trimmed;
  }
  return "";
}

/**
 * The header's account, as a pure function of a session and (optionally) the profile row.
 *
 * Split out from the request so `tests/shell-account.test.ts` can drive every branch — the
 * provider's name, a saved profile, and the brand-new account that has neither handle nor name —
 * without a cookie store, a database or a Next runtime. `null` means signed out: there is no
 * third state, and no branch here can invent a person.
 */
export function shellAccountOf(
  user: SessionUser | null,
  profile: UserProfile | null,
): ShellAccount | null {
  if (user === null) return null;

  const email = user.email.trim();
  const local = localPartOf(email);
  const handle = firstOf(profile?.handle, local, user.userId).toLowerCase();
  const name = firstOf(profile?.displayName, user.name, local, handle);

  return { name, handle, email };
}

/** The signed-in person's saved profile, or `null` — an unreadable row is not a failed request. */
async function profileOf(userId: string): Promise<UserProfile | null> {
  try {
    return await readUserProfileByUserId(userId);
  } catch (error) {
    // The shell is chrome on every page: a database that cannot be read for one row must not take
    // the page down with it. The session still knows a name, so the header renders that instead of
    // a stranger — and the log line is how an operator learns the profile read is broken.
    console.error("shell-account: user_profile could not be read — using the session alone", error);
    return null;
  }
}

/**
 * The chrome's two server-resolved facts, from **one** session read and **one** profile read.
 *
 * The header needs the account; the sidebar needs the role (to decide which destinations a viewer
 * carries, `lib/nav.ts`). Both are functions of the same two reads, so asking twice would be a
 * second auth-server round trip and a second `user_profile` query on every page behind the shell.
 * This is the one function that pays for them, and `shellAccount()` below is the header's half of
 * it — unchanged for the callers that only ever wanted a name.
 *
 * `role` follows `lib/auth/require-role.ts`'s rule for a missing row or an unreadable one:
 * `DEFAULT_USER_ROLE` (`member`). That is the **closed** direction — a failed profile read can only
 * under-grant, never hand somebody the console — and it matches what `roleOfUser()` answers for the
 * same person, so the menu and the page's gate cannot disagree about who is an admin.
 */
export interface ShellSession {
  readonly account: ShellAccount | null;
  readonly role: UserRole | null;
}

/** The signed-in person and the role this request resolves to, or `null`s when nobody is. */
export async function shellSession(): Promise<ShellSession> {
  if (!authConfigured()) return { account: null, role: null };

  await cookies();

  const user = await currentUser();
  if (user === null) return { account: null, role: null };

  const profile = await profileOf(user.userId);
  return {
    account: shellAccountOf(user, profile),
    role: profile?.role ?? DEFAULT_USER_ROLE,
  };
}

/**
 * The signed-in person for this request, or `null` when nobody is.
 *
 * Request-time by construction: with auth configured this reads the cookie store (which is what
 * makes the calling route dynamic — see the module comment), so a signed-out visitor and a
 * signed-in admin cannot share one cached shell.
 */
export async function shellAccount(): Promise<ShellAccount | null> {
  return (await shellSession()).account;
}
