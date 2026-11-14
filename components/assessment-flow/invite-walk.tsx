"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the invite stage's left column is a three-step walk — join a plan, save a card, thank you — so the money decision happens in this stage instead of on a pricing page, and the stage's send waits for it)

/**
 * `InviteWalk` — the membership purchase on stage 5 (#771, three steps since #911).
 *
 * **Three steps, and the artifact draws them in this order.** The approved reference is
 * `docs/review/artifacts/prototype-relationship-lifecycle-v9.html`, whose Invite screen puts the pay
 * flow in the left column (`payFlowCard()`) and the send in the right one:
 *
 *   plan    Join a membership plan. The two things the money buys are named here — the plan joined
 *           and the relationship activated — because a price without its purpose is what makes a
 *           checkout feel like a toll.
 *   card    Stripe's checkout fields, mounted **in this panel** from
 *           `components/billing/stripe-frame.tsx`. The session behind them is the membership
 *           subscription (#1010 R2): one monthly plan, both parties, seven days free. Since #912
 *           this walk is that module's **only** caller — the dashboard's capture dialog is deleted,
 *           so there is no second card surface and no second set of card fields.
 *   thanks  A thank-you, and **one button** that opens the last step. It says what the money bought
 *           and hands over; it no longer narrates a control that lives somewhere else (#1014).
 *   action  **The act, inside the walk.** The send — through the same endpoint stage 5 has always
 *           posted to — and, under every panel including this one, **keep the draft**, which is a
 *           navigation: stage 4 already wrote the row as a `draft`, so it cannot make a second one.
 *           Both **land on the relationship** in the member dashboard, at
 *           `/dashboard/relationships/<id>`, in the state the act produced.
 *
 * **Both endings REPLACE the walk's history entry.** The shell's dismissal is a history pop since
 * #1009, so an entry left behind is a dialog Back walks into: the two controls therefore navigate
 * with `replace` (the draft a `next/link replace`, the send a `router.replace` on the answer), and
 * `Back` from the landed relationship goes to whatever the flow was opened from.
 *
 * **The walk reports up, it does not own the gate.** `onPaid` tells the stage the membership is
 * live; the action panel is reachable only from the thank-you, which is reachable only after the
 * purchase, so a walk that is drawn but not finished can never make the send fire (#911's "doomed
 * if"). The server refuses an unpaid send on its own, in `sendDraftInvitation()` — the UI gate is
 * the courtesy, not the enforcement.
 *
 * **It buys the tier the plan row names, never the row's own id.** The panel's rows are the
 * fixture's handles (`one`, `unlimited`), which key its copy; a checkout is named by a
 * `billing_plan` row (`basic`, `principal`). This module used to post the handle and fall back to
 * `"basic"` when nothing was chosen, and both sides are `string`, so the crossing was invisible to
 * the compiler: choosing a plan posted `"one"`, the adapter answered *"one" is not a plan this
 * product sells*, and the card frame never mounted. `PLAN_BILLING_TIER` in
 * `data/pages/assessment-create.ts` is the one map between the two, beside the prices it produces.
 *
 * **It moves focus like a step, not like a page.** `Next` puts focus on the new step's first
 * control — `data-panel-first` — so a screen reader follows the walk. The first render is
 * deliberately silent: a stage that grabs focus on load steals it from the dialog's own close
 * control.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`plans`, `payment-flow`, `invite`)
 * through `sectionOf`/`itemLabel`/`fillLabel` — E23 counts what a component writes, and this one
 * writes no sentence.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PageCopy } from "@/content/pages";
import type { MembershipOutcome } from "@/lib/member/outcomes";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { relationshipPath, sendInvitationPath } from "@/lib/flow/paths";
import { PLAN_BILLING_TIER } from "@/data/pages/assessment-create";
import { PlanChoices, type PlanId } from "./plan-choices";
import { StripeFrame } from "@/components/billing/stripe-frame";

/**
 * The walk, in the order the artifact draws it and the card numbered it: `plan` first, `action` is
 * the act, and the **landing** is not a step — it is the address both controls leave for.
 */
export const PAY_FLOW_STEPS = ["plan", "card", "thanks", "action"] as const;

export type PayFlowStep = (typeof PAY_FLOW_STEPS)[number];

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const SMALL = "text-xs text-gray-600 dark:text-gray-300";
const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:hover:brightness-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-500";
const GHOST =
  "inline-flex h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";

/** One answer from the server, either step. Never throws: a refusal is a drawn state. */
export type CheckoutHandlers = {
  readonly onStart: (payload: { planId?: string; interval?: string }) => Promise<MembershipOutcome>;
  readonly onConfirm: (payload: { checkoutSessionId?: string }) => Promise<MembershipOutcome>;
};

export function InviteWalk({
  copy,
  instanceRecordId,
  relationshipId,
  paid,
  onPaid,
  checkout,
  planIncluded,
  initialStep,
}: {
  copy: PageCopy;
  /**
   * The **session** the send addresses — `?instance=` on this stage, and the id
   * `POST /assessment/instances/<id>/send` takes. It is not the relationship: the send posts to the
   * session's own address and the walk lands on the relationship's.
   */
  instanceRecordId: string;
  /** The relationship stage 4 wrote. The membership covers it, so the send's gate is one fact. */
  relationshipId: string;
  /** The membership is already live — the returning state, or the walk just finished. */
  paid: boolean;
  /** The membership was bought. The stage owns the gate; this only reports. */
  onPaid: () => void;
  /** The server's membership actions. Absent in a render-only test, where nothing can be pressed. */
  checkout?: CheckoutHandlers;
  /**
   * What the account already pays for (#870), when the page measured it. An entitled account gets a
   * **summary** of its tier instead of the radio group — the walk must not ask somebody on a paid
   * tier to join a plan they hold. Absent means "not measured", and the panel is the choice.
   */
  planIncluded?: { readonly name: string; readonly entitled: boolean };
  /** Where the walk starts. Only a test passes this: the stage always starts at the plan. */
  initialStep?: PayFlowStep;
}) {
  const plans = sectionOf(copy, "plans");
  const flow = sectionOf(copy, "payment-flow");
  const invite = sectionOf(copy, "invite");
  const router = useRouter();

  const [step, setStep] = useState<PayFlowStep>(initialStep ?? (paid ? "thanks" : "plan"));
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [starting, setStarting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  /** The send's two states: it is in flight, and what came back when it did not land. */
  const [sending, setSending] = useState(false);
  const [sendRefusal, setSendRefusal] = useState<string | null>(null);

  const plansRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);

  /**
   * The walk's Next moves the *reader* as well as the panel: focus lands on the new step's first
   * control. The first render is skipped on purpose — a stage that grabs focus on load takes it off
   * the dialog's close control, which is where Radix puts it.
   */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const target = panelRef.current?.querySelector<HTMLElement>(
      "[data-panel-first], input[name=plan]",
    );
    target?.focus();
  }, [step]);

  /** The plan chosen in the radio group, read at the moment somebody continues. */
  function chosenPlan(): PlanId | null {
    const checked = plansRef.current?.querySelector<HTMLInputElement>("input[name=plan]:checked");
    return (checked?.value as PlanId | undefined) ?? null;
  }

  const planChosen = plan !== null || (planIncluded !== undefined && planIncluded.entitled);

  /** The plan's own words from the fixture, or the tier the account already holds (#870). */
  function planLabel(picked: PlanId | null): string {
    if (picked === null) return planIncluded?.name ?? itemLabel(shortCopy(copy), "none");
    return `${itemLabel(plans, picked)} · ${itemLabel(plans, `${picked}-price`)}${itemLabel(plans, "per")}`;
  }

  /**
   * Buy the membership. Two answers, and every one of them is drawn:
   *
   *   embedded   the frame mounts in this panel (the hosted adapter with keys), and the frame's
   *              completion confirms it by the session it was minted with
   *   inline     the offline adapter wrote the row inside the request, so the walk is done
   *   refusal    a sentence: no key on this deployment, a tier with no Price, not signed in
   */
  async function startMembership(): Promise<void> {
    setRefusal(null);
    if (checkout === undefined) {
      setRefusal(itemLabel(flow, "card-refused"));
      return;
    }
    if (plan === null) {
      // **No tier, so no checkout.** This control used to post `plan ?? "basic"`, which is the
      // defect this guard replaces: a default nobody chose is a price decided by a fallback, and
      // it hid the crossing the map above exists to make explicit. The card step is entered from
      // the plan panel, whose continue control is disabled until a row is chosen, so the one state
      // that reaches this line is an account measured as entitled while the membership is not live
      // — where the drawn answer is the refusal band (with Back and the draft beside it), never a
      // charge.
      setRefusal(itemLabel(flow, "card-refused"));
      return;
    }
    const planId = PLAN_BILLING_TIER[plan];
    setStarting(true);
    try {
      const answer = await checkout.onStart({ planId, interval: "month" });
      if (!answer.ok) {
        setRefusal(answer.message ?? itemLabel(flow, "card-refused"));
        return;
      }
      if (answer.completed === true) {
        onPaid();
        setStep("thanks");
        return;
      }
      if (answer.clientSecret !== undefined && answer.clientSecret !== null) {
        setClientSecret(answer.clientSecret);
        setPublishableKey(answer.publishableKey ?? null);
        setCheckoutSessionId(answer.checkoutSessionId ?? null);
        return;
      }
      setRefusal(itemLabel(flow, "card-refused"));
    } finally {
      setStarting(false);
    }
  }

  /** The frame reported the purchase: confirm it against the provider, by the session it minted. */
  async function confirmMembership(): Promise<void> {
    if (checkout === undefined || checkoutSessionId === null) {
      setRefusal(itemLabel(flow, "card-refused"));
      return;
    }
    const answer = await checkout.onConfirm({ checkoutSessionId });
    if (!answer.ok) {
      setRefusal(answer.message ?? itemLabel(flow, "card-refused"));
      return;
    }
    onPaid();
    setStep("thanks");
  }

  /**
   * **Send, through the path stage 5 already owns.** The POST goes to
   * `POST /assessment/instances/<id>/send` — the same handler, the same `sendDraftInvitation()`, the
   * same email and the same invite cookie the stage's form used. What changed is who follows the
   * answer: the walk does, so the landing can `replace` the walk's own history entry instead of
   * leaving it behind (the shell's dismissal is a history pop since #1009 — an entry left behind is
   * a dialog `Back` walks into).
   *
   * The answer is a 303 either way, exactly as the form's was: the endpoint's own destination for a
   * send that went out is the relationship, and its destination for one it refused is the refusal
   * band. Following the redirect and reading where it landed is how the two are told apart without
   * a second response shape on the endpoint.
   */
  async function sendInvitation(): Promise<void> {
    setSendRefusal(null);
    setSending(true);
    try {
      const response = await fetch(sendInvitationPath(instanceRecordId), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        // The endpoint reads no body, and it must not be given one: the identity is the session and
        // the party cookie, never a field.
        body: "",
        credentials: "same-origin",
        redirect: "follow",
      });
      const destination = new URL(response.url, window.location.origin);
      // A destination off this origin is not this product — that is a real document navigation.
      if (destination.origin !== window.location.origin) {
        window.location.assign(destination.toString());
        return;
      }
      router.replace(`${destination.pathname}${destination.search}`);
    } catch {
      // The request never reached the app: nothing was sent, and the draft is still the person's.
      setSendRefusal(itemLabel(invite, "send-refused"));
    } finally {
      setSending(false);
    }
  }

  const actionPanel = (
    <>
      <p className={MUTED}>{itemLabel(invite, "cta-body")}</p>
      <p className={SMALL} data-send-explain="open">
        {itemLabel(invite, "active")}
      </p>

      <button
        type="button"
        data-pay-action="send"
        /* The endpoint it POSTs to, so a render says which write this control makes. */
        data-send-endpoint={sendInvitationPath(instanceRecordId)}
        /* The stage's marker since #825, kept: this *is* the send, wherever it is drawn. */
        data-create-send="true"
        data-panel-first="true"
        className={PRIMARY}
        disabled={sending}
        onClick={() => void sendInvitation()}
      >
        {itemLabel(invite, "submit")}
      </button>

      {sendRefusal === null ? null : (
        <p data-pay-refusal="true" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {sendRefusal}
        </p>
      )}
    </>
  );

  const planPanel = (
    <>
      <p className={MUTED}>{sectionBody(plans)}</p>
      {/*
        A measured, already-paying account gets a **summary**, not the radio group (#870): the walk
        would otherwise sell a tier the person holds, and the thank-you would recap a plan nobody
        picked. The words are the fixture's; the tier name is the entitlement's own.
      */}
      {planIncluded !== undefined && planIncluded.entitled ? (
        <div data-pay-plan-included="true">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {itemLabel(plans, "included-plan-label")}
          </p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{planIncluded.name}</p>
          <p className={`mt-2 ${SMALL}`}>
            {fillLabel(itemLabel(plans, "included"), { plan: planIncluded.name })}
          </p>
        </div>
      ) : (
        <div ref={plansRef}>
          <PlanChoices copy={copy} initial={plan ?? undefined} onSelect={setPlan} />
        </div>
      )}

      {/* What the money buys, named: the plan joined, and the relationship it activates. */}
      <div data-pay-buys="true" className="space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {itemLabel(plans, "buys-heading")}
        </p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li className={SMALL}>
            {fillLabel(itemLabel(plans, "buys-join"), { plan: planLabel(plan) })}
          </li>
          <li className={SMALL}>{itemLabel(plans, "buys-activate")}</li>
        </ul>
      </div>

      <p className={SMALL}>{itemLabel(plans, "trial")}</p>

      <button
        type="button"
        data-pay-action="card"
        data-panel-first={planIncluded !== undefined && planIncluded.entitled ? "true" : undefined}
        className={PRIMARY}
        disabled={!planChosen}
        onClick={() => {
          setPlan(chosenPlan());
          setStep("card");
        }}
      >
        {itemLabel(flow, "continue")}
      </button>
    </>
  );

  const cardPanel = (
    <>
      <p className={MUTED}>{itemLabel(flow, "card-body")}</p>
      <p className={SMALL}>{itemLabel(flow, "card-charged")}</p>
      {/* Why the card is being asked for, in the words the send used to carry in the right column
          (#1014): the send is the act this step unlocks, and the draft is always the other choice. */}
      <p className={SMALL} data-send-explain="locked">
        {itemLabel(invite, "locked")}
      </p>

      {clientSecret !== null && publishableKey !== null ? (
        <div
          className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700"
          data-checkout-frame="embedded"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(flow, "card-secure")}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {itemLabel(flow, "card-test-mode")}
            </span>
          </div>
          <StripeFrame
            clientSecret={clientSecret}
            publishableKey={publishableKey}
            placeholder={itemLabel(flow, "card-frame")}
            onComplete={() => void confirmMembership()}
            onError={() => setRefusal(itemLabel(flow, "card-refused"))}
          />
          <p className="px-3 pb-2 text-xs text-gray-600 dark:text-gray-300">
            {itemLabel(flow, "card-frame-note")}
          </p>
        </div>
      ) : (
        <button
          type="button"
          data-pay-action="subscribe"
          data-panel-first="true"
          className={PRIMARY}
          disabled={starting}
          onClick={() => void startMembership()}
        >
          {starting ? itemLabel(flow, "card-starting") : itemLabel(flow, "card-start")}
        </button>
      )}

      {refusal === null ? null : (
        <p data-pay-refusal="true" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {refusal}
        </p>
      )}

      <button
        type="button"
        data-pay-action="plan"
        className={GHOST}
        onClick={() => {
          setRefusal(null);
          setClientSecret(null);
          setCheckoutSessionId(null);
          setStep("plan");
        }}
      >
        {itemLabel(flow, "back")}
      </button>
    </>
  );

  const thanksPanel = (
    <>
      <p className={MUTED}>{itemLabel(flow, "thanks-body")}</p>
      <p className={SMALL}>{planLabel(plan)}</p>
      {/*
        One control, and it opens the act. The step used to be a thank-you with no button whose one
        sentence pointed the reader at a control *beside* the walk (#1014) — the control is in the
        walk now, so the sentence is gone and this is the way to it.
      */}
      <button
        type="button"
        data-pay-action="action"
        data-panel-first="true"
        className={PRIMARY}
        onClick={() => setStep("action")}
      >
        {itemLabel(flow, "continue")}
      </button>
    </>
  );

  const panels: Record<PayFlowStep, React.ReactNode> = {
    plan: planPanel,
    card: cardPanel,
    thanks: thanksPanel,
    action: actionPanel,
  };

  const headings: Record<PayFlowStep, string> = {
    // The step's name is the plans section's own heading ("Join a membership plan"); the section
    // heading behind the whole walk is the fallback, because both are fixture words and neither can
    // be typed here (E23).
    plan: plans.heading ?? flow.heading ?? "",
    card: itemLabel(flow, "card-heading"),
    thanks: itemLabel(flow, "thanks-heading"),
    // The act's own heading, which is the stage's heading too: this is the step where the
    // relationship either goes out or does not.
    action: itemLabel(invite, "cta-heading"),
  };

  return (
    <section
      aria-labelledby="create-pay-heading"
      data-create-plans="true"
      data-pay-step={step}
      data-pay-relationship={relationshipId}
      /*
        The gate's state, where the act now is. Stage 5's send is one click past the thank-you, and
        the thank-you is only reachable once the membership is live, so `locked` is "the walk has not
        been paid for yet" and there is no send control to press.
      */
      data-send-gate={paid ? "open" : "locked"}
      className={`${CARD} pay-flow-panel`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="create-pay-heading" className={HEADING}>
          {headings[step]}
        </h2>
        {step === "thanks" ? null : (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
            {itemLabel(plans, "trial-short")}
          </span>
        )}
      </div>
      <div ref={panelRef}>{panels[step]}</div>

      {/*
        **Keeping the draft is the other choice at every step**, which is why this control sits
        outside the panels rather than inside the last one: an unpaid reader whose mind is made up
        must not have to pay to get to it. It is a navigation and never a write — stage 4 wrote the
        row as a `draft` and the send is the only thing that ever publishes it — so pressing it twice
        is the same one draft, and `replace` consumes the walk's history entry exactly as the send's
        landing does (the shell's dismissal is a pop since #1009).
      */}
      <Link
        href={relationshipPath(relationshipId)}
        replace
        data-pay-action="draft"
        /* The stage's marker since #825, kept: this *is* the keep-as-draft control. */
        data-create-keep-draft="true"
        className={GHOST}
      >
        {itemLabel(invite, "draft")}
      </Link>
    </section>
  );
}

/** The fixture's dash, for a plan nobody has chosen yet. `review.none` is the one home for "—". */
function shortCopy(copy: PageCopy) {
  return sectionOf(copy, "review");
}
