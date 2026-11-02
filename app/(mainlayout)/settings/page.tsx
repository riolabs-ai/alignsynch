/**
 * `/settings` — the signed-in person's own profile (issue #164).
 *
 * A **server** module, and that is the security boundary rather than a rendering detail:
 * `currentUser()` resolves the session from the request's cookies before anything is read, and
 * an unauthenticated request never reaches a database read. The redirect is what a browser sees;
 * the denial happened a line earlier, which is the card's "independently of any redirect".
 *
 * What this route is no longer: a tab shell over eight fixture panels. Four of them simulated a
 * save with `setTimeout`, the security panel offered a password change Managed Auth cannot
 * perform from the app, and the profile panel rendered "Alex Johnson". They are unimported now;
 * removing the files is housekeeping for the card that owns those panels' real behaviour.
 *
 * `force-dynamic` for two reasons: the session is per-request, and the build must never try to
 * prerender a page that needs `NEON_AUTH_*` — `pnpm build` passes with neither that nor
 * `DATABASE_URL` set, the same rule `/assessment/[slug]` follows.
 */
import { SettingsView } from "@/components/identity/settings-view";
import { publicProfileOf } from "@/content/identity";
import { settingsPageCopy } from "@/data/pages/settings";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { accountHasPassword } from "@/lib/db/password-reset";
import { readUserProfileByUserId } from "@/lib/db/user-profiles";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { savePassword } from "./password-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Settings",
};

export default async function SettingsPage() {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor("/settings"));

  // A person who signed up before this card existed has no row yet; the form's first save
  // creates one, so the page renders with their auth name as the starting display name.
  const profile = await readUserProfileByUserId(user.userId);

  // Whether there is a password to change, asked of the account rows rather than guessed from a
  // provider id (`lib/db/password-reset.ts::accountHasPassword`). A Google-only account answers
  // `false` and the card offers to set one — the case that makes this card worth having.
  const hasPassword = await accountHasPassword(user.userId);

  return (
    <SettingsView
      copy={settingsPageCopy}
      email={user.email}
      signedInName={user.name}
      profile={profile === null ? null : publicProfileOf(profile)}
      hasPassword={hasPassword}
      savePassword={savePassword}
    />
  );
}
