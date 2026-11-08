/**
 * The onboarding flow's six stage names — **one home**, referenced by every stage fixture (#687).
 *
 * The six stages are one journey, so the rail above them must say the same six words on every
 * screen: Details · Settings · Aspects · Invite · Connect · Align. A `stages` section copied
 * into six route fixtures would be six places a rename hides, and E23 would count each copy as
 * that surface's own copy — two homes for one sentence is exactly the defect the copy ratchet
 * exists to stop. So the section is authored once here and *referenced* by each stage's fixture:
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
 * fixes the six names in order and is written from the approved artifact
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`). `tests/flow-stages.test.ts`
 * reddens on a rename, on a seventh word and on the retired rail word the spec removed, which is
 * not a stage at all: living work belongs to the relationship, not to a wizard.
 *
 * **The sixth cell is conditional, and that is structure too.** `Align` exists only once an
 * assessment is shared on the relationship (see `StageRail`'s `alignHref`); `unavailable` is the
 * sentence drawn, for a reader using a screen reader, on the cell that is drawn but not yet live.
 * The number is structure, not copy — `WizardSteps` draws it — so only the names and these
 * sentences live here. `{step}` is filled by the view (`fillLabel`), never spelled.
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
    { id: "4", label: "Invite" },
    { id: "5", label: "Connect" },
    { id: "6", label: "Align" },
    { id: "count", label: "Stage {step} of 6" },
    /** The rail's accessible name — the nav is one landmark among several on the screen. */
    { id: "label", label: "Relationship lifecycle" },
    /**
     * The sixth cell is drawn before it is live (`docs/specs/flow-stages.md` → *Align is the
     * conditional stage*). A muted cell says that to the eye and nothing to a screen reader, so
     * this sentence is the cell's own accessible qualifier — rendered visually hidden, only on
     * the unavailable state, and never beside a live Align.
     */
    { id: "unavailable", label: "Not available yet" },
    /**
     * The one control the shell itself draws (#709) — the modal's close. It lives here rather
     * than in each stage's fixture because the shell is shared by all six stage surfaces, so one
     * word with one home is the same rule the six names above follow. The accessible name is the
     * whole label: the control is a 44px icon with no visible text.
     */
    { id: "close", label: "Close" },
  ],
};
