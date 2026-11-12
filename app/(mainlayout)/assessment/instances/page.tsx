/**
 * `/assessment/instances` — "what am I in the middle of?" (#213, as the relationship list #409).
 *
 * A party used to reach their instance only through the invitation link, and a seeded instance
 * only by typing its slug. That is not a working two-party product: the second person claims the
 * invite, answers, and then has nowhere to come back to. This route is the way back — and since
 * #409 it is the relationship list the `/v1` prototype proved out, server-rendered here.
 *
 * **The session is the identity, and the only one.** `currentUser()` resolves the account from the
 * request's own cookies, and `listRelationshipCards(user.userId)` scopes its statement to that
 * account — `relationship_member.user_id`, or `party.user_id` for the rows seeded before #340.
 * Nothing here reads a name, a query parameter or a header to decide whose relationships to show —
 * an identity the browser supplied is not an identity (`lib/auth/shell-account.ts` is the same
 * rule), and `user_profile.role` is never consulted, so an admin sees their own list and no one
 * else's.
 *
 * Signed out, the answer is the other gated routes' own: `redirect(/login?next=…)` with this path
 * preserved, so the sign-in round trip returns the reader here.
 *
 * **No auth environment is not "signed out" here — it is the configuration error, deliberately.**
 * `currentUser()` builds the auth server outside its `try` and throws
 * `NEON_AUTH_BASE_URL is not set` when `NEON_AUTH_*` is absent, because a console page must not
 * turn a deployment mistake into an endless signed-out session (`lib/auth/session.ts`). So on a
 * tree with no auth env — a fresh clone, a preview without secrets, the gate build — a *request*
 * to this route answers 500 with that error, and that is the documented answer, not a defect
 * (kanban t_c6398125 chose to keep it and say so here). `/support` and `/how-it-works` answer the
 * login redirect instead because they call `currentUserIfConfigured()`; this page does not.
 * `pnpm build` passes without `NEON_AUTH_*` by design, so only a request can surface it.
 *
 * **Three query values, and each one can only narrow.** `?filter=` is the console's list
 * (Console 2/5), `?stage=` one rung of the relationship ladder, `?q=` the search box. All three
 * are resolved here through the module that owns the vocabulary — an unknown value means no
 * narrowing, never an empty page that claims it filtered — and none of them can widen the rows the
 * session already owns.
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
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { MyInstances, flowStageOf } from "@/components/assessment-flow/my-instances";
import { myInstancesPageCopy } from "@/data/pages/assessment-instances";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { listRelationshipCards, type RelationshipCard } from "@/lib/db/assessments";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { overviewFilterOf } from "@/lib/flow/overview";
import { MY_INSTANCES_PATH } from "@/lib/flow/paths";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /**
   * The page's `heading` is the title, not a second string — a `<title>` spelled here would be the
   * one place this surface could be called something else. The `<h1>` reads the same field. Since
   * #706 the field is "Your relationships", which is the label `data/surface-registry.ts` gives this
   * route and no longer collides with the rail row of the same name pointed at the console list.
   */
  title: myInstancesPageCopy.heading,
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MyInstancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // `?filter=` — the one list a console card links to. Its ids are `OVERVIEW_FILTERS`, and the
  // predicate that decides them is the one the Overview counted with, so the figure on the card
  // and the length of this list are two passes over the same array.
  const filter = overviewFilterOf(params.filter);
  const stage = flowStageOf(first(params.stage));
  // A search, not a query language: the box is the only place this string comes from, and the
  // bound keeps a pasted paragraph out of the rendered page.
  const query = (first(params.q) ?? "").slice(0, 80);

  const user = await currentUser();
  if (user === null) redirect(loginPathFor(MY_INSTANCES_PATH));

  let relationships: readonly RelationshipCard[] = [];
  let unreadable: string | null = null;
  try {
    relationships = await listRelationshipCards(user.userId);
  } catch (error) {
    // "The database did not answer" is a state this screen can describe; a schema failure is a
    // code defect and keeps throwing, exactly as the instance screen decides it.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("my-instances: the list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <MyInstances
        copy={myInstancesPageCopy}
        relationships={relationships}
        unreadable={unreadable}
        filter={filter}
        stage={stage}
        query={query}
      />
    </StageColumn>
  );
}
