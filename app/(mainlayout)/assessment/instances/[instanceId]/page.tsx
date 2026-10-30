import { AssessmentInstanceView, problemCodeOf } from "@/components/assessment-flow/instance-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
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
 * **A signed-in account is the second kind of party** (#183, part 2). `demo_account` binds
 * Avery and Rowan to their party rows, so the demo panel can sign in as a person and land here;
 * `readFlowScreen` asks the cookie first and the session second, and either way the role comes
 * out of Postgres. `authConfigured()` guards the session read, because the gate — and every
 * render of this route in it — runs with no `NEON_AUTH_*` env at all.
 *
 * `force-dynamic`, and no `generateStaticParams`: both would be a database read at build.
 *
 * The invite notice (`?invite=sent|unsent`) is the creation redirect's own fact. It is
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
    viewerUserId: await viewerUserId(),
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
