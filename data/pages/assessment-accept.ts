/**
 * `/assessment/instances/[instanceId]/accept` — the acceptance step, **live** since R2 (#427).
 *
 * The order of the page is the order of the decision, and the copy is written for that order:
 * `steps` identifies what is being accepted (Type, Mode, Setting), `acceptance` is the decision
 * itself with the two seats side by side, and `aspects` is the detail that sits *beneath* it.
 *
 * Three facts are in the words, not in a comment:
 *
 * - **Acceptance is recorded, per seat.** `party.accepted_at` exists (`0016_party_acceptance.sql`),
 *   so a seat panel reads "Accepted · <date>" from the row or "Not accepted yet" — never a badge
 *   for something nobody measured. The accepting seat's sheet freezes at that instant
 *   (`submitAnswers` refuses it `frozen`), which is why the prompt says answers may still change
 *   *until* the acceptance and not after it.
 * - **Nothing is visible until both accept.** The blind rule is stated on the page, and the Aspect
 *   detail below the decision draws the viewer's own column and seals the other seat's — the
 *   projection it is handed carries no other-party score to draw.
 * - **Acceptance is the hinge.** The second acceptance is what opens the report and its Gaps, so
 *   the completed state says exactly that and offers the report rather than a congratulation.
 *
 * `{answered}`, `{total}`, `{left}`, `{right}`, `{count}`, `{date}`, `{other}`, `{kinds}` and
 * `{setting}` are filled by `fillLabel()` from rows the page read; the fixture authors no person,
 * no score and no date.
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
        { id: "seat-accepted", label: "Accepted · {date}" },
        { id: "seat-not-accepted", label: "Not accepted yet" },
        {
          id: "sealed-note",
          label: "Neither of you sees the other's answers until both parties accept.",
        },
        { id: "accept", label: "Accept this session" },
        {
          id: "your-turn",
          label:
            "Your sheet is complete. Accepting records your agreement — your answers can still change until you do.",
        },
        {
          id: "you-accepted",
          label:
            "You accepted this session. The report opens for both of you when {other} accepts too.",
        },
        {
          id: "answer-first",
          label: "Acceptance comes after your own sheet: answer every Aspect, then accept it.",
        },
        { id: "answer-sheet", label: "Open your answer sheet" },
        {
          id: "coach-note",
          label:
            "You are reading this as a coach. Acceptance is the two parties' decision, and there is nothing for you to sign.",
        },
        {
          id: "both-accepted",
          label:
            "Both parties accepted this session. The report is open, and its Gaps are readable by both of you.",
        },
        { id: "open-report", label: "Open the report" },
        { id: "back", label: "Back to the relationship" },
      ],
    },
    {
      id: "problems",
      heading: "That acceptance was not recorded",
      items: [
        { id: "already-accepted", label: "You have already accepted this session." },
        {
          id: "incomplete",
          label: "Your sheet is not finished, so there is nothing to accept yet.",
        },
        { id: "not-a-party", label: "This browser is not one of the two parties." },
        { id: "no-such-instance", label: "There is no session at this address." },
        { id: "problems-back", label: "Back to the acceptance page" },
      ],
    },
    {
      id: "aspects",
      heading: "Aspect detail",
      body: "Every Aspect, with your own answers beside it and the other seat sealed until both parties accept.",
      items: [
        { id: "scale", label: "{left} — {right}" },
        { id: "own", label: "Your answers" },
        { id: "own-empty", label: "Not answered yet" },
        { id: "sealed", label: "Sealed" },
      ],
    },
  ],
});
