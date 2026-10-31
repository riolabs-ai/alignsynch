/**
 * `/assessment/instances` — "what am I in the middle of?" (#213).
 *
 * A party used to reach their instance only through the invitation link, and a seeded instance
 * only by typing its slug. That is not a working two-party product: the second person claims the
 * invite, answers, and then has nowhere to come back to. This route is the way back.
 *
 * **The session is the identity, and the only one.** `currentUser()` resolves the account from the
 * request's own cookies, and `listMyInstances(user.userId)` filters `party.user_id` by it. Nothing
 * here reads a name, a query parameter or a header to decide whose instances to show — an identity
 * the browser supplied is not an identity (`lib/auth/shell-account.ts` is the same rule), and
 * `user_profile.role` is never consulted, so an admin sees their own list and no one else's.
 *
 * Signed out, the answer is the other gated routes' own: `redirect(/login?next=…)` with this path
 * preserved, so the sign-in round trip returns the reader here.
 *
 * `force-dynamic` for the reason `/settings` and `/assessment/[slug]` carry it: the session is
 * per-request and the list is a database read, so `pnpm build` must never try to prerender either.
 * The build passes with no `DATABASE_URL` and no `NEON_AUTH_*` set — the page is not executed until
 * a request arrives.
 *
 * A read that does not answer is a panel, not a digest: `DatabaseUnavailableError` is caught and
 * its sentence handed to the view, and any other failure keeps throwing, because a row that fails
 * the model is a defect the gate is supposed to catch.
 */
import { MyInstances } from "@/components/assessment-flow/my-instances";
import { myInstancesPageCopy } from "@/data/pages/assessment-instances";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { listMyInstances, type MyInstance } from "@/lib/db/my-instances";
import { overviewFilterOf, overviewFiltered } from "@/lib/flow/overview";
import { MY_INSTANCES_PATH } from "@/lib/flow/paths";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your assessments",
};

/**
 * `?filter=` — the list one console card links to (Console 2/5).
 *
 * The ids are `OVERVIEW_FILTERS` (`lib/flow/overview.ts`), and the predicate that decides them is
 * the one the Overview counted with, so the figure on the card and the length of this list are two
 * passes over the same array. An unknown or repeated value resolves to no filter: the unfiltered
 * list is true about every row it shows, while a filtered list built from a value nobody
 * recognises would be a page that says it filtered and did not.
 */
export default async function MyInstancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = overviewFilterOf((await searchParams).filter);

  const user = await currentUser();
  if (user === null) redirect(loginPathFor(MY_INSTANCES_PATH));

  let instances: readonly MyInstance[] = [];
  let unreadable: string | null = null;
  try {
    const mine = await listMyInstances(user.userId);
    instances = filter === null ? mine : overviewFiltered(mine, filter);
  } catch (error) {
    // "The database did not answer" is a state this screen can describe; a schema failure is a
    // code defect and keeps throwing, exactly as the instance screen decides it.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("my-instances: the list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <MyInstances
      copy={myInstancesPageCopy}
      instances={instances}
      unreadable={unreadable}
      filter={filter}
    />
  );
}
