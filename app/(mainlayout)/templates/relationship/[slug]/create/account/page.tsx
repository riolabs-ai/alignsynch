/**
 * `/templates/relationship/[slug]/create/account` — the account gate **after** stage 4
 * (#690, #794).
 *
 * Not a stage: the spec says so plainly ("Account is not a stage", #659), and the screen draws its
 * own three-step strip (`Relationship ready · Your account · Invitation sent`) rather than the
 * six-stage rail. It is the one surface in the flow that sits *behind* the create, and the reason
 * this card exists: before it, the account was demanded on stage 1 and a signed-out visitor could
 * not fill in a single field.
 *
 * **Two handles, and they are not interchangeable (#794).** The path segment is the template's
 * **slug** — that is the address `afterCreateTarget()` hands a signed-out creator. `?instance=`
 * is the relationship's **id**: the row stage 4 committed.
 *
 * **The address proves it was reached through the flow.** An instance id is not a secret — so the
 * page reads the screen the way every other flow surface does (`readFlowScreen`, with this
 * browser's own party cookie) and sends the visitor back to stage 1 when that read finds no party.
 * A crafted URL, a dead instance id, another person's relationship and a bookmarked gate all
 * answer the same way: stage 1. That is the "routing cannot reach it before stage 4" half of the
 * acceptance, and it is a read rather than a hidden field because a hidden field is a client's
 * claim about its own past.
 *
 * **Signed in already? This screen has nothing to say.** The gate exists to create or sign into an
 * account; a person who has one is forwarded to **Sent** (`…/instances/[id]/sent`, stage 5 — #691),
 * which is where the invitation's state and the way into the relationship are drawn.
 *
 * `force-dynamic`: the screen read is a database read and the party cookie is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountGate } from "@/components/assessment-flow/account-gate";
import { StageShell } from "@/components/assessment-flow/stage-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { loginPathFor } from "@/lib/auth/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { readFlowScreen } from "@/lib/flow/store";
import {
  createAccountForPath,
  createRelationshipPath,
  instancePath,
  OVERVIEW_PATH,
} from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your account",
};

type GateParams = {
  readonly instance?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<GateParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const instanceRecordId = (firstValue(query.instance) ?? "").trim();
  const whoPath = createRelationshipPath(slug);

  // No relationship named: nothing was created by this browser in this flow.
  if (instanceRecordId === "") redirect(whoPath);

  const jar = await cookies();
  const viewer = await currentUserIfConfigured();
  const screen = await readFlowScreen({
    instanceRecordId,
    token: jar.get(partyCookieName(instanceRecordId))?.value,
    viewerUserId: viewer?.userId ?? null,
  });

  // Not this browser's relationship — the id alone is not proof of anything.
  if (screen === undefined) redirect(whoPath);

  // An account already exists: the gate is behind them, not in front of them. **The dashboard is
  // where the flow goes next** (#709) — the relationship is listed there, and Sent is no longer a
  // destination the flow sends anybody to. It stays a screen that answers when asked for by URL.
  if (viewer !== null) redirect(OVERVIEW_PATH);

  const account = sectionOf(assessmentCreatePageCopy, "account");
  const stages = sectionOf(assessmentCreatePageCopy, "stages");

  return (
    <StageShell
      title={account.heading}
      closeLabel={itemLabel(stages, "close")}
      closeHref={OVERVIEW_PATH}
    >
      <AccountGate
        copy={assessmentCreatePageCopy}
        signInHref={loginPathFor(createAccountForPath(slug, screen.instanceRecordId))}
        backHref={instancePath(screen.instanceRecordId)}
        destination={OVERVIEW_PATH}
      />
    </StageShell>
  );
}
