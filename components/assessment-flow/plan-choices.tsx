"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the Mode single-choice — a fieldset of label-wrapped radio rows — carrying a price and a note instead of an explanation, and writing nothing: the plan is a soft prompt at this stage, never a checkout)

/**
 * `PlanChoices` — the two plans on stage 4, as one single-choice group (#690).
 *
 * **The rows are native radios, and that is the point.** Stage 2's Mode and Setting are a
 * `<fieldset>` of `<label>`-wrapped `<input type="radio">`, and the plans are the same single
 * choice carrying a price instead of an explanation — so they are drawn the same way. The browser
 * then owns the whole contract the acceptance asks for: one choice, arrow keys that move within
 * the group, Space to choose, `role="radio"` and `aria-checked` in the accessibility tree, and a
 * `:checked` state the label's styling can read. A `<button role="radio">` would have had to
 * script all of that and would still have been a button pretending to be a radio.
 *
 * Nothing is selected by default: a pre-selected plan would be this screen choosing a tier for
 * somebody who has not read the two rows yet — the same reason stage 2's Mode is not pre-selected.
 * The reviewed card's price is beside the name, right-aligned, so the two numbers are comparable
 * without reading the notes.
 *
 * **It chooses nothing on the server, deliberately.** This is the *soft* half of the payment
 * decision: the choice is remembered by the input and posted nowhere, the create runs with or
 * without it, and nothing is charged. The hard gate is at publish, and the door that captures a
 * method is the pricing page's — a checkout started here would be a second copy of
 * `components/pricing/plan-checkout-button.tsx`, which is the one place a tier is bought.
 *
 * **Every word is the fixture's.** Labels, notes, prices and the `/mo` suffix all come from
 * `data/pages/assessment-create.ts` through `sectionOf`/`itemLabel` (E23 counts what a component
 * writes, and this one writes no sentence at all). The two ids are structure, not copy.
 */
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** The two plans, in the order the prototype prints them. Their words are the fixture's. */
export const PLAN_IDS = ["one", "unlimited"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** A plan's fixture ids: its own name and note, and the price it prints. */
function idsFor(plan: PlanId) {
  return { name: plan, note: `${plan}-note`, price: `${plan}-price` } as const;
}

export function PlanChoices({ copy, initial }: { copy: PageCopy; initial?: PlanId }) {
  const plans = sectionOf(copy, "plans");

  return (
    <fieldset className="grid gap-2" data-create-plans="true">
      <legend className="sr-only">{itemLabel(plans, "legend")}</legend>
      {PLAN_IDS.map((plan) => {
        const ids = idsFor(plan);
        return (
          /* One row per plan; the whole card is the label, so the target is the card. */
          <label
            key={plan}
            data-plan={plan}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-3 py-2.5 text-sm has-[:checked]:border-action has-[:checked]:bg-action/5 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:has-[:checked]:bg-action/10"
          >
            <input
              type="radio"
              name="plan"
              value={plan}
              defaultChecked={initial === plan}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-gray-800 dark:text-gray-100">
                {itemLabel(plans, ids.name)}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(plans, ids.note)}
              </span>
            </span>
            <span className="shrink-0 text-right font-semibold text-gray-900 dark:text-gray-100">
              <span data-plan-price={plan}>{itemLabel(plans, ids.price)}</span>
              <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                {itemLabel(plans, "per")}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
