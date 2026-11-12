/**
 * `/templates/relationship/[slug]/create/invite` — the create flow's stage 5, **Invite** (#825).
 *
 * The stage where the relationship stage 4 wrote as a `draft` either goes out or does not. Two acts,
 * one write: **Send and Continue** posts `POST /assessment/instances/[id]/send`, which publishes the
 * relationship and mails the one invitation; **Continue as Draft** is a link to the dashboard, where
 * the draft is under My relationships. Nothing is sent until Send is pressed, and keeping it as a
 * draft costs nothing — which is the promise the retired post-commit account gate used to carry and
 * now says where the send actually happens.
 *
 * **Two handles, and they are not interchangeable (#794).** The path segment is the template's
 * **slug**; `?instance=` is the relationship's **id**. The read is the flow's own
 * (`readFlowScreen`), asked with this browser's `flow_party_*` token and then with the signed-in
 * account, so a crafted id, somebody else's relationship and a dead one all answer the same way:
 * back to Details. An id alone is not proof of anything, and it is not a secret.
 *
 * **The answers the walk recaps come from the row, not from a cookie.** The create consumed the
 * draft cookie when it wrote the relationship, so the facts this stage prints are read back from
 * the rows it wrote — which is the stronger source anyway: it is what was actually created.
 *
 * `force-dynamic`: the screen read is a database read and the party cookie is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { InviteWalk } from "@/components/assessment-flow/invite-walk";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { entitlementForAccount } from "@/lib/billing";
import { createRefusal } from "@/lib/flow/create-copy";
import { createCommitPath, createRelationshipPath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send the invitation",
};

type InviteParams = {
  readonly instance?: string | string[];
  readonly problem?: string | string[];
  readonly field?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<InviteParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(slug);
  const commitPath = createCommitPath(slug);
  const instanceRecordId = (firstValue(query.instance) ?? "").trim();

  // No relationship named: nothing was created by this browser in this flow.
  if (instanceRecordId === "") redirect(whoPath);

  const jar = await cookies();
  const viewer = await currentUserIfConfigured();
  const detail = await readLibraryTemplate(slug, viewer?.userId ?? null);
  // #870 — the refusal's door: the template's own page (by slug) and its editor (by id).
  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field), {
    slug,
    ...(detail === undefined ? {} : { recordId: detail.template.id }),
  });

  const screen = await readFlowScreen({
    instanceRecordId,
    token: jar.get(partyCookieName(instanceRecordId))?.value,
    viewerUserId: viewer?.userId ?? null,
  });
  // Not this browser's relationship, and not one an account it holds is a party to.
  if (screen === undefined) redirect(whoPath);

  if (detail === undefined && refusal === null) notFound();

  /**
   * The facts the stage prints back, from the rows stage 4 wrote. Two names arrive composed (the
   * seat's own `name` column), so they ride in the first-name slot: `personName()` draws a composed
   * name unchanged, and splitting a name on a space would invent a last name for somebody who has
   * two.
   */
  /**
   * #834 — the plan question is asked **here**, where the send is, not at stage 4 where the draft
   * is written. A draft is unfunded and unsent; refusing it a stage before the screen that carries
   * the plans and the checkout is a dead end, not an upsell. The words are the notice's own
   * fixture sentence — one sentence, one home — and this band does not block: Send stays enabled,
   * and keeping the draft costs nothing.
   *
   * #835 — the sentence no longer says the Mode was refused: the send grants the 7-day trial, and
   * the trial plays Advanced Mode. So a Free account choosing Advanced reads how long it is
   * included, not that it cannot have it.
   */
  const entitlement = viewer === null ? null : await entitlementForAccount(viewer.userId);
  const modeNotOnPlan =
    entitlement !== null && screen.mode === "advanced" && !entitlement.advancedMode;
  // `undefined` for the field: this notice is not a field refusal, so no half is named.
  const planNotice = modeNotOnPlan ? createRefusal("mode-not-entitled", undefined) : null;

  const draft = {
    initiatorFirst: screen.initiatorName,
    initiatorLast: "",
    counterpartyFirst: screen.counterpartyName ?? "",
    counterpartyLast: "",
    email: screen.invite?.email ?? "",
    title: screen.title,
    description: "",
    mode: screen.mode,
    alignmentSetting: screen.setting,
  };

  /**
   * **The payment walk, built here and handed to the stage (#870).**
   *
   * The stage draws it on the left and owns nothing about it — the plan is a database fact, and a
   * component that reached for one would be a component that cannot be rendered without a pool.
   * What the account already pays for decides the first panel: an entitled account gets a
   * **summary** of its tier rather than the radio group, so the stage never asks somebody to buy a
   * plan they hold. An account whose Mode is not on its plan keeps the radio group and the trial
   * sentence — the send still grants the 7-day trial and the trial still plays Advanced Mode
   * (#835, #843), which is why this is a walk and not a gate.
   *
   * **Nothing here charges, and nothing here is a card form.** The method panel keeps deferring the
   * capture to publish — that is the approved flow (`payment-flow.method-note`) and #748's in-app
   * capture dialog is the surface that takes a card, not a static field on a walk. The honest
   * summary is the whole of what this card adds on the entitled side; the not-entitled side is
   * already wired to `/pricing`, which owns the one checkout.
   */
  const accountPlan =
    entitlement === null
      ? undefined
      : { name: entitlement.planName, entitled: entitlement.paid && entitlement.advancedMode };

  const payment = (
    <InviteWalk
      copy={assessmentCreatePageCopy}
      draft={draft}
      account={
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {itemLabel(sectionOf(assessmentCreatePageCopy, "account"), "signed-in-body")}
        </p>
      }
      {...(accountPlan === undefined ? {} : { accountPlan })}
    />
  );

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={5}
      template={
        detail === undefined
          ? null
          : {
              slug: detail.template.slug,
              recordId: detail.template.id,
              title: detail.template.title,
              summary: detail.template.summary,
              aspectCount: detail.aspects.length,
            }
      }
      draft={draft}
      instanceRecordId={screen.instanceRecordId}
      backHref={commitPath}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
      notice={planNotice?.sentence ?? null}
      noticeLink={planNotice?.link ?? null}
      payment={payment}
    />
  );
}
