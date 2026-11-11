"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the last stage's left column becomes a five-panel walk — plan, account, method, confirmation, done — and the stage's own advance flips with it, so the pay decision happens in this card instead of on a pricing page)

/**
 * `StageFour` — Invite, with the payment decision walked **in place** (#771).
 *
 * **Why this is a client component of its own.** The walk and the stage's advance control have to
 * agree: the foot reads "Create relationship and send invite" until the walk is finished and
 * "Complete and Connect" after it, and that is one piece of state shared by two DOM positions.
 * Stage 4 used to be drawn by `create-relationship.tsx`, which is a server component; a client
 * boundary here is what lets the state live without turning the other three stages client-side.
 *
 * **Nothing here charges, and nothing here blocks.** The owner's rule is a soft prompt at the
 * invite and a hard gate at publish: choosing a plan commits nothing, the walk's method step defers
 * the capture to publish, and the create goes through either way — saved as a draft that asks for a
 * method when its opinions are published (`components/dashboard/relationship-detail.tsx`, #690).
 * The five panels are the approved artifact's `s8.*` flow, not a second design.
 *
 * **The account is not asked for here.** Stage 1 used to gate on an account (#618); the approved
 * flow creates the relationship first and offers the account after (`account-gate.tsx`). So the
 * account panel says what happens and moves on — it does not re-ask for a password in a second form
 * that would then have to keep the shipped sign-up in step.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`plans`, `commit`, `review` and
 * `payment-flow`) through `sectionOf`/`itemLabel` — E23 counts what a component writes, and this one
 * writes none.
 */
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PageCopy } from "@/content/pages";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { CREATE_INSTANCE_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { PlanChoices, type PlanId } from "./plan-choices";
import { StageFoot } from "./stage-foot";

/** The walk, in the order the artifact draws it. `plan` is the first panel, `done` the last. */
export const PAY_FLOW_STEPS = ["plan", "account", "method", "confirm", "done"] as const;

export type PayFlowStep = (typeof PAY_FLOW_STEPS)[number];

/** The review's six facts, in the order the artifact prints them. */
const REVIEW_ORDER = ["template", "initiator", "counterparty", "title", "mode", "setting"] as const;

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
const CARD_ACTION = "space-y-3 rounded-lg border border-action bg-white p-4 dark:bg-gray-900";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const SMALL = "text-xs text-gray-600 dark:text-gray-300";
const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-white hover:brightness-95";
const GHOST =
  "inline-flex h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";

export function StageFour({
  copy,
  draft,
  template,
  backHref,
  cancelHref,
  cancelLabel,
  advanceClasses,
  commitFormId,
  initialStep,
}: {
  copy: PageCopy;
  draft: CreateDraft;
  /** The template as the review prints it: its id for the post, its title and its Aspect count. */
  template: { readonly recordId: string; readonly title: string; readonly aspectCount: number };
  backHref: string;
  cancelHref: string;
  cancelLabel: string;
  advanceClasses: string;
  commitFormId: string;
  /** Where the walk starts. Only a test passes this: the page always starts at the plan. */
  initialStep?: PayFlowStep;
}) {
  const plans = sectionOf(copy, "plans");
  const flow = sectionOf(copy, "payment-flow");
  const commit = sectionOf(copy, "commit");
  const review = sectionOf(copy, "review");
  const band = sectionOf(copy, "template");

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
    if (plan === null) return itemLabel(review, "none");
    return `${itemLabel(plans, plan)} · ${itemLabel(plans, `${plan}-price`)}${itemLabel(plans, "per")}`;
  }

  const panels: Record<PayFlowStep, ReactNode> = {
    plan: (
      <>
        <p className={MUTED}>{sectionBodyOf(copy, "plans")}</p>
        <div ref={plansRef}>
          <PlanChoices copy={copy} initial={plan ?? undefined} />
        </div>
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
        <p className={SMALL}>{itemLabel(flow, "account-note")}</p>
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
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* LEFT — the walk (#771). One panel at a time; the advance below reads the same step. */}
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

        <aside className="space-y-5">
          {/* The conversion. A plain form posting to the create endpoint: the draft already carries
              who, mode, setting and the list, so the post names the template and nothing else. */}
          <form
            id={commitFormId}
            action={CREATE_INSTANCE_PATH}
            method="post"
            aria-labelledby="create-commit-heading"
            data-create-commit="true"
            className={CARD_ACTION}
          >
            <h2 id="create-commit-heading" className={HEADING}>
              {itemLabel(commit, "cta-heading")}
            </h2>
            <input type="hidden" name="templateRecordId" value={template.recordId} />
            <p className={SMALL}>{itemLabel(commit, "cta-body")}</p>
            <p className={SMALL}>{itemLabel(commit, "reassure")}</p>
          </form>

          {/* The six facts stages 1–3 decided, printed back for one last read. */}
          <section
            aria-labelledby="create-review-heading"
            data-create-review="true"
            className={CARD}
          >
            <h2 id="create-review-heading" className={HEADING}>
              {review.heading}
            </h2>
            <p className={MUTED}>{sectionBodyOf(copy, "review")}</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              {REVIEW_ORDER.map((fact) => (
                <div key={fact} className="flex justify-between gap-3" data-create-fact="true">
                  <dt className="text-gray-500 dark:text-gray-400">{itemLabel(review, fact)}</dt>
                  <dd className="text-right text-gray-900 dark:text-gray-100">
                    {reviewValue(fact)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      {/* The stage foot (#760): `[Back][Cancel]` left, the advance flush right — and on stage 4 the
          advance's label is the walk's last word (#771). */}
      <StageFoot
        backHref={backHref}
        backLabel={itemLabel(commit, "back")}
        cancelHref={cancelHref}
        cancelLabel={cancelLabel}
        advance={
          <button
            type="submit"
            form={commitFormId}
            className={advanceClasses}
            data-pay-advance={step}
          >
            {step === "done" ? itemLabel(flow, "connect-cta") : itemLabel(commit, "submit")}
          </button>
        }
      />
    </>
  );

  /** One fact's answer: the template's own values, the draft's, or the fixture's dash. */
  function reviewValue(fact: (typeof REVIEW_ORDER)[number]): ReactNode {
    const none = () => <span>{itemLabel(review, "none")}</span>;
    const orNone = (value: string) => (value.trim() === "" ? none() : <span>{value.trim()}</span>);
    switch (fact) {
      case "template":
        return (
          <span>
            {template.title}
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {fillLabel(itemLabel(band, "aspects"), { count: template.aspectCount })}
            </span>
          </span>
        );
      case "initiator":
        return orNone(draft.initiatorName);
      case "counterparty":
        return orNone(draft.counterpartyName);
      case "title":
        return orNone(draft.title);
      case "mode":
        return (
          <span>
            {MODE_LABELS[draft.mode as keyof typeof MODE_LABELS] ?? itemLabel(review, "none")}
          </span>
        );
      case "setting":
        return (
          <span>
            {SETTING_LABELS[draft.alignmentSetting as keyof typeof SETTING_LABELS] ??
              itemLabel(review, "none")}
          </span>
        );
    }
  }
}

/** A section's body sentence, or an empty string when the fixture gives that section none. */
function sectionBodyOf(copy: PageCopy, section: string): string {
  const found = sectionOf(copy, section);
  return found.body ?? "";
}
