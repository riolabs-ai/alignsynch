/**
 * template-ancestor: components/assessment-flow/wizard-steps.tsx   (variation: the rail carries the relationship lifecycle's six stages instead of a three-step wizard, and its words come from one shared section rather than the mounting screen's own fixture)
 *
 * The onboarding flow's step rail (#687) — the six stages above every stage screen.
 *
 * **The shipped stepper, not a second one.** `wizard-steps.tsx` already draws the `<ol>`, the
 * three dot states, `aria-current="step"` and the "stage N of M" line; this is that component
 * with the six approved names, so the number, the current step and the accessible current-step
 * marker stay one implementation for the wizard and the lifecycle alike.
 *
 * **One home for the words.** The names live in `data/pages/lifecycle.ts` and each stage's
 * fixture *references* that section: the same rail sits above all six screens, and six copies of
 * "Who · Mode · Aspects · Create · Sent · Ongoing" would be six places a rename hides — the
 * duplication the copy ratchet exists to stop.
 *
 * That is also what the copy check enforces. E23 resolves every section id a file a surface reaches
 * asks for against *that surface's* fixture, so a stage screen whose fixture does not carry the
 * shared `stages` section is a red build naming the id, instead of a rail that throws at request
 * time. Mounting this rail therefore means importing `lifecycleStageSection` into the screen's
 * fixture — one import, no re-typed names.
 *
 * `current` is the caller's fact: which of the six the person is on. Nothing here decides it; a
 * rail that guessed would be right on one screen and wrong on the next.
 *
 * A server component: a rail is a list of words, so it ships no JavaScript of its own.
 */
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { WizardSteps } from "./wizard-steps";

/**
 * The six stages in order, as item ids into the fixture's `stages` section
 * (`data/pages/lifecycle.ts`). The number is what `WizardSteps` draws in the dot and what
 * `current` is compared against, so this list is the one place the order is stated.
 */
const STAGE_RAIL: readonly { readonly step: number; readonly item: string }[] = [
  { step: 1, item: "1" },
  { step: 2, item: "2" },
  { step: 3, item: "3" },
  { step: 4, item: "4" },
  { step: 5, item: "5" },
  { step: 6, item: "6" },
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
