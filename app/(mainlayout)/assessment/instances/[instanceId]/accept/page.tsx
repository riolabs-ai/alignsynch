/**
 * `/assessment/instances/[instanceId]/accept` — the acceptance step, live since R2 (#427).
 *
 * Acceptance first: the decision, then the two seats side by side, then the Aspect detail beneath
 * them. Every fact on it is read from the instance's own rows: each seat's acceptance is
 * `party.accepted_at` (`0016_party_acceptance.sql`), and the control posts to the `/accepts`
 * endpoint, which records **this** party's acceptance and — when it makes both accepted — derives
 * the relationship's Steps in the same transaction.
 *
 * **The read is `readFlowScreen()`**, the gated projection the instance and report screens use, and
 * not a second query. That is the blind rule for this page: the viewer is resolved from the cookie
 * and then the account (a stranger gets a 404, as on every sibling route), the projection carries
 * the viewer's **own** answers per Aspect and no other-party value, and the component draws exactly
 * that — own column unsealed for review, the other seat a sealed chip.
 *
 * **Why the report is not drawn here.** Until the second acceptance the status is `answering`, so
 * `screen.report` is `null` by construction. The page says what is outstanding and links to the
 * report, which is the surface that composes both sheets.
 *
 * **The refusal band.** A POST that is refused redirects back here with `?accept=<code>` — the
 * `?problem=` pattern the instance screen and the create form already use — and the page turns the
 * code into the fixture's sentence. A code it does not know renders nothing.
 *
 * `force-dynamic`, and no `generateStaticParams`: this route reads a database and must not do so
 * at build time.
 */
import {
  AcceptSession,
  acceptProblemOf,
  type AcceptAspect,
  type AcceptSeat,
} from "@/components/assessment-flow/accept-session";
import { assessmentAcceptPageCopy } from "@/data/pages/assessment-accept";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { acceptsPath, answerSheetPath, instancePath, reportPath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review and accept",
};

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The same helper the instance and report screens carry: `currentUser()` already answers `null`
 * for "no session", and `authConfigured()` adds the "is auth configured here at all" question so
 * the gate's database-free run renders the route as it did before.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

export default async function AssessmentAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>;
  /** `?accept=<code>` — the refusal the last POST redirected back with. A Promise in Next 16. */
  searchParams: Promise<{ accept?: string }>;
}) {
  const { instanceId } = await params;
  const { accept } = await searchParams;

  const jar = await cookies();
  const screen = await readFlowScreen({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    viewerUserId: await viewerUserId(),
  });
  // Not a party to it (or no such instance): the screen does not exist for this request, exactly
  // as on `/answer` and `/report`. There is nothing to leak by saying so.
  if (screen === undefined) notFound();

  const aspects: AcceptAspect[] = screen.aspects.map((aspect) => ({
    itemId: aspect.itemId,
    prompt: aspect.prompt,
    leftValue: aspect.leftValue,
    rightValue: aspect.rightValue,
    // The viewer's own answer, straight off the gated projection — `aspects[].own` is the only
    // opinion `visibleRoles()` let through.
    own: aspect.own,
  }));

  const seats: AcceptSeat[] = screen.seats.map((seat) => ({
    role: seat.role,
    name: seat.name,
    answered: seat.answered,
    acceptedAt: seat.acceptedAt,
  }));

  return (
    <AcceptSession
      copy={assessmentAcceptPageCopy}
      seats={seats}
      aspects={aspects}
      mode={screen.mode}
      setting={screen.setting}
      templateTitle={screen.title}
      viewerRole={screen.viewer.role}
      viewerAnswered={screen.viewerAnswered}
      viewerAccepted={screen.viewerAccepted}
      status={screen.status}
      problem={acceptProblemOf(accept)}
      acceptAction={acceptsPath(instanceId)}
      answerHref={answerSheetPath(instanceId)}
      reportHref={reportPath(instanceId)}
      backHref={instancePath(instanceId)}
    />
  );
}
