/**
 * The onboarding flow's five stage names — **one home**, referenced by every stage fixture (#687).
 *
 * The five stages are one journey, so the rail above them must say the same five words on every
 * screen: Details · Settings · Aspects · Account · Invite (`docs/specs/flow-stages.md`, #825). A
 * `stages` section copied into five route fixtures would be five places a rename hides, and E23
 * would count each copy as that surface's own copy — two homes for one sentence is exactly the
 * defect the copy ratchet exists to stop. So the section is authored once here and *referenced* by
 * each stage's fixture:
 *
 *     import { lifecycleStageSection } from "./lifecycle";
 *     sections: [lifecycleStageSection, …]
 *
 * That is also what makes the shared shell checkable. `components/assessment-flow/stage-rail.tsx`
 * asks for the `stages` section, and E23 resolves every section id a file a surface reaches asks
 * for against *that surface's* fixture — so a stage screen whose fixture forgets this section is a
 * red build naming the missing id, rather than a blank rail at runtime.
 *
 * **The words are the binding spec's, not a paraphrase of them.** `docs/specs/flow-stages.md`
 * fixes the five names in order and is written from the approved artifact
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v9.html`). `tests/flow-stages.test.ts`
 * reddens on a rename, on a sixth word, and on either retired rail word — `Connect`, whose
 * affordances moved to the post-send confirmation and the dashboard, and `Align`, which is the
 * dashboard's surface and never a cell in this band. Neither is a stage of this flow.
 *
 * **There is no conditional cell any more.** Until #825 `Align` was drawn as a sixth, sometimes
 * unavailable, cell (`alignHref`). The rail is now a plain five, so this section carries no
 * `unavailable` sentence: a cell that cannot be reached has no place in a count that says "of 5".
 * `alignAvailableOf()` in `lib/flow/stage.ts` survives because the dashboard asks the same
 * question — whether an assessment is shared — about a surface that is not in this band.
 *
 * The number is structure, not copy — `WizardSteps` draws it — so only the names and this sentence
 * live here. `{step}` is filled by the view (`fillLabel`), never spelled.
 *
 * Typed as `PageCopySection` and validated where it is used: each fixture runs it through
 * `zPageCopy.parse`, so this module carries no second schema and no React.
 */
import type { PageCopySection } from "../../content/pages";

export const lifecycleStageSection: PageCopySection = {
  id: "stages",
  items: [
    { id: "1", label: "Details" },
    { id: "2", label: "Settings" },
    { id: "3", label: "Aspects" },
    { id: "4", label: "Account" },
    { id: "5", label: "Invite" },
    { id: "count", label: "Stage {step} of 5" },
    /** The rail's accessible name — the nav is one landmark among several on the screen. */
    { id: "label", label: "Relationship lifecycle" },
    /**
     * The one control the shell itself draws (#709) — the modal's close. It lives here rather
     * than in each stage's fixture because the shell is shared by all five stage surfaces, so one
     * word with one home is the same rule the five names above follow. The accessible name is the
     * whole label: the control is a 44px icon with no visible text.
     */
    { id: "close", label: "Close" },
  ],
};
