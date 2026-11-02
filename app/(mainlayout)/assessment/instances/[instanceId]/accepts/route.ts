/**
 * `POST /assessment/instances/[instanceId]/accepts` — record one party's acceptance (#R2).
 *
 * **A route handler and not a server action**, for the reason `/assessment/new` and
 * `/assessment/instances/[instanceId]/answers` are: the flow has to be drivable with a plain HTML
 * form — no client bundle, and `curl` can post it — which is also what makes the refusal a status
 * code a test can read instead of a banner a screenshot has to be trusted for.
 *
 * **The seat is never a form field.** The party token comes from the `flow_party_<id>` cookie; the
 * store resolves it to a role in Postgres and falls back to the signed-in account (#R2). A coach is
 * refused `not-a-party` by the same resolver a stranger is.
 *
 * **What comes back.** Three answers, all of them redirects (303, so a reload cannot re-post):
 *
 *   - the write made both seats accepted → the **report**, because the Gap opened with it;
 *   - a first acceptance → the accept page again, now showing this seat as accepted;
 *   - a refusal → the accept page with `?accept=<code>`, the `?problem=` pattern the instance
 *     screen and the create form already use, so the reason survives one navigation and no more.
 *
 * **The unlock notice fires here (#258), and on the transition only.** `completed === true` is the
 * second acceptance and nothing else — the store derives it under the session row's lock, so two
 * concurrent accepts produce exactly one `true`. The send happens **after** the transaction
 * committed, so a mail failure can neither unstore an acceptance nor change the redirect a person
 * sees, and once per completing acceptance rather than once per submit.
 *
 * **The kill switch is not here yet.** `relationship.writes` (`data/flags.ts`) is declared by the
 * create card; this endpoint joins that gate in the same change that adds it, not before — a flag
 * this file invented would be a second declaration of the same switch.
 */
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { acceptPath, reportPath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { acceptSession } from "@/lib/flow/store";
import { sendUnlockNotice } from "@/lib/flow/unlock-notice";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The account is the **second** answer to "which seat is accepting": an invited party whose
 * seven-day cookie has gone (or who signed in on a demo account) is still that party, and the
 * store asks for this only after the cookie came back empty.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;
  const jar = await cookies();

  const result = await acceptSession({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    viewerUserId: await viewerUserId(),
  });

  if (!result.ok) {
    const location = new URL(acceptPath(instanceId), request.url);
    location.searchParams.set("accept", result.code);
    return NextResponse.redirect(location, 303);
  }

  if (result.completed) {
    // #258 — the acceptance that made both seats accepted is the one event that emails the other
    // party. One attempt; a failure is an operator line and cannot undo the commit, and the
    // screen the reader lands on (the report) is the truth either way.
    await sendUnlockNotice({
      instanceRecordId: instanceId,
      submittedBy: result.role,
    }).catch((error: unknown) => {
      console.error(
        "[unlock] the notice could not be attempted after an acceptance completed the session — the acceptance is stored and the report is unaffected",
        error instanceof Error ? error.name : "unknown",
      );
    });
    return NextResponse.redirect(new URL(reportPath(instanceId), request.url), 303);
  }

  return NextResponse.redirect(new URL(acceptPath(instanceId), request.url), 303);
}
