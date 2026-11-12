"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the invite stage's left column is a five-panel walk — plan, account, method, confirmation, done — so the pay decision happens in this stage instead of on a pricing page)

/**
 * `InviteWalk` — the payment decision, walked **in place** on stage 5 (#771, moved by #825).
 *
 * **Why this is a client component of its own.** The walk is one panel at a time, chosen by state;
 * stage 5's other column is server markup, so a client boundary here is what lets the state live
 * without turning the whole stage client-side. It used to also own the stage's foot — the advance
 * read "Create relationship and send invite" until the walk finished and "Complete and Connect"
 * after — and that coupling is gone with v9: the send is stage 5's own act and its label does not
 * depend on which panel is open, so the foot belongs to the stage, not to the walk.
 *
 * **Nothing here charges, and nothing here blocks.** The owner's rule is a soft prompt at the
 * invite and a hard gate at publish: choosing a plan commits nothing, the walk's method step defers
 * the capture to publish, and the send goes through either way.
 *
 * **The account panel is a confirmation, not a form** (#825). The account is stage 4, so by the time
 * this stage draws, the person has one; `account` is the sentence that says so, passed in by the
 * page. A sign-up form here would be the second implementation of sign-in the spec forbids.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`plans`, `payment-flow`) through
 * `sectionOf`/`itemLabel` — E23 counts what a component writes, and this one writes none.
 */
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { personName } from "@/lib/flow/names";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { PlanChoices, type PlanId } from "./plan-choices";

/** The walk, in the order the artifact draws it. `plan` is the first panel, `done` the last. */
export const PAY_FLOW_STEPS = ["plan", "account", "method", "confirm", "done"] as const;

export type PayFlowStep = (typeof PAY_FLOW_STEPS)[number];

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const SMALL = "text-xs text-gray-600 dark:text-gray-300";
const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-white hover:brightness-95";
const GHOST =
  "inline-flex h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";

export function InviteWalk({
  copy,
  draft,
  account,
  accountPlan,
  initialStep,
}: {
  copy: PageCopy;
  /** The three stages' answers, so the confirmation can recap what is being sent. */
  draft: CreateDraft;
  /** The signed-in confirmation for the walk's account panel (#825). */
  account: ReactNode;
  /**
   * What the account already pays for (#870), when the page measured it.
   *
   * The walk's first panel used to always be the plan radio group, which asks somebody who is
   * already on a paid tier to buy again. With this prop the panel becomes a **summary** — the tier's
   * own name and the entitlement sentence (Advanced Mode is included) — and the walk starts at the
   * decision it actually has left, which is the account, the method and the confirm.
   *
   * Absent means "not measured", and the panel is the radio group: a rendered test with no database
   * must not be shown a plan summary nobody read. Nothing here charges either way — that is the
   * owner's rule and `tests/payment-flow.test.ts` pins it.
   */
  accountPlan?: { readonly name: string; readonly entitled: boolean };
  /** Where the walk starts. Only a test passes this: the page always starts at the plan. */
  initialStep?: PayFlowStep;
}) {
  const plans = sectionOf(copy, "plans");
  const flow = sectionOf(copy, "payment-flow");
  const review = sectionOf(copy, "review");

  const [step, setStep] = useState<PayFlowStep>(initialStep ?? "plan");
  const [plan, setPlan] = useState<PlanId | null>(null);
  const plansRef = useRef<HTMLDivElement | null>(null);

  /** The plan chosen in the radio group, read at the moment somebody continues. */
  function chosenPlan(): PlanId | null {
    const checked = plansRef.current?.querySelector<HTMLInputElement>("input[name=plan]:checked");
    return (checked?.value as PlanId | undefined) ?? null;
  }

  /** The confirmation's recap: the plan's own name from the fixture, or the fixture's dash. */
  function planLabel(): string {
    // A measured account answers with the tier it already holds (#870): the walk drew no radio
    // group, so there is no chosen id to print.
    if (accountPlan !== undefined && accountPlan.entitled) return accountPlan.name;
    if (plan === null) return itemLabel(review, "none");
    return `${itemLabel(plans, plan)} · ${itemLabel(plans, `${plan}-price`)}${itemLabel(plans, "per")}`;
  }

  /** Is the first panel a summary of what the account already has, rather than a choice? */
  const planIncluded = accountPlan !== undefined && accountPlan.entitled;

  const panels: Record<PayFlowStep, ReactNode> = {
    plan: (
      <>
        <p className={MUTED}>{sectionBody(plans)}</p>
        {/*
         * A measured, already-paying account gets a **summary**, not the radio group (#870).
         * Asking somebody on a paid tier to choose a plan is the upsell bug in reverse: the walk
         * would be selling a tier they already hold, and the confirm panel would then print
         * "—" for a plan they never picked. The words are the fixture's; `accountPlan.name` is
         * the entitlement's own tier name, so a renamed tier cannot leave a stale label here.
         */}
        {planIncluded ? (
          <div data-pay-plan-included="true">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {itemLabel(plans, "included-plan-label")}
            </p>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{accountPlan?.name}</p>
            <p className={`mt-2 ${SMALL}`}>
              {fillLabel(itemLabel(plans, "included"), { plan: accountPlan?.name ?? "" })}
            </p>
          </div>
        ) : (
          <div ref={plansRef}>
            <PlanChoices copy={copy} initial={plan ?? undefined} />
          </div>
        )}
        <p className={SMALL}>{itemLabel(plans, "trial")}</p>
        <p className={SMALL}>{itemLabel(plans, "add-method-note")}</p>
        <button
          type="button"
          data-pay-action="account"
          className={PRIMARY}
          onClick={() => {
            setPlan(chosenPlan());
            setStep("account");
          }}
        >
          {itemLabel(flow, "continue")}
        </button>
      </>
    ),
    account: (
      <>
        {account}
        <div className="flex gap-2">
          <button
            type="button"
            data-pay-action="plan"
            className={GHOST}
            onClick={() => setStep("plan")}
          >
            {itemLabel(flow, "back")}
          </button>
          <button
            type="button"
            data-pay-action="method"
            className={PRIMARY}
            onClick={() => setStep("method")}
          >
            {itemLabel(flow, "continue")}
          </button>
        </div>
      </>
    ),
    method: (
      <>
        <p className={SMALL}>{itemLabel(flow, "method-note")}</p>
        <p className={SMALL}>{itemLabel(flow, "method-defer-note")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            data-pay-action="account"
            className={GHOST}
            onClick={() => setStep("account")}
          >
            {itemLabel(flow, "back")}
          </button>
          <button
            type="button"
            data-pay-action="confirm"
            className={PRIMARY}
            onClick={() => setStep("confirm")}
          >
            {itemLabel(flow, "method-defer")}
          </button>
        </div>
      </>
    ),
    confirm: (
      <>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3" data-pay-recap="plan">
            <dt className="text-gray-500 dark:text-gray-400">{itemLabel(flow, "confirm-plan")}</dt>
            <dd className="text-right text-gray-900 dark:text-gray-100">{planLabel()}</dd>
          </div>
          <div className="flex justify-between gap-3" data-pay-recap="method">
            <dt className="text-gray-500 dark:text-gray-400">
              {itemLabel(flow, "confirm-method")}
            </dt>
            <dd className="text-right text-gray-900 dark:text-gray-100">
              {itemLabel(flow, "confirm-method-draft")}
            </dd>
          </div>
          <div className="flex justify-between gap-3" data-pay-recap="counterparty">
            <dt className="text-gray-500 dark:text-gray-400">{itemLabel(flow, "confirm-to")}</dt>
            <dd className="text-right text-gray-900 dark:text-gray-100">
              {fillLabel(itemLabel(flow, "confirm-to-value"), {
                name: personName(draft.counterpartyFirst, draft.counterpartyLast),
                email: draft.email,
              })}
            </dd>
          </div>
          <div className="flex justify-between gap-3" data-pay-recap="mode">
            <dt className="text-gray-500 dark:text-gray-400">{itemLabel(flow, "confirm-mode")}</dt>
            <dd className="text-right text-gray-900 dark:text-gray-100">
              {MODE_LABELS[draft.mode as keyof typeof MODE_LABELS] ?? itemLabel(review, "none")}
              {" · "}
              {SETTING_LABELS[draft.alignmentSetting as keyof typeof SETTING_LABELS] ??
                itemLabel(review, "none")}
            </dd>
          </div>
        </dl>
        <p className={SMALL}>{itemLabel(flow, "confirm-body")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            data-pay-action="method"
            className={GHOST}
            onClick={() => setStep("method")}
          >
            {itemLabel(flow, "change-plan")}
          </button>
          <button
            type="button"
            data-pay-action="done"
            className={PRIMARY}
            onClick={() => setStep("done")}
          >
            {itemLabel(flow, "confirm-cta")}
          </button>
        </div>
      </>
    ),
    done: (
      <>
        <p className={SMALL}>{itemLabel(flow, "done-body")}</p>
        <p className={SMALL}>{planLabel()}</p>
      </>
    ),
  };

  const headings: Record<PayFlowStep, string> = {
    plan: plans.heading ?? itemLabel(flow, "confirm-plan"),
    account: itemLabel(flow, "account-heading"),
    method: itemLabel(flow, "method-heading"),
    confirm: itemLabel(flow, "confirm-heading"),
    done: itemLabel(flow, "done-heading"),
  };

  return (
    <section
      aria-labelledby="create-pay-heading"
      data-create-plans="true"
      data-pay-step={step}
      className={`${CARD} pay-flow-panel`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="create-pay-heading" className={HEADING}>
          {headings[step]}
        </h2>
        {step === "done" ? null : (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
            {itemLabel(plans, "trial-short")}
          </span>
        )}
      </div>
      {panels[step]}
    </section>
  );
}
