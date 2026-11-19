"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the invite stage's left column is a three-step walk — join a plan, save a card, thank you — so the money decision happens in this stage instead of on a pricing page, and the stage's send waits for it)

/**
 * `InviteWalk` — stage 5's walk (#771, three steps since #911), **card-free on the create path**
 * since #1115.
 *
 * **Two callers, two panels, and one of them never asks for a card.** The create flow mounts this
 * walk with no `checkout` handler at all (#1115 task 3): the relationship has already been written
 * *and its seven-day trial granted with it* (spec D2/D3), so the panel's job is to say what the
 * week is and let the reader through — the primary action reads `Continue with 7 days free` and
 * opens the act. Every payment control below (a row selection starting a checkout, the card step,
 * the thank-you) stays in the module for the **explicit upgrade action**, which is the only caller
 * of the adapter's `payment_method_collection: "always"` and passes the handler. A create render
 * therefore contains zero payment inputs, and `tests/trial-no-payment-inputs.test.tsx` holds that.
 *
 * **The trial's end is a date the server measured.** `trialEndsAt` arrives as the instant
 * `trialStateOf()` read (`lib/billing/trial.ts`) and is printed through `formatDateLong`, a pure
 * function of that instant on UTC getters — never a browser countdown, so two people on one account
 * cannot read two different numbers off the same trial.
 *
 * **Three steps, and the artifact draws them in this order.** The approved reference is
 * `docs/review/artifacts/prototype-relationship-lifecycle-v9.html`, whose Invite screen puts the pay
 * flow in the left column (`payFlowCard()`) and the send in the right one:
 *
 *   plan    Join a membership plan. The two things the money buys are named here — the plan joined
 *           and the relationship activated — because a price without its purpose is what makes a
 *           checkout feel like a toll. **Choosing a row is the act** (#1031): the row's selection
 *           advances the walk and starts the session, so there is no control between reading a
 *           price and seeing the card fields.
 *   card    Stripe's checkout fields, mounted **in this panel** from
 *           `components/billing/stripe-frame.tsx`. The session behind them is the membership
 *           subscription (#1010 R2): one monthly plan, both parties, seven days free. Since #912
 *           this walk is that module's **only** caller — the dashboard's capture dialog is deleted,
 *           so there is no second card surface and no second set of card fields. The frame's mount
 *           point is drawn **on the reveal** and the session is minted behind it, so a step that
 *           opens is a step that is already loading; a failure replaces the frame with a sentence
 *           in the step itself, never an alert over a control that would fail again.
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
 * **It buys the tier the plan row names, never the row's own id.** The panel's rows are the plan
 * catalogue's handles (`single`, `annual`), which key its copy; a checkout is named by a
 * `billing_plan` row (`basic`, `principal`) at an interval. This module used to post the handle and
 * fall back to `"basic"` when nothing was chosen, and both sides are `string`, so the crossing was
 * invisible to the compiler: choosing a plan posted `"one"`, the adapter answered *"one" is not a
 * plan this product sells*, and the card frame never mounted. `data/membership-plans.ts` holds the
 * one row per plan — its tier, its interval and its amount — and `membershipPlan()` is how this
 * module reads it.
 *
 * **It moves focus like a step, not like a page.** The reveal puts focus on the step's first
 * control — `data-panel-first` — so a screen reader follows the walk; on the card step that target
 * is the frame's own mount point, which is why it carries `tabIndex={-1}` rather than being a
 * button. The first render is deliberately silent: a stage that grabs focus on load steals it from
 * the dialog's own close control.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`plans`, `payment-flow`, `invite`)
 * through `sectionOf`/`itemLabel`/`fillLabel` — E23 counts what a component writes, and this one
 * writes no sentence.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PageCopy } from "@/content/pages";
import { formatDateLong } from "@/content/core";
import type { MembershipOutcome } from "@/lib/member/outcomes";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import type { CarriedPlan } from "@/lib/flow/plan-intent";
import { relationshipPath, sendInvitationPath } from "@/lib/flow/paths";
import { membershipPlan } from "@/data/membership-plans";
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
  sessionRecordId,
  relationshipId,
  paid,
  onPaid,
  checkout,
  planIncluded,
  carriedPlan,
  trialEndsAt,
  initialStep,
}: {
  copy: PageCopy;
  /**
   * The **session** the send addresses — `?instance=` on this stage, and the id
   * `POST /assessment/instances/<id>/send` takes. It is not the relationship: the send posts to the
   * session's own address and the walk lands on the relationship's.
   */
  sessionRecordId: string;
  /** The relationship stage 4 wrote. The membership covers it, so the send's gate is one fact. */
  relationshipId: string;
  /** The membership is already live — the returning state, or the walk just finished. */
  paid: boolean;
  /** The membership was bought. The stage owns the gate; this only reports. */
  onPaid: () => void;
  /** The server's membership actions. Absent in a render-only test, where nothing can be pressed. */
  checkout?: CheckoutHandlers;
  /**
   * **The trial's end, as the server read it** (#1115).
   *
   * An ISO instant, produced by `trialStateOf()` on the page and rendered here as a date. It is
   * **optional**, and absent is the ordinary state of a brand-new draft: the week opens when the
   * Counterparty accepts (spec D3), so before that acceptance there is no instant to name and no
   * countdown to draw. Presence is what adds the date line; the card-free panel itself depends on
   * there being no checkout handler (`cardFree` below), not on this.
   */
  trialEndsAt?: string;
  /**
   * What the account already pays for (#870), when the page measured it. An entitled account gets a
   * **summary** of its tier instead of the radio group — the walk must not ask somebody on a paid
   * tier to join a plan they hold. Absent means "not measured", and the panel is the choice.
   */
  planIncluded?: { readonly name: string; readonly entitled: boolean };
  /**
   * The plan the reader chose on `/pricing`, carried through the catalogue, the template, stage 1 and
   * the account round-trip (#1043). The row is drawn **already selected** and the checkout this panel
   * starts uses the interval that came with it, so nobody is asked for a choice they have made.
   *
   * Absent is the ordinary state and it means "nothing was carried": the rows open unselected and
   * choosing one is still the act (#1031). A carried plan is a **preselection, never a payment** —
   * the membership still starts from this panel, and the send's paid gate is untouched.
   */
  carriedPlan?: CarriedPlan;
  /** Where the walk starts. Only a test passes this: the stage always starts at the plan. */
  initialStep?: PayFlowStep;
}) {
  const plans = sectionOf(copy, "plans");
  const flow = sectionOf(copy, "payment-flow");
  const invite = sectionOf(copy, "invite");
  const router = useRouter();

  const [step, setStep] = useState<PayFlowStep>(initialStep ?? (paid ? "thanks" : "plan"));
  /**
   * **The carried plan opens the panel already chosen** (#1043), and it is state rather than a prop
   * read because Back has to restore it: returning from the card step must land on the panel the
   * reader arrived at, not on one whose rows are all unselected again.
   */
  const [plan, setPlan] = useState<PlanId | null>(carriedPlan?.row ?? null);
  const [starting, setStarting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  /** The send's two states: it is in flight, and what came back when it did not land. */
  const [sending, setSending] = useState(false);
  const [sendRefusal, setSendRefusal] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);

  /** The provider's frame can mount: the session and the key that opens it are both in hand. */
  const frameReady = clientSecret !== null && publishableKey !== null;

  /**
   * **The card-free create panel** (#1115): the page supplied no checkout handler, which is what
   * "this is the create path" means. The week's *end* is optional beside that fact, and it is
   * absent for a creator whose Counterparty has not accepted yet — the trial opens at the
   * acceptance (spec D3), so there is no instant to print and the panel shows the week without a
   * date. Gating the panel on a measured date instead would send a brand-new creator to the
   * purchase panel for a plan they do not need yet.
   */
  const cardFree = checkout === undefined;

  /** The trial's end as a reader sees it — the server instant through the tree's UTC formatter. */
  const trialDate = trialEndsAt === undefined ? null : formatDateLong(trialEndsAt);

  /**
   * The account's plan already covers a tier (#870): its panel is a summary, not the radio group, and
   * the card step is the only place it can go from there.
   */
  const planEntitled = planIncluded?.entitled === true;

  /**
   * The plan this panel actually shows as chosen (#1043) — `undefined` when nothing was carried, and
   * when the account's own plan makes the rows a summary instead (an entitled reader has no choice to
   * carry, and a marker saying otherwise would be a claim about a panel that draws no rows). It is
   * also the attribute below, so the rendered page states what it carried rather than leaving a
   * reader to infer it from a checked radio.
   */
  const carriedShown = planEntitled ? undefined : carriedPlan;

  /**
   * The walk's step change moves the *reader* as well as the panel: focus lands on the new step's
   * first control. The first render is skipped on purpose — a stage that grabs focus on load takes
   * it off the dialog's close control, which is where Radix puts it.
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

  /** The plan's own words from the fixture, or the tier the account already holds (#870). */
  function planLabel(picked: PlanId | null): string {
    if (picked === null) return planIncluded?.name ?? itemLabel(shortCopy(copy), "none");
    return `${itemLabel(plans, picked)} · ${itemLabel(plans, `${picked}-price`)}${itemLabel(plans, `${picked}-interval`)}`;
  }

  /**
   * Buy the membership. Two answers, and every one of them is drawn:
   *
   *   embedded   the frame mounts in this panel (the hosted adapter with keys), and the frame's
   *              completion confirms it by the session it was minted with
   *   inline     the offline adapter wrote the row inside the request, so the walk is done
   *   refusal    a sentence: no key on this deployment, a tier with no Price, not signed in
   *
   * **`picked` is handed in, never read from state.** Since #1031 the choice and the step change are
   * one act, so the `plan` this render holds is a render behind the row that was just chosen.
   */
  async function startMembership(picked: PlanId | null): Promise<void> {
    setRefusal(null);
    if (checkout === undefined) {
      setRefusal(itemLabel(flow, "card-refused"));
      return;
    }
    if (picked === null) {
      // **No tier, so no checkout.** This used to post `plan ?? "basic"`, which is the defect this
      // guard replaces: a default nobody chose is a price decided by a fallback, and it hid the
      // crossing the map above exists to make explicit. The card step is entered by choosing a row,
      // so the one state that reaches this line is an account measured as entitled while the
      // membership is not live — where the drawn answer is the refusal band (with Back and the draft
      // beside it), never a charge.
      setRefusal(itemLabel(flow, "card-refused"));
      return;
    }
    const chosen = membershipPlan(picked);
    if (chosen === null || chosen === undefined) {
      setRefusal(itemLabel(flow, "card-refused"));
      return;
    }
    setStarting(true);
    try {
      /**
       * **The interval is the row's own, unless `/pricing` carried one** (#1043, #1127). The three
       * plans are (tier, interval) pairs — Single Annual is `basic` billed yearly — so the row
       * decides the unit: it defaults to the plan's interval rather than to `month`, which would
       * quietly re-bill an annual plan monthly. A carried interval still wins, because it is the one
       * the reader chose on `/pricing`.
       */
      const planId = chosen.tier;
      const interval = carriedPlan?.interval ?? chosen.interval;
      const answer = await checkout.onStart({ planId, interval });
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

  /**
   * **Choosing a plan is the act** (#1031). One gesture does what two presses used to: the row's
   * selection is the choice, the step change is the reveal, and the checkout starts behind the frame
   * that mounts on it. The old shape drew `Enter the card` on the plan panel and `Opening the card
   * fields…` on the card panel, so the press *was* the load and a failure to start arrived as an
   * alert over a control that would fail identically again.
   *
   * `null` is the entitled account (#870), whose panel is a summary with no row to click — the
   * summary is the choice, and its one control calls this with no tier, which `startMembership`
   * answers with the refusal band rather than a charge.
   */
  function choosePlan(picked: PlanId | null): void {
    if (picked !== null) setPlan(picked);
    setClientSecret(null);
    setPublishableKey(null);
    setCheckoutSessionId(null);
    setStep("card");
    void startMembership(picked);
  }

  /**
   * **The free week is the act on the create path** (#1115).
   *
   * One press and no money: the relationship exists and its trial was granted in the same
   * transaction that wrote it, so this only opens the send — `onPaid` reports the fact the stage's
   * gate reads, and the walk moves straight to the act. The thank-you is deliberately skipped: its
   * sentence says a card is on file, and on this path nothing was ever asked for.
   */
  function startFreeTrial(): void {
    setRefusal(null);
    onPaid();
    setStep("action");
  }

  /**
   * Back to the plan panel, with the checkout forgotten and **the choice cleared** — or restored,
   * when a plan was carried (#1043).
   *
   * Clearing is what makes the ordinary return honest: a native radio fires no `change` when it is
   * already checked, so a panel that kept a *clicked* selection would be a step nobody could leave
   * twice. A **carried** plan is the opposite case — it arrived checked, and the panel's own continue
   * control is what opens the card step — so returning to it must draw the state the reader arrived
   * at, or Back would silently throw away the choice they made on `/pricing`.
   */
  function backToPlan(): void {
    setRefusal(null);
    setClientSecret(null);
    setPublishableKey(null);
    setCheckoutSessionId(null);
    setPlan(carriedPlan?.row ?? null);
    setStep("plan");
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
      const response = await fetch(sendInvitationPath(sessionRecordId), {
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
        data-send-endpoint={sendInvitationPath(sessionRecordId)}
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
      {planEntitled ? (
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
        <PlanChoices
          copy={copy}
          initial={plan ?? undefined}
          /* A row's selection reports the preference and nothing more on the create path (#1115):
             nothing here blocks progress, and nothing here opens a checkout. The purchase path
             keeps #1031's "choosing a row is the act". */
          onSelect={cardFree ? (picked: PlanId) => setPlan(picked) : choosePlan}
        />
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

      {cardFree ? (
        /**
         * **The create path's panel** (#1115): the week, when it ends, and one action that takes
         * neither a plan nor a card. The trial is already running — it opened with the relationship
         * in the transaction that wrote it — so there is nothing here to join, and the price list
         * above is a comparison, not an offer.
         *
         * The end is printed from the instant the page measured (`trialEndsAt`), never from a
         * browser clock: two people opening one account read the same date.
         */
        <>
          <p className={SMALL}>{itemLabel(plans, "trial-free")}</p>
          <p className={SMALL} data-trial-ends={trialEndsAt}>
            {trialDate === null
              ? null
              : fillLabel(itemLabel(plans, "trial-ends"), { date: trialDate })}
          </p>
          <button
            type="button"
            data-pay-action="continue"
            data-panel-first="true"
            className={PRIMARY}
            onClick={startFreeTrial}
          >
            {itemLabel(plans, "free-continue")}
          </button>
        </>
      ) : (
        <>
          <p className={SMALL}>{itemLabel(plans, "trial")}</p>

          {/* The entitled account has no row to choose, so its panel needs the one control that is
              the act everywhere else. It opens the card step with no tier, which the walk answers as
              a refusal rather than a charge (#870). Nothing else on this panel is a button
              (#1031). */}
          {planEntitled ? (
            <button
              type="button"
              data-pay-action="continue"
              data-panel-first="true"
              className={PRIMARY}
              onClick={() => choosePlan(null)}
            >
              {itemLabel(flow, "continue")}
            </button>
          ) : null}
          {/*
            **A carried plan is a choice already made, so its panel needs the control that opens the
            card step** (#1043). The row arrived checked — and a native radio fires no `change` when
            it is already checked — so without this button the panel would be a step nobody could
            leave without changing their mind first. It carries the *same* `data-pay-action` as the
            entitled account's control because it is the same act: open the card step with the row
            this panel shows. Choosing the other row still starts the checkout directly, exactly as
            it does when nothing was carried.
          */}
          {planEntitled || carriedPlan === undefined ? null : (
            <button
              type="button"
              data-pay-action="continue"
              data-panel-first="true"
              className={PRIMARY}
              onClick={() => choosePlan(carriedPlan.row)}
            >
              {itemLabel(flow, "continue")}
            </button>
          )}
        </>
      )}
    </>
  );

  /**
   * **The card step is a reveal, not a two-press walk** (#1031). The frame's mount point is drawn
   * the moment the step opens and the session is minted behind it, so `opening` is the step's first
   * state and `embedded` the provider's frame once there is a secret for it. A failure replaces the
   * frame with a sentence **in this step** — never a dialog beside a control that would fail
   * identically — and the two ways out stay: Back, and the draft at the foot of the walk.
   */
  const cardPanel = (
    <>
      <p className={MUTED}>{itemLabel(flow, "card-body")}</p>
      <p className={SMALL}>{itemLabel(flow, "card-charged")}</p>
      {/* Why the card is being asked for, in the words the send used to carry in the right column
          (#1014): the send is the act this step unlocks, and the draft is always the other choice. */}
      <p className={SMALL} data-send-explain="locked">
        {itemLabel(invite, "locked")}
      </p>

      {refusal !== null ? (
        <p data-pay-refusal="true" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {refusal}
        </p>
      ) : (
        <div
          tabIndex={-1}
          data-panel-first="true"
          data-checkout-frame={frameReady ? "embedded" : "opening"}
          className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(flow, "card-secure")}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {itemLabel(flow, "card-test-mode")}
            </span>
          </div>
          {frameReady ? (
            <StripeFrame
              clientSecret={clientSecret}
              publishableKey={publishableKey}
              placeholder={itemLabel(flow, "card-frame")}
              onComplete={() => void confirmMembership()}
              onError={() => setRefusal(itemLabel(flow, "card-refused"))}
            />
          ) : (
            /* A status, not a refusal: the step is doing what it was opened to do. */
            <p
              data-checkout-pending="true"
              role="status"
              className="px-3 py-6 text-center text-xs text-gray-600 dark:text-gray-300"
            >
              {starting ? itemLabel(flow, "card-starting") : itemLabel(flow, "card-frame")}
            </p>
          )}
          <p className="px-3 pb-2 text-xs text-gray-600 dark:text-gray-300">
            {itemLabel(flow, "card-frame-note")}
          </p>
        </div>
      )}

      <button type="button" data-pay-action="plan" className={GHOST} onClick={backToPlan}>
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
        The plan `/pricing` carried into this walk (#1043), or nothing. The plan panel draws it as a
        checked row; this attribute is what makes the carry readable from the render itself.
      */
      data-plan-carried={carriedShown?.planId}
      data-plan-carried-interval={carriedShown?.interval}
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
