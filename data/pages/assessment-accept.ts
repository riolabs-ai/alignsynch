/**
 * `/assessment/instances/[instanceId]/accept` — the acceptance step, shipped as **in-progress
 * UI** (#409, R1-E).
 *
 * The order of the page is the order of the decision, and the copy is written for that order:
 * `steps` identifies what is being accepted (Type, Mode, Setting), `acceptance` is the decision
 * itself with the two seats side by side, and `aspects` is the detail that sits *beneath* it.
 *
 * Two honest facts are in the words, not in a comment:
 *
 * - **Acceptance is not recorded in this build.** The database has no column that stores it, so
 *   the seat panel says "not recorded" rather than drawing an "accepted" badge nobody measured,
 *   and the button's note says it cannot record the decision.
 * - **Nothing is visible until both accept.** The blind rule is stated on the page, and the
 *   Aspect detail below the decision draws both columns sealed for the same reason.
 *
 * `{answered}`, `{total}`, `{left}`, `{right}`, `{name}`, `{seat}` and `{setting}` are filled by
 * `fillLabel()` from rows the page read; the fixture authors no person, no score and no date.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentAcceptPageCopy: PageCopy = zPageCopy.parse({
  heading: "Review and accept this session",
  subtitle:
    "Acceptance is the closing beat: two acceptances, recorded separately. Nothing either of you wrote is visible until both exist.",
  sections: [
    {
      id: "steps",
      heading: "What you are accepting",
      items: [
        { id: "type", label: "Type" },
        { id: "type-detail", label: "{count} Aspects" },
        { id: "mode", label: "Mode" },
        { id: "mode-detail", label: "{kinds} on every Aspect" },
        { id: "setting", label: "Setting" },
        { id: "setting-detail", label: "{setting} Setting" },
      ],
    },
    {
      id: "acceptance",
      heading: "Acceptance",
      body: "Two acceptances, recorded separately. Answering is not accepting: a party can answer their whole sheet and still leave the session sealed.",
      items: [
        { id: "badge-both", label: "Both must accept" },
        { id: "seat-initiator", label: "Initiator" },
        { id: "seat-counterparty", label: "Counterparty" },
        { id: "answers", label: "{answered} of {total} Aspects answered" },
        {
          id: "acceptance-unrecorded",
          label:
            "Acceptance · not recorded. This build stores no acceptance, so no seat can show one.",
        },
        {
          id: "sealed-note",
          label: "Neither of you sees the other's answers until both parties accept.",
        },
        { id: "accept", label: "Accept this session" },
        {
          id: "not-wired",
          label:
            "Not wired yet — acceptance cannot be recorded, so this button is disabled. Nothing was saved.",
        },
        { id: "back", label: "Back to the relationship" },
      ],
    },
    {
      id: "aspects",
      heading: "Aspect detail",
      body: "Every Aspect, with both columns sealed. An Opinion column opens only when both parties have accepted.",
      items: [
        { id: "scale", label: "{left} — {right}" },
        { id: "sealed", label: "Sealed" },
      ],
    },
  ],
});
