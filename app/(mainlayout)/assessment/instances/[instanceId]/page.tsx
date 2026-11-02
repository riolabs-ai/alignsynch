import {
  AssessmentInstanceView,
  inviteNoticeOf,
  problemCodeOf,
} from "@/components/assessment-flow/instance-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { readRelationshipById } from "@/lib/db/assessments";
import { DatabaseUnavailableError } from "@/lib/db/client";
import type { FlowScreen } from "@/lib/flow/screen";
import { resendRefusalOf } from "@/lib/flow/resend";
import { inviteCookieName, partyCookieName } from "@/lib/flow/session";
import { markUnlockSeen } from "@/lib/flow/store";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

/**
 * `/assessment/instances/[instanceId]` — one relationship, both seats (#146, #409).
 *
 * The viewer is resolved from the **cookie**, never from the URL: the id is in the path because a
 * page needs an address, and the cookie (or, failing it, the signed-in account, or a relationship
 * membership) is what says which party is reading it. A request that is none of those gets a 404
 * — the screen does not exist for it, and there is nothing to leak by saying so.
 *
 * **A signed-in account is the second kind of party** (#183, part 2). `demo_account` binds Avery
 * and Rowan to their party rows, so the demo panel can sign in as a person and land here;
 * `readFlowScreen` asks the cookie first and the session second, and either way the role comes out
 * of Postgres. `authConfigured()` guards the session read, because the gate — and every render of
 * this route in it — runs with no `NEON_AUTH_*` env at all.
 *
 * **One read, two halves.** `readRelationshipById()` resolves the relationship the id names and
 * hands back both the money facts — sliced to the Initiator — and the screen's gated projection,
 * which is `readFlowScreen()`: it asks Postgres only for the roles `visibleRoles()` allows, so the
 * page is handed `report: null` and `aspects[].own` before a session is complete, and `paid: null`
 * for every viewer who is not the Initiator. This page filters neither; it draws what it was
 * given.
 *
 * **The id may name either noun.** Every link in this tree carries a session record id
 * (`lib/flow/paths.ts::instancePath`), and the `/v1` prototype addresses the relationship, so the
 * read answers both and takes the newest session of a relationship. That is what keeps
 * `/assessment/instances/assessment-instance-avery-rowan` — the demo's own URL — the same screen
 * as a relationship-shaped one, with no second route.
 *
 * `force-dynamic`, and no `generateStaticParams`: both would be a database read at build.
 *
 * **Opening this screen is the event that clears the unlock marker** (#252). The list says
 * "complete since you last looked"; this page writes `party.unlock_seen_at` for the party the
 * request resolved as, once and only once the instance is complete — see `recordUnlockSeen()`
 * below for the three rules that keep the write from firing on a prefetch, on an unfinished
 * instance, or on a connection that has already dropped.
 *
 * The invite notice (`?invite=sent|unset|failed`) is the creation redirect's own fact. It is
 * dropped from the URL by a redirect to the same screen without it, so a reload does not
 * keep claiming an email was sent.
 */
export const dynamic = "force-dynamic";

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * `currentUser()` already answers `null` for "no session" and for a failed session fetch; this
 * only adds the "is auth configured here at all" question so the gate's database-free run
 * (CI, the parity render) renders the route exactly as it did before #183.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

/**
 * The detail for one id, memoised for the request (#204's rule, applied here).
 *
 * `generateMetadata()` and the page ask the same question about the same request, and the answer
 * costs a round trip for the relationship plus the flow screen's own statements. `cache()` holds
 * it for the life of one request and nothing longer: a failure is not memoised, and the next
 * request reads the database again.
 */
const readDetail = cache(
  async (
    ref: string,
    token: string | undefined,
    inviteToken: string | null,
    viewer: string | null,
  ) => readRelationshipById(ref, { token, inviteToken, viewerUserId: viewer }),
);

/** One call, from either entry point — the cookies and the session are resolved here. */
async function detailFor(ref: string) {
  const jar = await cookies();
  return readDetail(
    ref,
    jar.get(partyCookieName(ref))?.value,
    jar.get(inviteCookieName(ref))?.value ?? null,
    await viewerUserId(),
  );
}

/**
 * The unlock mark (#252): opening a complete instance is what clears it, for the party reading.
 *
 * Three rules, and each one is a way this could go wrong:
 *
 * - **Only a complete instance.** Before that there is no unlock to have seen, and
 *   `markUnlockSeen` would be recording a visit as if it were an event. `screen.status` is the
 *   same derivation the report below is drawn from, so the marker cannot be cleared by a screen
 *   that had nothing to show.
 * - **Only a request that is a person opening the screen.** `next/link` prefetches a route the
 *   reader may navigate to, and Next marks those requests with `Next-Router-Prefetch: 1`; counting
 *   one as a visit would delete the marker before the sentence it announces is ever read, which is
 *   the whole defect this card fixes arriving from the other side. A prefetch renders no marker to
 *   clear, so it writes nothing and the real visit still does.
 * - **A mark that cannot be written is not a failed screen.** The report above it was read
 *   successfully; if the connection drops between the read and this UPDATE, the honest answer is
 *   still the report, with a stale marker next visit. `DatabaseUnavailableError` is logged and
 *   swallowed for that reason, exactly as the list answers a dead database with a panel — while
 *   any other failure keeps throwing, because a schema that cannot take the column is a defect the
 *   gate is supposed to catch.
 */
async function recordUnlockSeen(screen: FlowScreen): Promise<void> {
  if (screen.status !== "complete") return;
  // A coach has no party row to mark: `unlock_seen_at` is a party's own fact, and a coach reads
  // without answering, so there is nothing of theirs to clear.
  if (screen.viewer.role === "coach") return;
  const prefetch = (await headers()).get("next-router-prefetch");
  if (prefetch === "1") return;

  try {
    await markUnlockSeen({ instanceRecordId: screen.instanceRecordId, role: screen.viewer.role });
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("instance screen: the unlock mark could not be written", error);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}): Promise<Metadata> {
  const { instanceId } = await params;
  const detail = await detailFor(instanceId);
  return { title: detail?.screen.title ?? "Assessment Not Found" };
}

export default async function AssessmentInstancePage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>;
  searchParams: Promise<{ problem?: string; invite?: string; resend?: string }>;
}) {
  const { instanceId } = await params;
  const { problem, invite, resend } = await searchParams;

  const detail = await detailFor(instanceId);
  if (detail === undefined) notFound();
  const { screen } = detail;

  // #252 — this visit is the event that clears "complete since you last looked" on
  // `/assessment/instances`, for **this** party only: `screen.viewer.role` is the seat the read
  // resolved from Postgres, and `markUnlockSeen` writes that row and no other. It runs after the
  // read, so the sentence drawn above and the mark cleared here come from one status.
  await recordUnlockSeen(screen);

  // `?invite=sent|unset|failed` is the creation redirect's own fact, kept in the address
  // rather than in a second cookie: it is one visit's sentence, and the panel below renders
  // it once. Nothing on this screen decides anything from it — and a value this build does
  // not know renders nothing, because guessing which kind of not-sent it was is the bug
  // (#220): `unset` and `failed` are different facts and get different sentences.
  const inviteNotice = inviteNoticeOf(invite);
  const problemCode = problemCodeOf(problem);
  // #275 — `?resend=<code>` is the re-invite endpoint's refusal, carried through its 303 exactly
  // as `?claim=` carries the claim's. A code this build does not know renders nothing: guessing
  // which refusal it was is worse than saying nothing.
  const refusedReinvite = resendRefusalOf(resend);

  return (
    <AssessmentInstanceView
      screen={screen}
      copy={assessmentInstancePageCopy}
      paid={detail.paid}
      {...(inviteNotice === undefined ? {} : { inviteNotice })}
      {...(problemCode === undefined ? {} : { problem: problemCode })}
      {...(refusedReinvite === undefined ? {} : { resendRefusal: refusedReinvite })}
    />
  );
}
