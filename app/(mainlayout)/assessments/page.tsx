/**
 * `/assessments` — the member's assessment sessions, listed (#877).
 *
 * **The address is plural, and it is a sibling of My Relationships.** `assessments/`, not
 * `assessment/`: the owner's correction was that this is a *listing of My Assessments* — the same
 * kind of destination as `/dashboard/relationships` and `/dashboard/templates`, reached from the
 * rail — while `/assessment` is the record kind's own tree (the catalogue a relationship is
 * started from). The page it replaced, `/assessment/instances`, is now a 308 here
 * (`next.config.mjs`), because two live listings over one read is the confusion #877 was filed
 * about; the session's own screen stays at `/assessment/instances/<record id>` and did not move.
 *
 * **The session is the identity, and the only one.** `currentUser()` resolves the account from the
 * request's own cookies, and `listRelationshipCards(user.userId)` scopes its statement to that
 * account — `relationship_member.user_id`, or `party.user_id` for the rows seeded before #340.
 * Nothing here reads a name, a query parameter or a header to decide whose sessions to show — an
 * identity the browser supplied is not an identity (`lib/auth/shell-account.ts` is the same rule),
 * and `user_profile.role` is never consulted, so an admin sees their own list and no one else's.
 *
 * Signed out, the answer is the other gated routes' own: `redirect(/login?next=…)` with this path
 * preserved, so the sign-in round trip returns the reader here.
 *
 * **No auth environment is not "signed out" here — it is the configuration error, deliberately.**
 * `currentUser()` builds the auth server outside its `try` and throws `NEON_AUTH_BASE_URL is not
 * set` when `NEON_AUTH_*` is absent, because a console page must not turn a deployment mistake into
 * an endless signed-out session (`lib/auth/session.ts`). So on a tree with no auth env — a fresh
 * clone, a preview without secrets, the gate build — a *request* to this route answers 500 with
 * that error, and that is the documented answer, not a defect (kanban t_c6398125 chose to keep it
 * and say so here). `pnpm build` passes without `NEON_AUTH_*` by design, so only a request can
 * surface it.
 *
 * **One query value, and it can only narrow.** `?filter=` is the console Overview's list
 * (Console 2/5), resolved through `overviewFilterOf()` — an unknown value means no narrowing, never
 * an empty page that claims it filtered — and it cannot widen the rows the session already owns.
 * The search box and the state tabs are the shell's own state, not URL parameters, because the list
 * is the My Assessments record list and its toolbar is the one `/dashboard/relationships` ships.
 *
 * `force-dynamic` for the reason `/dashboard/relationships` and `/settings` carry it: the session is
 * per-request and the list is a database read, so `pnpm build` must never try to prerender either.
 *
 * A read that does not answer is a panel, not a digest: `DatabaseUnavailableError` is caught and
 * its sentence handed to the view, and any other failure keeps throwing, because a row that fails
 * the model is a defect the gate is supposed to catch.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { AssessmentsList } from "@/components/dashboard/assessments-list";
import { assessmentsPageCopy } from "@/data/pages/assessments";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { listRelationshipCards, type RelationshipCard } from "@/lib/db/assessments";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { overviewFilterOf } from "@/lib/flow/overview";
import { MY_ASSESSMENTS_PATH } from "@/lib/flow/paths";

export const dynamic = "force-dynamic";

/**
 * The page's `heading` is the title, not a second string — a `<title>` spelled here would be the
 * one place this surface could be called something else. The `<h1>` reads the same field.
 */
export const metadata: Metadata = {
  title: assessmentsPageCopy.heading,
  robots: { index: false, follow: false },
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MyAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // `?filter=` — the one list a console card links to. Its ids are `OVERVIEW_FILTERS`, and the
  // predicate that decides them is the one the Overview counted with, so the figure on the card
  // and the length of this list are two passes over the same array.
  const filter = overviewFilterOf(first(params.filter));

  const user = await currentUser();
  if (user === null) redirect(loginPathFor(MY_ASSESSMENTS_PATH));

  let sessions: readonly RelationshipCard[] = [];
  let unreadable: string | null = null;
  try {
    sessions = await listRelationshipCards(user.userId);
  } catch (error) {
    // "The database did not answer" is a state this screen can describe; a schema failure is a
    // code defect and keeps throwing, exactly as the session screen decides it.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("assessments: the list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <AssessmentsList
        copy={assessmentsPageCopy}
        rows={sessions}
        filter={filter}
        unreadable={unreadable}
      />
    </StageColumn>
  );
}
