/**
 * `/profile/<username>` — two kinds of person behind one URL (issue #164).
 *
 * The order of the lookups is the whole change:
 *
 *   1. **`user_profile`** — a real member. Their fields are what they saved on `/settings`, and the
 *      page renders the public projection (`PublicProfile` has no `userId` in it). The session is
 *      resolved only for this branch, and only to decide the owner's affordances; a stranger gets
 *      the same public fields with no way to tell who else is looking.
 *   2. **`data/players.ts`** — one of the ten demo people the leaderboard ranks. Still resolved
 *      exactly as before (`profileByHandle`, unknown handle ⇒ 404), with one addition: the page
 *      says on the page that this is a demo account, because *"no fabricated user data in the
 *      seeded demo — demo people are labelled as demo accounts"* is a requirement here, not a
 *      documentation note.
 *
 * `force-dynamic` because the member branch reads a row and the owner branch reads a cookie. The
 * demo branch is still one function call over a fixture, but a route cannot be half-static: the
 * build must not prerender it either, or a profile saved after deploy would 404 until the next
 * build. The build needs no `DATABASE_URL` for the same reason `/assessment/[slug]` does not.
 *
 * `params` is a Promise in Next 16 — an unwrapped `params.username` is `undefined`, which is how
 * the page once rendered the same default person for every URL (#111).
 */
import { DemoAccountNotice } from "@/components/identity/demo-account-notice";
import { MemberProfile } from "@/components/identity/member-profile";
import { UserProfile } from "@/components/profile/user-profile";
import { isOwner, publicProfileOf } from "@/content/identity";
import { profilePageCopy } from "@/data/pages/profile";
import { currentUser } from "@/lib/auth/session";
import { readUserProfileByHandle } from "@/lib/db/user-profiles";
import { hiddenNavHrefs } from "@/lib/flags";
import { profileByHandle } from "@/lib/profile";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

/** `/profile/<a-b>` and `/profile/<A-B>` are one person; the lookup lowercases like the DB does. */
function handleOf(username: string): string {
  return username.trim().toLowerCase();
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const handle = handleOf(username);

  const member = await readUserProfileByHandle(handle);
  if (member !== null) {
    return {
      title: `${member.displayName}'s Profile`,
      description: `Check out ${member.displayName}'s profile.`,
    };
  }

  const fixture = profileByHandle(handle);
  if (fixture === undefined) {
    return {
      title: "Profile Not Found",
      description: "This user profile could not be found.",
    };
  }

  return {
    title: `${fixture.person.name}'s Profile`,
    description: `Check out ${fixture.person.name}'s quiz achievements, stats, and more.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const handle = handleOf(username);

  const member = await readUserProfileByHandle(handle);
  if (member !== null) {
    // A public page must render even where auth is not configured (a preview without
    // `NEON_AUTH_*`), and the only thing that costs is the owner's own affordance — which
    // grants nothing, so treating "cannot tell who this is" as "a stranger" is safe here.
    const viewer = await currentUser().catch(() => null);
    return (
      <MemberProfile
        copy={profilePageCopy}
        profile={publicProfileOf(member)}
        isOwner={isOwner(member, viewer?.userId)}
      />
    );
  }

  const fixture = profileByHandle(handle);
  if (fixture === undefined) notFound();

  return (
    <>
      <DemoAccountNotice copy={profilePageCopy} />
      {/* Resolved once, on the server, and passed down: `UserProfile` is a client component and
          `lib/flags.ts` throws in a browser (#175 follow-up). The member branch above mounts
          `MemberProfile`, which has no leaderboard link, so it needs nothing. */}
      <UserProfile profile={fixture} hiddenNav={hiddenNavHrefs()} />
    </>
  );
}
