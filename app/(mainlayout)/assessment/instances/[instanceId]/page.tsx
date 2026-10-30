import { AssessmentInstanceView, problemCodeOf } from "@/components/assessment-flow/instance-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { inviteCookieName, partyCookieName } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * `/assessment/instances/[instanceId]` — the screen both parties share (#146).
 *
 * The viewer is resolved from the **cookie**, never from the URL: the instance id is in the
 * path because a page needs an address, and the cookie is what says which party is reading
 * it. A browser with no party token for this instance gets a 404 — the screen does not
 * exist for it, and there is nothing to leak by saying so.
 *
 * `force-dynamic`, and no `generateStaticParams`: both would be a database read at build.
 *
 * The invite notice (`?invite=sent|unsent`) is the creation redirect's own fact. It is
 * dropped from the URL by a redirect to the same screen without it, so a reload does not
 * keep claiming an email was sent.
 */
export const dynamic = "force-dynamic";

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
  });
  return { title: screen?.title ?? "Assessment Not Found" };
}

export default async function AssessmentInstancePage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>;
  searchParams: Promise<{ problem?: string; invite?: string }>;
}) {
  const { instanceId } = await params;
  const { problem, invite } = await searchParams;

  const jar = await cookies();
  const screen = await readFlowScreen({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    inviteToken: jar.get(inviteCookieName(instanceId))?.value ?? null,
  });
  if (screen === undefined) notFound();

  // `?invite=sent|unsent` is the creation redirect's own fact, kept in the address rather
  // than in a second cookie: it is one visit's sentence, and the panel below renders it
  // once. Nothing on this screen decides anything from it.
  const inviteNotice = invite === "sent" || invite === "unsent" ? invite : undefined;
  const problemCode = problemCodeOf(problem);

  return (
    <AssessmentInstanceView
      screen={screen}
      copy={assessmentInstancePageCopy}
      {...(inviteNotice === undefined ? {} : { inviteNotice })}
      {...(problemCode === undefined ? {} : { problem: problemCode })}
    />
  );
}
