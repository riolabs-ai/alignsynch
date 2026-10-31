/**
 * `/dashboard/user` — the signed-in person's account home (issue #164).
 *
 * Server-rendered, and the session check is the first statement: no session means the request is
 * redirected before any query runs. That is the difference between this page and the one it
 * replaces — the old page was a `"use client"` shell that rendered a fixture on any request,
 * signed in or not, and "protected" only in the sense that nothing had linked to it.
 *
 * The `<Suspense>` wrapper is gone with the client shell: it existed because `DashboardPage`
 * called `useSearchParams()`, and a server component has no such hook. A `tab` query parameter
 * used to select one of the fixture tabs; there are no tabs to select now.
 *
 * `force-dynamic` because the session and the profile row are per-request, and because the build
 * must not need `NEON_AUTH_*` or `DATABASE_URL` — the same rule `/settings` and
 * `/assessment/[slug]` follow.
 */
import { AccountHome } from "@/components/identity/account-home";
import { publicProfileOf } from "@/content/identity";
import { dashboardPageCopy } from "@/data/pages/dashboard";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { requireQuizProduct } from "@/lib/brand-boundary";
import { readUserProfileByUserId } from "@/lib/db/user-profiles";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
};

export default async function Dashboard() {
  // Quiz-only (#300), and the gate comes before the session: the account home this route draws
  // is the quiz dashboard (balance, recent quizzes, quiz stats), and the alignment shell's account
  // chip points at `/settings` instead. A 404 here also means an alignment visitor is never
  // redirected to `/login` for a surface their product does not have.
  requireQuizProduct();
  const user = await currentUser();
  if (user === null) redirect(loginPathFor("/dashboard/user"));

  const profile = await readUserProfileByUserId(user.userId);

  return (
    <AccountHome
      copy={dashboardPageCopy}
      name={user.name}
      email={user.email}
      profile={profile === null ? null : publicProfileOf(profile)}
    />
  );
}
