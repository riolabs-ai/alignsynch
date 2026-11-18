/**
 * template-ancestor: components/flow/template-create/commit.tsx   (variation: the outcome — the same route reading, mounting the send-or-keep decision for a relationship that already exists instead of the screen that writes it)
 *
 * `/dashboard/templates/[slug]/create/invite` — the create flow's stage 5, **Invite** (#825).
 *
 * The stage where the relationship stage 4 wrote as a `draft` either goes out or does not. Two acts,
 * one write: **Send and Continue** posts `POST /assessment/instances/[id]/send`, which publishes the
 * relationship and mails the one invitation; **Continue as Draft** is a link to the dashboard, where
 * the draft is under My relationships. Nothing is sent until Send is pressed, and keeping it as a
 * draft costs nothing.
 *
 * **No stage of this flow takes a card (#1115).** The account's seven-day trial is opened by the
 * **Counterparty's acceptance** — `grantAcceptanceTrial()` in `lib/db/billing.ts`, called from the
 * claim's own transaction — so a draft and a pending invitation consume no trial days and this page
 * has no week's end to print until somebody accepts. The walk on this page states the week, its
 * primary action is `Continue with 7 days free`, and this page hands over **no** checkout action at
 * all: it imports none of the membership actions, so a card cannot come back through this file
 * without the ratchet in `tests/trial-no-payment-inputs.test.tsx` failing on the import line. Those
 * actions belong to the explicit upgrade action, the one caller of
 * `payment_method_collection: "always"`.
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
 * **The trial's end is read once, here.** `trialStateOf()` over the account's live subscription at
 * this request's instant — the same read every later surface (band, emails, lapse) asks — and the
 * instant is handed to the walk as a date. A client clock never recomputes it: two people opening
 * one account must read the same day.
 *
 * `force-dynamic`: the screen read is a database read and the party cookie is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import type { FlowMount } from "@/components/assessment-flow/relationship-flow-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { readActiveSubscription } from "@/lib/db/billing";
import { entitlementForAccount } from "@/lib/billing";
import { trialStateOf } from "@/lib/billing/trial";
import { createRefusal } from "@/lib/flow/create-copy";
import { carriedPlanOf, parsePlanIntent } from "@/lib/flow/plan-intent";
import {
  createCommitForPath,
  createRelationshipPath,
  relationshipIdFromSearch,
} from "@/lib/flow/paths";
import { partyCookieName, PLAN_INTENT_COOKIE } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send the invitation",
};

type InviteParams = {
  readonly problem?: string | string[];
  readonly field?: string | string[];
  /**
   * The relationship stage 4 wrote arrives in the address, and the page does **not** name that key
   * here: `relationshipIdFromSearch()` (`lib/flow/paths.ts`) owns it, because the reader used to spell
   * `?session=` while the writer wrote `?instance=` — so this stage refused a create that had just
   * succeeded and sent the person back to an empty stage 1 (#1216). The index signature is what lets
   * the address carry a key no stage may name twice.
   */
  readonly [key: string]: string | string[] | undefined;
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateInvitePage({
  params,
  searchParams,
  mount = "page",
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<InviteParams>;
  /**
   * **Where the shell mounts this stage (#979 B).** A stage's own route says nothing and gets the
   * `page` mounting — the deep link, the refresh, the invitation link. The intercepted route under
   * `dashboard/relationships/@flow/**` passes `dialog`, and the same render is drawn over the page
   * the flow was started from. Nothing else in this file depends on it.
   */
  mount?: FlowMount;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(slug);
  // #1216 — the id is read through the same name the create's redirect writes it under. This used
  // to name `?session=` itself, which no writer produced: the stage then answered "nothing was
  // created by this browser" on a create that had just succeeded, and the draft cookie that create
  // consumed made the landing an empty stage 1.
  const sessionRecordId = relationshipIdFromSearch(query);

  // No relationship named: nothing was created by this browser in this flow.
  if (sessionRecordId === "") redirect(whoPath);

  const jar = await cookies();
  const viewer = await currentUserIfConfigured();
  const detail = await readLibraryTemplate(slug, viewer?.userId ?? null);
  // #870 — the refusal's door: the template's own page (by slug) and its editor (by id).
  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field), {
    slug,
    ...(detail === undefined ? {} : { recordId: detail.template.id }),
  });

  const screen = await readFlowScreen({
    sessionRecordId,
    token: jar.get(partyCookieName(sessionRecordId))?.value,
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
   * **The walk, and the week it states (#1115 supersedes #870/#1043's capture wiring).**
   *
   * The stage draws the walk on the left and the two sentences that make a draft safe on the right.
   * Three facts arrive as props, and none of them is a payment handler any more:
   *
   *   `trialEndsAt`  the instant the creating account's free week closes, from the **one** read
   *                  (`trialStateOf`) over the account's live subscription. It is what turns the
   *                  walk into its card-free panel: the plan is a comparison, the action is
   *                  `Continue with 7 days free`, and no step of the walk can reach a checkout. On a
   *                  brand-new draft the week has not started — it opens when the Counterparty
   *                  accepts (spec D3) — so this is `undefined` and the panel states the week
   *                  without a date, which is the honest answer at that instant.
   *   `initialPaid`  whether a **paid** membership is already live — a Stripe row, not a trial. A
   *                  person who has paid lands one press from the act instead of being sold the
   *                  plan again; a person inside their trial lands on the panel that names the week,
   *                  which is the whole point of showing the date.
   *   `planIncluded` what the account's plan already covers, so the panel states the tier instead
   *                  of drawing a radio group for a plan the account holds (the trial entitles at
   *                  Basic, so a fresh creator sees `Your plan · Basic` beside the free continue).
   *
   * **`initialPaid` is `subscriptionLive` *and* not a trial.** `subscriptionLive` is true for the
   * trialing row too, and opening the walk on its thank-you for that would hide the trial's end and
   * the free continue — the two things this stage exists to show.
   */
  const liveSubscription = viewer === null ? null : await readActiveSubscription(viewer.userId);
  const trial = trialStateOf(liveSubscription, new Date());
  const trialEndsAt =
    trial.state === "active" || trial.state === "ending" ? trial.endsAt.toISOString() : undefined;

  const accountPlan =
    entitlement === null
      ? undefined
      : { name: entitlement.planName, entitled: entitlement.paid && entitlement.advancedMode };

  /**
   * **The plan `/pricing` carried through the catalogue, the template and the account (#1043).**
   *
   * Read from the browser, not from a query string: the choice was made before a template existed and
   * has to survive four pages that are prerendered on purpose, the sign-in at stage 4 and a reload,
   * which is exactly what a cookie is for (`lib/flow/plan-intent.ts`). `carriedPlanOf()` is the
   * crossing back from a *billing* tier to the *row* this panel draws, and it answers `null` for a
   * value the catalogue does not sell — so a hand-edited cookie draws the ordinary unselected panel
   * instead of a plan nobody can buy.
   *
   * A carried plan is a **preselection, never a payment**: the walk still opens on this panel, the
   * membership still starts from it, and the send's paid gate (`sendDraftInvitation()`) is untouched.
   */
  const carriedPlan = carriedPlanOf(parsePlanIntent(jar.get(PLAN_INTENT_COOKIE)?.value));

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={5}
      signedIn={viewer !== null}
      mount={mount}
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
      sessionRecordId={screen.sessionRecordId}
      relationshipId={screen.relationshipId}
      // #1216 — `Back` names the relationship, so stage 4 re-enters on the row it already wrote
      // instead of finding no draft and starting the flow again from an empty stage 1.
      backHref={createCommitForPath(slug, screen.sessionRecordId)}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
      notice={planNotice?.sentence ?? null}
      noticeLink={planNotice?.link ?? null}
      {...(trialEndsAt === undefined ? {} : { trialEndsAt })}
      initialPaid={screen.subscriptionLive === true && trial.state === "none"}
      {...(accountPlan === undefined ? {} : { planIncluded: accountPlan })}
      {...(carriedPlan === null ? {} : { carriedPlan })}
    />
  );
}
