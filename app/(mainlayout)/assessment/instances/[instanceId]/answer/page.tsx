/**
 * `/assessment/instances/[instanceId]/answer` — the gated answer sheet (#427, R2-2).
 *
 * The route is `answer` (singular) on purpose: `/answers` in the parent segment is the POST-only
 * endpoint this sheet submits to, and Next refuses a `page.tsx` beside a `route.ts`.
 *
 * **The viewer is resolved by Postgres, never by the URL.** `readFlowScreen()` answers "who is
 * reading" from the party cookie's token hash, then the signed-in account (`party.user_id`), then
 * a relationship membership — and returns `undefined` for a request that is none of those. That
 * `undefined` is a `notFound()`: an instance a browser is not a party to does not exist for it, and
 * a 404 leaks less than a screen that names the relationship and then refuses.
 *
 * **The blind rule is the input, not a check on this page.** `readFlowScreen()` asks Postgres only
 * for the roles `visibleRoles()` allows, so before the session completes `aspects[].own` holds the
 * viewer's own scores and there is no field in the projection that could carry the other party's.
 * This page draws that projection; it never reads the other column into memory and then decides
 * not to print it. The acceptance for this card proves the consequence — the counterparty's stored
 * scores are grepped out of the rendered HTML and found zero times — rather than pointing at the
 * component.
 *
 * **Three shapes, one route** (`lib/flow/answer-gate.ts`): the live form for the seat that may
 * answer, the viewer's own sheet drawn read-only once the answers are sealed, and a coach band with
 * no form at all. A coach reads the relationship and has no answers to give, so a disabled sheet
 * would be a lie about what a coach may do.
 *
 * `force-dynamic`, and no `generateStaticParams`: an answer sheet is request-time by definition,
 * and the gate's database-free run must never try to render one at build.
 */
import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { answerGateOf } from "@/lib/flow/answer-gate";
import { instancePath } from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";
import { inviteCookieName, partyCookieName } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

export const dynamic = "force-dynamic";

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The same five lines the instance screen carries, and for the same reason: `currentUser()` answers
 * `null` for "no session", and `authConfigured()` adds the "is auth here at all" question so the
 * gate's database-free build renders this route without `NEON_AUTH_*` set.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

/**
 * The screen for this viewer, memoised for the request.
 *
 * `generateMetadata()` and the page ask the same question about the same request, and the answer
 * costs the relationship read plus the screen's own statements. `cache()` holds it for one request
 * and nothing longer; a throw is not memoised.
 */
const screenFor = cache(async (instanceId: string): Promise<FlowScreen | undefined> => {
  const jar = await cookies();
  return readFlowScreen({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    inviteToken: jar.get(inviteCookieName(instanceId))?.value ?? null,
    viewerUserId: await viewerUserId(),
  });
});

/**
 * The instance's own title — for a viewer who is a party to it, and nobody else.
 *
 * `readFlowScreen()` already refuses a non-viewer, so the fallback is the whole protection here:
 * a browser that holds no seat for this instance is told nothing about it, not even its name.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}): Promise<Metadata> {
  const { instanceId } = await params;
  const screen = await screenFor(instanceId);
  return { title: screen?.title ?? "Assessment Not Found" };
}

export default async function AnswerSheetPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const screen = await screenFor(instanceId);
  if (screen === undefined) notFound();

  const gate = answerGateOf({
    instanceRecordId: screen.instanceRecordId,
    viewerRole: screen.viewer.role,
    status: screen.status,
    aspects: screen.aspects,
  });

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <AnswerSheet
        copy={assessmentAnswerPageCopy}
        aspects={screen.aspects}
        gate={gate}
        viewer={screen.viewer}
        mode={screen.mode}
        backHref={instancePath(instanceId)}
      />
    </div>
  );
}
