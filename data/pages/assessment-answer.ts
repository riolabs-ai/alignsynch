/**
 * `/assessment/instances/[instanceId]/answer` — the answer sheet (#427, R2-2).
 *
 * The sheet is a **write surface** now. R1-E shipped this route as in-progress UI whose copy said
 * plainly that nothing was saved; that sentence is gone, because it would now be false. What
 * replaces it is what a person about to submit needs: whose sheet this is, that a submit is a
 * whole sheet, and that the other party's answers are not on this page to be found.
 *
 * The bands:
 *
 *   `sheet`    the live form — who the viewer answers as, the blind-rule sentence, the Aspect
 *              band, and the note beside the submit that says a submit is a whole sheet.
 *   `rules`    the two facts that do not change from visit to visit: the Mode is fixed at
 *              creation, and no party picks the Setting here.
 *   `frozen`   the read-only state: the viewer has accepted this session (or both have), so this
 *              page shows the viewer their own sheet and offers no control that could only be
 *              refused.
 *   `coach`    a coach membership reads the relationship and has no answers to give, so the page
 *              draws the badge and the reason instead of a sheet.
 *
 * `{name}`/`{seat}`/`{left}`/`{right}` are filled by `fillLabel()` from the rows the page read —
 * the fixture authors no person and no Aspect. `back` is a page-level item because every band
 * ends with the same link.
 *
 * **`stages` is referenced, not re-typed (#716).** The sheet mounts the shared cell rail
 * (`components/assessment-flow/stage-rail.tsx`), which asks this surface's copy for the `stages`
 * section by id — so the six approved names arrive from `data/pages/lifecycle.ts` through one
 * import rather than a seventh copy that could drift. Answering is the `Ongoing` stage of that
 * same journey; the rail's position is the view's fact, never a name authored here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { lifecycleStageSection } from "./lifecycle";

export const assessmentAnswerPageCopy: PageCopy = zPageCopy.parse({
  heading: "Answer your side",
  subtitle:
    "Every Aspect of this relationship, asked in the shape its Mode defines. Your answers stay sealed until both parties accept.",
  items: [{ id: "back", label: "Back to the relationship" }],
  sections: [
    lifecycleStageSection,
    {
      id: "sheet",
      heading: "Your sheet",
      body: "Each Aspect is one line of the relationship. You score it from the left Value to the right Value, once for every Opinion kind your Mode asks, and you submit the sheet as a whole.",
      items: [
        { id: "answering-as", label: "You are answering as {name} · {seat}" },
        { id: "seat-initiator", label: "Initiator" },
        { id: "seat-counterparty", label: "Counterparty" },
        {
          id: "blind-rule",
          label:
            "Until both parties accept, neither of you sees the other's answers — they are not hidden here, they are absent.",
        },
        { id: "scale", label: "{left} — {right}" },
        { id: "submit", label: "Submit answers" },
        { id: "resubmit", label: "Replace my answers" },
        {
          id: "submit-note",
          label:
            "A submit posts your whole sheet: every Aspect, every kind the Mode asks. Submitting again replaces your previous answers rather than adding to them.",
        },
      ],
    },
    {
      id: "rules",
      heading: "What this sheet keeps",
      items: [
        {
          id: "mode-fixed",
          label:
            "The Mode is fixed at creation. Basic asks Feel and Wish on every Aspect; Advanced adds Think and Guess.",
        },
        {
          id: "setting",
          label:
            "The Setting is the bar these answers are judged against later. It changes the verdict, never a question, and no party picks it here.",
        },
      ],
    },
    {
      id: "frozen",
      heading: "This sheet is the record",
      body: "You have accepted this session, so your answers are sealed. What you marked is below, exactly as it was stored.",
      items: [
        {
          id: "frozen-note",
          label:
            "There is nothing to submit on this page: a control that could only be refused is not a control.",
        },
      ],
    },
    {
      /**
       * #533 phase 3 — the membership ended, so both sheets are read-only. Separate from `frozen`
       * because the cause is different and the remedy is different: nobody accepted this, the
       * initiator's trial or subscription ended, and the party reading it did not fail at anything.
       */
      id: "lapsed",
      heading: "This relationship is read-only",
      body: "The membership that paid for it has ended, so neither of you can change an answer. What you marked is below, exactly as it was stored, and it stays readable.",
      items: [
        {
          id: "lapsed-note",
          label:
            "This is the initiator's membership, not yours: the trial or the subscription behind the relationship ended. It becomes writable again if a payment lands.",
        },
      ],
    },
    {
      id: "coach",
      heading: "You are reading as a coach",
      body: "A coach reads the relationship and its report. Answering is the two parties' own act, so there is no sheet for a coach to fill in.",
      items: [
        { id: "coach-badge", label: "Coach" },
        {
          id: "coach-note",
          label:
            "Nothing here is yours to answer or to change, and neither party's sealed answers are on this page.",
        },
      ],
    },
  ],
});
