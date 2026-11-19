/**
 * `/assessment/instances/[instanceId]/answer` — the v2 answer screen (#1128).
 *
 * The screen used to be one long sheet: every Aspect on one page, one submit at the bottom. The
 * approved v2 surface (`docs/specs/v2-bundles/10-spec-design-page-assessment-v2/assessment.html`)
 * asks **one Aspect at a time** on the locked 1–5 scale, saves every pick, resumes where the reader
 * left off and ends with a review. This fixture is its whole vocabulary.
 *
 * The bands, in the order the bundle draws them:
 *
 *   `header`    the flow title and the one way out (`Save and Exit`).
 *   `privacy`   the note that never moves: answers stay private until both parties finish.
 *   `resume`    the returning reader's banner — "Welcome back", where they are, and `Start Over`.
 *   `progress`  `Round 1 · Aspect n of 5`, the segmented bar's words and the save state.
 *   `aspect`    one Aspect's card: eyebrow, the two row headings and their glosses, the pole line
 *               under each scale, the pick hint and the card's footer buttons.
 *   `review`    `Check Your Answers`, one summary line per Aspect, `Change`, `Submit Answers`.
 *   `sheet`     the seat sentence and the blind rule (#427's words, kept: the v2 screen says the
 *               same thing in more places, not a different thing).
 *   `frozen`    the sealed sheet — plus the v2 status line: who this reader is waiting on, or that
 *               the results are ready.
 *   `lapsed`    the membership that paid for the relationship ended: the paused pane, with a copy
 *               per seat (the Counterparty's carries no billing word). The sheet underneath stays
 *               writable (#848), so this names a pause rather than a read-only screen.
 *   `coach`     a coach reads the relationship and has no answers to give.
 *
 * `{name}`/`{seat}`/`{other}`/`{aspect}`/`{total}`/`{value}`/`{notch}` are filled by `fillLabel()`
 * from the rows the page read — the fixture authors no person, no Aspect and no count. Opinions are
 * named by the glossary's own `OPINION_LABELS` inside the component, because Feel, Wish, Think and
 * Guess are the model's vocabulary and not this page's prose; everything a reader can be surprised
 * by is here.
 *
 * `stages` is referenced, not re-typed (#716): the shared five stage names live in
 * `data/pages/lifecycle.ts` and are imported, so this fixture cannot carry a sixth copy that
 * drifts. The v2 screen itself draws no rail — its progress is the bundle's own `Round 1 · Aspect n
 * of 5` bar, which is why the names are referenced for the flow rather than printed here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { lifecycleStageSection } from "./lifecycle";

export const assessmentAnswerPageCopy: PageCopy = zPageCopy.parse({
  heading: "Round 1 Assessment",
  subtitle:
    "One Aspect at a time, on the same 1–5 scale both of you answer. Nothing is sent until you review it, and nothing is shown to anyone else until you both finish.",
  items: [
    { id: "back", label: "Back to the relationship" },
    { id: "exit", label: "Save and Exit" },
  ],
  sections: [
    lifecycleStageSection,
    {
      id: "header",
      items: [{ id: "round", label: "Round 1" }],
    },
    {
      id: "privacy",
      heading: "Private until you both finish.",
      body: "{other} sees nothing of yours until then, and you see nothing of theirs.",
      items: [{ id: "privacy-mark", label: "Private" }],
    },
    {
      id: "resume",
      heading: "Welcome back.",
      body: "Your answers are saved. You’re on Aspect {aspect}.",
      items: [
        { id: "start-over", label: "Start Over" },
        {
          id: "start-over-note",
          label:
            "Start Over erases the answers on this sheet and puts you back on Aspect 1. Nothing you answered is kept.",
        },
      ],
    },
    {
      id: "progress",
      items: [
        { id: "position", label: "Round 1 · Aspect {aspect} of {total}" },
        /** The sealed sheet's own position: the sheet is the record, so every Aspect is answered. */
        { id: "position-sealed", label: "Round 1 · {aspect} of {total} Aspects answered" },
        /**
         * The chip's four words are the reference's (`js/proto.js` in bundle rc1.3
         * `01-answer-screen-paused-1223`), Title Case because copy rule 1 says so and the bundle
         * draws them that way. `saving` is the resting chip; `saving-now` is the request in flight.
         */
        { id: "saving", label: "Saves as You Go" },
        { id: "saving-now", label: "Saving…" },
        { id: "saved", label: "Saved" },
        { id: "save-failed", label: "Not Saved · Pick Again" },
        /**
         * The sealed sheet takes no answer, so its chip cannot promise a save. The word is the one
         * the frozen band and the doc's Finish line already use (`sealed for Round 1`).
         */
        { id: "sealed-state", label: "Sealed" },
        { id: "segmented", label: "Aspect {aspect} of {total}" },
      ],
    },
    {
      id: "aspect",
      items: [
        { id: "eyebrow", label: "Aspect {aspect} of {total}" },
        { id: "feel", label: "Feel" },
        { id: "feel-gloss", label: "How it is now" },
        { id: "wish", label: "Wish" },
        { id: "wish-gloss", label: "How you want it" },
        { id: "pole-left", label: "{notch} · {value}" },
        { id: "pole-right", label: "{notch} · {value}" },
        { id: "scale-name", label: "{value} — {notch}" },
        {
          id: "hint",
          label: "Pick a number for Feel and for Wish to continue.",
        },
        {
          id: "hint-advanced",
          label: "Pick a number for Feel, Wish, Think and Guess to continue.",
        },
        { id: "back", label: "Back" },
        { id: "save-exit", label: "Save and Exit" },
        { id: "next", label: "Next Aspect" },
        { id: "to-review", label: "Review Answers" },
      ],
    },
    {
      id: "review",
      heading: "Check Your Answers",
      body: "Once you submit, your answers are sealed for Round 1.",
      items: [
        { id: "eyebrow", label: "Review" },
        { id: "summary-basic", label: "Feel {feel} · Wish {wish}" },
        {
          id: "summary-advanced",
          label: "Feel {feel} · Wish {wish} · Think {think} · Guess {guess}",
        },
        { id: "missing", label: "–" },
        { id: "change", label: "Change" },
        { id: "change-name", label: "Change {aspect}" },
        { id: "back", label: "Back" },
        { id: "save-exit", label: "Save and Exit" },
        { id: "submit", label: "Submit Answers" },
        {
          id: "submit-note",
          label:
            "Submitting sends every Aspect of your sheet and seals it. You can still change a score until you accept the session.",
        },
      ],
    },
    {
      id: "refusals",
      items: [
        {
          id: "not-a-party",
          label:
            "This browser is not a party to this relationship, so nothing here is yours to answer. Open it from the link you were sent.",
        },
        {
          id: "no-such-instance",
          label: "There is no session at this address. It may have been closed.",
        },
        {
          id: "frozen",
          label:
            "You have accepted this session, so your answers are sealed and cannot be changed.",
        },
        {
          id: "incomplete",
          label:
            "That answer did not reach the sheet. Pick a number for every row on this Aspect and it will be saved.",
        },
        {
          id: "voided",
          label: "This session was voided, so it takes no further answers.",
        },
        {
          id: "lapsed",
          label:
            "This relationship is paused. Your answers are saved. You can return when it resumes.",
        },
        /** The Counterparty's version: the prototype's own sentence, no billing word in it. */
        {
          id: "lapsed-counterparty",
          label: "This relationship is paused. Your answers are saved.",
        },
        {
          id: "payment-method-required",
          label: "This relationship needs a payment method before it can go further.",
        },
        /** …and the same sentence for the Counterparty, who never reads a payment word. */
        {
          id: "payment-method-required-counterparty",
          label: "This relationship is paused. Your answers are saved.",
        },
        {
          id: "unknown",
          label: "That answer was not saved. Pick it again.",
        },
      ],
    },
    {
      id: "sheet",
      heading: "Your sheet",
      items: [
        { id: "answering-as", label: "You are answering as {name} · {seat}" },
        { id: "seat-initiator", label: "Initiator" },
        { id: "seat-counterparty", label: "Counterparty" },
        {
          id: "blind-rule",
          label:
            "Until both parties accept, neither of you sees the other's answers — they are not hidden here, they are absent.",
        },
      ],
    },
    {
      id: "frozen",
      heading: "This sheet is the record",
      body: "You have accepted this session, so your answers are sealed. What you marked is below, exactly as it was stored.",
      items: [
        { id: "waiting", label: "Waiting for {other}" },
        { id: "ready", label: "Results are ready" },
        {
          id: "waiting-body",
          label:
            "{other} answers the same Aspects from their side and accepts the session. The results open for you both when they do.",
        },
        {
          id: "ready-body",
          label:
            "Both of you have finished, so the results are open. Nothing on this sheet changed.",
        },
        {
          id: "frozen-note",
          label:
            "There is nothing to submit on this page: a control that could only be refused is not a control.",
        },
      ],
    },
    {
      /**
       * #533 phase 3 / #1223 — the membership ended, and the screen says so before either seat
       * reads anything else. **Two copies**, because the Counterparty never reads a billing word:
       * the Initiator is told the pause can lift, the Counterparty is told they will hear about it.
       * The words are the prototype's (`assessment.html?state=lapsed&role=…`), not retyped here.
       */
      id: "lapsed",
      heading: "Answering Is Paused",
      body: "This relationship is still paused. Your answers are saved.",
      items: [
        { id: "heading-counterparty", label: "Answering Is Paused For Now" },
        { id: "body-counterparty", label: "You’ll hear when it resumes. Your answers are saved." },
        {
          id: "lapsed-note",
          label:
            "This is the initiator's membership, not yours: the trial or the subscription behind the relationship ended.",
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
