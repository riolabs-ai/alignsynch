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
 *   thanks  A thank-you with **no button**. The walk ends here, and the step's one sentence says
 *           where the reader goes next: the send control beside it, or the draft.
 *
 * **This is the purchase.** `startMembership()` opens a subscription Checkout with a seven-day
 * trial and mounts it; the frame's completion calls `confirmMembership()`, which asks the provider
 * what was bought rather than believing the browser. There is no "save a card for later" act: a
 * card reaches an account by buying the membership, and sealing a relationship later costs nothing
 * (#1010 R2).
 *
 * **The walk reports up, it does not own the gate.** `onPaid` tells the stage the membership is
 * live; the stage is what enables the send and what posts it, so a walk that is drawn but not
 * finished can never make the send fire (#911's "doomed if"). The server refuses an unpaid send on
 * its own, in `sendDraftInvitation()` — the UI gate is the courtesy, not the enforcement.
 *
 * **It moves focus like a step, not like a page.** `Next` puts focus on the new step's first
 * control, and the thank-you's heading takes focus so a screen reader is told the walk is over. The
 * first render is deliberately silent: a stage that grabs focus on load steals it from the dialog's
 * own close control.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`plans`, `payment-flow`) through
 * `sectionOf`/`itemLabel`/`fillLabel` — E23 counts what a component writes, and this one writes no
 * sentence.
 */
import { useEffect, useRef, useState } from "react";
import type { PageCopy } from "@/content/pages";
import type { MembershipOutcome } from "@/lib/member/outcomes";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { PlanChoices, type PlanId } from "./plan-choices";
import { StripeFrame } from "@/components/billing/stripe-frame";

/** The walk, in the order the artifact draws it. `plan` is first, `thanks` is the end. */
export const PAY_FLOW_STEPS = ["plan", "card", "thanks"] as const;

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
  relationshipId,
  paid,
  onPaid,
  checkout,
  planIncluded,
  initialStep,
}: {
  copy: PageCopy;
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

  const [step, setStep] = useState<PayFlowStep>(initialStep ?? (paid ? "thanks" : "plan"));
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [starting, setStarting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

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
    setStarting(true);
    try {
      const answer = await checkout.onStart({ planId: plan ?? "basic", interval: "month" });
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
      {/* No button: the walk ends here, and this is the sentence that says where to go. */}
      <p className={SMALL} data-pay-thanks-next="true">
        {itemLabel(flow, "thanks-next")}
      </p>
      <p className={SMALL}>{planLabel(plan)}</p>
    </>
  );

  const panels: Record<PayFlowStep, React.ReactNode> = {
    plan: planPanel,
    card: cardPanel,
    thanks: thanksPanel,
  };

  const headings: Record<PayFlowStep, string> = {
    // The step's name is the plans section's own heading ("Join a membership plan"); the section
    // heading behind the whole walk is the fallback, because both are fixture words and neither can
    // be typed here (E23).
    plan: plans.heading ?? flow.heading ?? "",
    card: itemLabel(flow, "card-heading"),
    thanks: itemLabel(flow, "thanks-heading"),
  };

  return (
    <section
      aria-labelledby="create-pay-heading"
      data-create-plans="true"
      data-pay-step={step}
      data-pay-relationship={relationshipId}
      className={`${CARD} pay-flow-panel`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="create-pay-heading"
          className={HEADING}
          tabIndex={step === "thanks" ? -1 : undefined}
          {...(step === "thanks" ? { "data-panel-first": "true" } : {})}
        >
          {headings[step]}
        </h2>
        {step === "thanks" ? null : (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
            {itemLabel(plans, "trial-short")}
          </span>
        )}
      </div>
      <div ref={panelRef}>{panels[step]}</div>
    </section>
  );
}

/** The fixture's dash, for a plan nobody has chosen yet. `review.none` is the one home for "—". */
function shortCopy(copy: PageCopy) {
  return sectionOf(copy, "review");
}
