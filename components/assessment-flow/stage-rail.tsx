/**
 * template-ancestor: components/assessment-flow/wizard-steps.tsx   (variation: the rail carries the relationship lifecycle's six stages instead of a three-step wizard, and its words come from one shared section rather than the mounting screen's own fixture)
 *
 * The onboarding flow's stage rail (#687) — the six stages above every stage screen (#735).
 *
 * **The shipped stepper, not a second one.** `wizard-steps.tsx` draws the band, the three cell
 * states, `aria-current="step"` and the "stage N of M" line; this is that component with the six
 * approved names, so the current step and the accessible current-step marker stay one
 * implementation for the wizard and the lifecycle alike.
 *
 * **One home for the words.** The names live in `data/pages/lifecycle.ts` and each stage's
 * fixture *references* that section: the same rail sits above the flow's screens, and six copies
 * of `Details · Settings · Aspects · Invite · Connect · Align` would be six places a rename
 * hides — the duplication the copy ratchet exists to stop.
 *
 * That is also what the copy check enforces. E23 resolves every section id a file a surface reaches
 * asks for against *that surface's* fixture, so a stage screen whose fixture does not carry the
 * shared `stages` section is a red build naming the id, instead of a rail that throws at request
 * time. Mounting this rail therefore means importing `lifecycleStageSection` into the screen's
 * fixture — one import, no re-typed names.
 *
 * **The sixth cell is conditional, and the caller owns the fact** (`docs/specs/flow-stages.md` →
 * *Align is the conditional stage*). `alignHref` is where `Align` opens when the relationship has
 * **one or more shared assessments** — in progress or completed — and `null` before that, which
 * draws the cell unavailable rather than live. It is never a step the wizard advances into: no
 * stage posts to it, and `current` is never 6 in the create flow. The condition itself is
 * `alignAvailableOf()` in `lib/flow/stage.ts`, so the rail and the screen cannot disagree about
 * what "shared" means. A rail that drew a live Align unconditionally would be the defect
 * `tests/flow-stages.test.ts` reddens on.
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
 * (`data/pages/lifecycle.ts`). `current` is compared against `step`, so this list is the one
 * place the order is stated.
 */
const STAGE_RAIL: readonly { readonly step: number; readonly item: string }[] = [
  { step: 1, item: "1" },
  { step: 2, item: "2" },
  { step: 3, item: "3" },
  { step: 4, item: "4" },
  { step: 5, item: "5" },
  { step: 6, item: "6" },
];

/** The sixth cell — the one the flow never advances into. */
const ALIGN_STEP = 6;

export function StageRail({
  copy,
  current,
  alignHref = null,
}: {
  copy: PageCopy;
  current: number;
  /**
   * Where `Align` opens, or `null` when nothing is shared on the relationship yet. The caller
   * computes it (`alignAvailableOf()`), because only the caller holds the relationship's status:
   * the create flow's stages 1–4 have no relationship to share, and stage 5 carries its own read.
   */
  alignHref?: string | null;
}) {
  const stages = sectionOf(copy, "stages");
  return (
    <WizardSteps
      label={itemLabel(stages, "label")}
      count={fillLabel(itemLabel(stages, "count"), { step: current })}
      current={current}
      steps={STAGE_RAIL.map((entry) => {
        const label = itemLabel(stages, entry.item);
        if (entry.step !== ALIGN_STEP) return { step: entry.step, label };
        return alignHref === null
          ? {
              step: entry.step,
              label,
              unavailable: true,
              note: itemLabel(stages, "unavailable"),
            }
          : { step: entry.step, label, href: alignHref };
      })}
    />
  );
}
