/**
 * `/dashboard` — **Start**, the signed-in landing of the v2 shell (#1129, bundle 05).
 *
 * The page authors nothing and decides nothing about copy. It resolves the session, reads **the
 * viewer's own rows**, and hands them to `startViewOf` (`components/dashboard/start-view.ts`), which
 * projects the greeting's subtitle, the two jobs, the two relationship cards and the four templates.
 *
 *   listMyRelationships(user.userId)     every relationship this account is a party to
 *   readMemberAlignments(user.userId)    both parties' answers, per Aspect, of the complete ones
 *   listPublishedTemplates()             the catalogue a new relationship starts from
 *
 * **The reads are one guarded block.** A landing that drew a real next step beside a zero it
 * invented for the templates would be the exact defect this screen exists to avoid, so a failed
 * read draws the failure panel and no figures at all.
 *
 * **Every number is derived, never authored.** The "N to do" count, the tally behind a card's mini
 * bar and the Next Step itself all come from `lib/member/start.ts` and
 * `lib/member/alignment-summary.ts` — the functions the node tests drive, over the same
 * `content/gaps.ts` arithmetic the Align screen and the report use. No Gap is stored anywhere.
 *
 * **The projection lives in a component module, not here.** This module is the `page` of two copy
 * surfaces — the route's own fixture and the first-run tour's, which mounts on this route — and
 * `scripts/copy-refs.ts` asks every copy reference a page's closure makes of *each* surface. Keeping
 * the `sectionOf` calls in `components/dashboard/**` means they are asked of the one fixture that
 * owns the words.
 *
 * **The tour stays mounted, and its anchor set shrank.** Its steps target the old counts band and
 * the example answer sheet, neither of which Start draws: `lib/tour/steps.ts` drops a step whose
 * target is absent instead of faking one, so the tour runs with the stops this page can honestly
 * show. A v2 tour that walks the new landing is its own card.
 *
 * **Signed out is a redirect, not an empty landing.** `loginPathFor(OVERVIEW_PATH)` remembers the
 * destination, so the round trip returns the reader here.
 *
 * **No auth environment is not "signed out" here — it is the configuration error, deliberately.**
 * `currentUser()` builds the auth server outside its `try` and throws
 * `NEON_AUTH_BASE_URL is not set` when `NEON_AUTH_*` is absent (`lib/auth/session.ts`). That is the
 * documented answer for a console route on a tree with no secrets, and it is why `pnpm build`
 * passes with no auth env: only a *request* surfaces it.
 *
 * **`force-dynamic`** for the reason every console route carries it: the session is per-request,
 * every figure is a database read, and the build must never try to prerender this route — it
 * passes with no `DATABASE_URL` and no `NEON_AUTH_*`.
 *
 * **Not gated by `requireQuizProduct()`.** This is the alignment product's console; both builds
 * serve the route and only one links to it (#164).
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { StartPage } from "@/components/dashboard/start-page";
import { startViewOf } from "@/components/dashboard/start-view";
import { FirstRunTour } from "@/components/tour/first-run-tour";
import { startPageCopy } from "@/data/pages/start";
import { tourPageCopy } from "@/data/pages/tour";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readMemberAlignments } from "@/lib/db/member-alignments";
import { readTourState } from "@/lib/db/tour";
import { OVERVIEW_PATH } from "@/lib/flow/paths";
import { listPublishedTemplates, type TemplateSummary } from "@/lib/flow/store";
import { type AlignmentSummary, alignmentSummaryOf } from "@/lib/member/alignment-summary";
import { type MemberRelationshipRow, listMyRelationships } from "@/lib/member/relationships";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start",
  robots: { index: false, follow: false },
};

export default async function StartRoute() {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(OVERVIEW_PATH));

  let rows: readonly MemberRelationshipRow[] = [];
  let templates: readonly TemplateSummary[] = [];
  let summaries: Record<string, AlignmentSummary | null> = {};
  let unreadable: string | null = null;
  /**
   * `true` keeps the tour shut. It defaults to shut so a read that failed cannot open a tour over
   * the failure panel, which carries none of the anchors.
   */
  let tourSeen = true;

  try {
    rows = await listMyRelationships(user.userId);
    templates = await listPublishedTemplates();
    tourSeen = (await readTourState(user.userId)).seen;

    const alignments = await readMemberAlignments(user.userId);
    const bySession = new Map(alignments.map((entry) => [entry.sessionRecordId, entry]));
    summaries = Object.fromEntries(
      rows.map((row) => {
        const alignment =
          row.sessionRecordId === null ? undefined : bySession.get(row.sessionRecordId);
        return [
          row.id,
          alignment === undefined ? null : alignmentSummaryOf(alignment.setting, alignment.answers),
        ];
      }),
    );
  } catch (error) {
    // "The database did not answer" is a state this screen can describe. A row that fails the
    // model is a code defect, and it keeps throwing.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("start: the landing's rows could not be read", error);
    unreadable = error.reason;
  }

  const view = startViewOf({ copy: startPageCopy, rows, templates, summaries });

  return (
    <StageColumn>
      <StartPage
        copy={startPageCopy}
        name={user.name}
        subtitle={view.subtitle}
        jobs={view.jobs}
        cards={view.cards}
        templates={view.templates}
        unreadable={unreadable}
      />
      {/*
        Mounted by the page, not the component, for the reason `components/legal` records: the
        fixture is parsed by zod at module load, so the route resolves it and the browser receives
        a plain object. `components/tour/**` therefore imports no `data/` module and no zod.
      */}
      <FirstRunTour copy={tourPageCopy} start={!tourSeen} />
    </StageColumn>
  );
}
