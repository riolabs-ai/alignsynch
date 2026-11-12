/**
 * template-ancestor: components/assessment-flow/wizard-steps.tsx   (variation: the rail carries the relationship lifecycle's five stages instead of a three-step wizard, and its words come from one shared section rather than the mounting screen's own fixture)
 *
 * The onboarding flow's stage rail (#687) — the five stages above every stage screen (#825).
 *
 * **The shipped stepper, not a second one.** `wizard-steps.tsx` draws the band, the cell states,
 * `aria-current="step"` and the "stage N of M" line; this is that component with the five approved
 * names, so the current step and the accessible current-step marker stay one implementation for the
 * wizard and the lifecycle alike.
 *
 * **One home for the words.** The names live in `data/pages/lifecycle.ts` and each stage's fixture
 * *references* that section: the same rail sits above the flow's screens, and five copies of
 * `Details · Settings · Aspects · Account · Invite` would be five places a rename hides — the
 * duplication the copy ratchet exists to stop.
 *
 * That is also what the copy check enforces. E23 resolves every section id a file a surface reaches
 * asks for against *that surface's* fixture, so a stage screen whose fixture does not carry the
 * shared `stages` section is a red build naming the id, instead of a rail that throws at request
 * time. Mounting this rail therefore means importing `lifecycleStageSection` into the screen's
 * fixture — one import, no re-typed names.
 *
 * **Five cells, and none of them conditional (#825).** Until v9 the sixth cell was `Align`, drawn
 * unavailable until an assessment was shared and live after it. `docs/specs/flow-stages.md` moved
 * Align to the dashboard — it is where completion lands, not a stage the modal advances into — so
 * the rail is a plain five with no `href`, no `unavailable` state and no note. The old
 * `alignHref` prop is deleted rather than defaulted: a caller that could still pass one would be
 * able to draw a band the count does not agree with.
 *
 * `current` is the caller's fact: which of the five the person is on. Nothing here decides it; a
 * rail that guessed would be right on one screen and wrong on the next.
 *
 * A server component: a rail is a list of words, so it ships no JavaScript of its own.
 */
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { WizardSteps } from "./wizard-steps";

/**
 * The five stages in order, as item ids into the fixture's `stages` section
 * (`data/pages/lifecycle.ts`). `current` is compared against `step`, so this list is the one
 * place the order is stated.
 */
const STAGE_RAIL: readonly { readonly step: number; readonly item: string }[] = [
  { step: 1, item: "1" },
  { step: 2, item: "2" },
  { step: 3, item: "3" },
  { step: 4, item: "4" },
  { step: 5, item: "5" },
];

export function StageRail({ copy, current }: { copy: PageCopy; current: number }) {
  const stages = sectionOf(copy, "stages");
  return (
    <WizardSteps
      label={itemLabel(stages, "label")}
      count={fillLabel(itemLabel(stages, "count"), { step: current })}
      current={current}
      steps={STAGE_RAIL.map((entry) => ({
        step: entry.step,
        label: itemLabel(stages, entry.item),
      }))}
    />
  );
}
