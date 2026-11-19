/**
 * `/assessment/new/failed` — the screen a browser form post lands on when the create cannot write
 * (#1226).
 *
 * **How a person gets here.** They are on the create flow's stage 4 (`…/create/commit`), they press
 * the control that writes the relationship, and the endpoint's transaction throws for a reason that
 * is not one of their own errors — a column the deployment's migration ledger is missing, a
 * connection that dropped. `POST /assessment/new` answers that as a **303 to this address** for an
 * HTML accept, keeps the `console.error("create-failed", sqlstate, message)` line, and the screen
 * they read is drawn from `create-failed.html` in the v2 bundle: an icon, a heading, one sentence,
 * two actions.
 *
 * **What is deliberately not here.**
 *
 *   a session read   — nothing on this screen belongs to an account. The failure happened before a
 *                      row existed, so there is no relationship to resolve and no party to check;
 *                      the shell draws its own account menu from its own read (`(mainlayout)`'s
 *                      layout), and a signed-out arrival is not an error state here.
 *   the cause        — the SQLSTATE, the driver's sentence and the column name are server-log
 *                      facts (#1205). A person cannot fix any of them, and printing one is an error
 *                      message addressed to the wrong reader.
 *   a `?problem=`    — that vocabulary is the person's own errors (`lib/flow/create-copy.ts`), and
 *                      this is not one; the same reason the endpoint does not use it either.
 *
 * **`?template=` is the only thing in the address.** It is the slug the failed post named, carried
 * so `Try Again` can reopen that template's create stage. It is validated by
 * `templateSlugParam()` — a value that is not a slug is treated as absent, so a crafted address can
 * only ever produce the library link. An empty value is a real state: a post that named no
 * template has no flow to return to, and the library is the screen that lists what can be copied.
 *
 * **The column is `StageColumn`'s, not this page's.** The artifact draws `mx-auto max-w-3xl`; the
 * repo's rule (#858) is that the left edge belongs to the column every dashboard page renders
 * inside, so the width stays here as a measure and the centring does not — `scripts/column-refs.ts`
 * fails a page that re-centres itself.
 */
import type { Metadata } from "next";

import { CreateFailedState } from "@/components/assessment-flow/create-failed";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { assessmentCreateFailedPageCopy } from "@/data/pages/assessment-create-failed";
import {
  createCommitPath,
  OVERVIEW_PATH,
  TEMPLATE_LIBRARY_PATH,
  templateSlugParam,
} from "@/lib/flow/paths";

export const metadata: Metadata = {
  title: "Couldn't Create This Draft",
};

export default async function CreateFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.template) ? query.template[0] : query.template;
  const slug = templateSlugParam(raw);

  return (
    <StageColumn>
      <div className="max-w-3xl space-y-4">
        <CreateFailedState
          copy={assessmentCreateFailedPageCopy}
          retryHref={slug === "" ? TEMPLATE_LIBRARY_PATH : createCommitPath(slug)}
          dashboardHref={OVERVIEW_PATH}
        />
      </div>
    </StageColumn>
  );
}
