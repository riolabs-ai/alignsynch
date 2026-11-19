/**
 * template-ancestor: components/assessment-flow/stage-rail.tsx   (variation: three dots instead of five stage cells — the Counterparty's own progress, with no stage numbers, no `Stage n of 5` and no `Align` preview, because this path is the join and not the Initiator's wizard)
 *
 * The join's progress: **three dots, `Invite` · `Join` · `Accept`, and "Step {n} of 3"** (#1125).
 *
 * **Why this is not `StageRail`.** The five-stage rail is the Initiator's map of the relationship
 * (`Details · Settings · Aspects · Account · Invite`) and its count is `Stage {n} of 5`. The
 * Counterparty is not walking that map — the other person filled it in — so reusing the rail would
 * have the invitee read "Stage 4 of 5" on a screen with three steps, and the bundle draws a
 * three-dot stepper for exactly that reason (`counterparty-join.html`, `data-qh="stage-rail
 * (adapted: 3 join steps)"`). The two share a shape and a place above the card; they do not share
 * words, and `docs/specs/flow-stages.md` keeps the join out of the flow's five.
 *
 * **Every dot is a position, never a link.** The steps are addressed by `?step=1|2|3` and moved by
 * the card's one primary action and its Back control, because a dot that jumped to `Accept` would
 * offer an acceptance that has not been asked for — the store refuses a claim with no name and no
 * address, and a control the next page refuses is the defect this repo keeps finding.
 *
 * A server component with no state: `step` is the same `?step=` the page read, and the fixture's
 * three words are the only strings here (E23 — the surface's copy budget is 0).
 */
import type { PageCopy } from "@/content/pages";
import { INVITE_WIZARD_STEPS, type InviteWizardStep } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** One dot's own look, by the state the step is in — the bundle's three data-states. */
const DOT: Record<"current" | "done" | "todo", string> = {
  current: "border-action bg-action text-action-foreground",
  done: "border-action bg-background text-primary",
  todo: "border-line bg-background text-muted-foreground",
};

export function JoinStepper({ copy, step }: { copy: PageCopy; step: InviteWizardStep }) {
  const rail = sectionOf(copy, "steps");
  return (
    <nav
      aria-label={itemLabel(rail, "aria")}
      data-join-stepper={step}
      className="flex flex-col items-center gap-2"
    >
      <ol className="flex items-center">
        {INVITE_WIZARD_STEPS.map((position, index) => {
          const state = position === step ? "current" : position < step ? "done" : "todo";
          return (
            <li key={position} className="flex items-center">
              <span data-step-dot={position} data-state={state} className="flex items-center gap-2">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${DOT[state]}`}
                >
                  {position}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {itemLabel(rail, String(position))}
                </span>
              </span>
              {index === INVITE_WIZARD_STEPS.length - 1 ? null : (
                <span className="mx-2 h-px w-8 bg-line sm:w-12" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{fillLabel(sectionBody(rail), { step })}</p>
    </nav>
  );
}
