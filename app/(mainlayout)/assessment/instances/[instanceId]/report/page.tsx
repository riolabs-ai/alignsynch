/**
 * `/assessment/instances/[instanceId]/report` — the relationship report (#409).
 *
 * The read surface the app did not have. It is a **server component over Postgres**, not a
 * rewiring of the `/v1` prototype's client store: `readFlowScreen` resolves the viewer against
 * the relationship (bearer token, then account, then coach membership) and hands back a projection
 * whose `report` field is `null` until both parties have answered every Aspect. A `"use client"`
 * component could not value-import the read at all (#228, `data:check` E34) — and the blind rule
 * would have to be re-implemented in a reducer, which is the arrangement #409 retired.
 *
 * **The viewer is resolved from the cookie, never from the URL.** The instance id is in the path
 * because a page needs an address; the party token in `flow_party_<instanceId>` is what says which
 * seat is reading. A browser that is not a party to the relationship — and holds no membership —
 * gets a 404, exactly as the instance screen does, so this route reveals nothing to a stranger.
 *
 * **Three answers, three pages.** No such relationship (or no role on it) → `notFound()`. A
 * relationship that is not yet scored → the locked page, drawn by `RelationshipReport` from the
 * same `screen` the report would be drawn from: no opinion value, no Gap and no count of the other
 * party's progress appears in its markup. Scored → the report, per Aspect, with the two Opinions
 * behind every Gap.
 *
 * `force-dynamic`, and no `generateStaticParams`: both would be a database read at build, and the
 * gate runs with `DATABASE_URL` unset.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { RelationshipReport } from "@/components/assessment-flow/report-view";
import { relationshipReportPageCopy } from "@/data/pages/assessment-relationship-report";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { partyCookieName } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The same helper the instance screen carries, for the same reason: `currentUser()` already
 * answers `null` for "no session", and `authConfigured()` adds the "is auth configured here at
 * all" question so the gate's database-free run renders this route as it did before.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}): Promise<Metadata> {
  const { instanceId } = await params;
  const jar = await cookies();
  const screen = await readFlowScreen({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    viewerUserId: await viewerUserId(),
  });
  // The title is the report's own word plus the template's title: "The report — Relationship
  // Basics". A slug nobody may read gets the 404's title rather than the template's, so the
  // metadata cannot name a relationship the body refuses to draw.
  return {
    title:
      screen === undefined
        ? relationshipReportPageCopy.heading
        : `${relationshipReportPageCopy.heading} — ${screen.title}`,
  };
}

export default async function RelationshipReportPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const jar = await cookies();
  const screen = await readFlowScreen({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    viewerUserId: await viewerUserId(),
  });
  if (screen === undefined) notFound();

  return (
    <StageColumn>
      <RelationshipReport screen={screen} />
    </StageColumn>
  );
}
