import { UserProfile } from "@/components/profile/user-profile";
import { profileByHandle } from "@/lib/profile";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/profile/<username>` — the person is `data/players.ts`, never a literal in this file.
 *
 * `params` is a Promise in Next 16: an unwrapped `params.username` is `undefined`, which is
 * how a page rendered the same default person for every URL (#111). An unknown handle is a
 * 404; the page has no default to fall back to.
 *
 * Titles are brand-free on purpose: the root layout's `title.template` (`%s · <brand>`)
 * composes the brand, so a title that carried it here too would print it twice.
 */
interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = profileByHandle(username);
  if (profile === undefined) {
    return {
      title: "Profile Not Found",
      description: "This user profile could not be found.",
    };
  }

  return {
    title: `${profile.person.name}'s Profile`,
    description: `Check out ${profile.person.name}'s quiz achievements, stats, and more.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const profile = profileByHandle(username);
  if (profile === undefined) notFound();

  return <UserProfile profile={profile} />;
}
