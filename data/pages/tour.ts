/**
 * The first-run tour's words (#455) — six steps and the chrome they are drawn in.
 *
 * The tour is the one fixture whose surface is **not a route**: it renders over `/dashboard`,
 * highlighting elements `/dashboard` and the shell already own. So it is a declared non-route copy
 * surface (`NON_ROUTE_COPY_SURFACES` in `content/pages.ts`) with its own budget row, which is what
 * keeps a sentence out of `components/tour/**` — every word a reader sees in the callout lives
 * here, including the three button labels, the progress line and the sentence a screen reader
 * hears on each step change.
 *
 * **`sections` *is* the step list, in order.** `lib/tour/steps.ts` maps each section id to the
 * element carrying `data-tour="<id>"`, and a step whose element is absent from the page is
 * skipped rather than pointed at nothing. The ids are the anchors, so renaming one is a two-file
 * change by design: the fixture says what the step is called and the markup says where it points.
 *
 * **No step describes something that is not wired.** Every sentence below is about a surface this
 * build renders: the counts band, the relationships list, the template picker, the two-party
 * answering rule the read itself enforces (`lib/flow/store.ts`), and the Support row. Nothing
 * carries a metric, a rating or a comparison, per #454's "no fabricated claims" constraint.
 */
import type { OpinionKind } from "../../content/assessment";
import { zPageCopy, type PageCopy } from "../../content/pages";
import type { Score } from "../../content/record";

/**
 * One scripted answer (#457): which Aspect (by position in the example's own list), which
 * Opinion, and the two scores the example gives it.
 *
 * **This is the one place the example's answers are written.** `components/tour/demo-fill.tsx`
 * clicks `you` into the real radio and prints `theirs` beside it, and step 4's sentence below
 * interpolates the same numbers — so a copy that says "5 against 2" over a sheet that types
 * something else is not a proofreading risk, it is a value used twice. `tests/tour-demo.test.tsx`
 * holds the two halves together.
 */
export interface TourDemoAnswer {
  /** The Aspect's index in the example's list (`demoAspectsOf` slices the template's items). */
  readonly aspect: number;
  readonly kind: OpinionKind;
  /** The score the script clicks into the sheet — the viewer's own answer. */
  readonly you: Score;
  /** The other party's answer, revealed beside it once the script has finished. */
  readonly theirs: Score;
}

/**
 * The example's answers, in the order they are typed, on the first two Aspects of
 * "Relationship Basics" (`data/assessments.ts`, Basic Mode's two Opinions).
 *
 * The first Aspect parts sharply (5 against 2, then 2 against 5) so the Gap is visible in a
 * screenshot of the finished example; the second Aspect agrees on Feel and parts by one on Wish,
 * so the reveal shows both a Gap and the no-Gap case rather than four identical rows.
 */
export const tourDemoAnswers: readonly TourDemoAnswer[] = [
  { aspect: 0, kind: "feel", you: 5, theirs: 2 },
  { aspect: 0, kind: "wish", you: 2, theirs: 5 },
  { aspect: 1, kind: "feel", you: 5, theirs: 5 },
  { aspect: 1, kind: "wish", you: 3, theirs: 2 },
];

/** The first scripted answer — the pair step 4's sentence quotes. */
const demoFirstAnswer = tourDemoAnswers[0] as TourDemoAnswer;

export const tourPageCopy: PageCopy = zPageCopy.parse({
  heading: "A short tour of your console",
  items: [
    /**
     * driver.js interpolates `{{current}}` and `{{total}}` in `progressText`, and the ids below
     * are the only place those words live — the component hands the string straight to the
     * engine, so the reader still never sees a literal written in code.
     */
    { id: "progress", label: "{{current}} of {{total}}" },
    /**
     * The sentence announced politely on every step change. `{current}`, `{total}`, `{heading}`
     * and `{body}` are filled by the component from the step it just moved to, so the live
     * region says the same thing a sighted reader sees in the callout.
     */
    { id: "announce", label: "Step {current} of {total}: {heading}. {body}" },
    { id: "next", label: "Next" },
    { id: "previous", label: "Back" },
    { id: "done", label: "Done" },
    { id: "close", label: "Close the tour" },
    /**
     * The replay control (#458, mounted by `/dashboard/help` in #542). Three strings, not one: the
     * action's name, the sentence beside it that says what replaying does, and the word the button
     * shows while the mark is being cleared — a control that looks idle while a request is in
     * flight is a control a person presses twice.
     */
    { id: "replay", label: "Replay the tour" },
    {
      id: "replay-note",
      label: "Clears the mark that keeps the tour from opening, then returns you to the dashboard.",
    },
    { id: "replay-pending", label: "Opening the tour..." },
    { id: "replay-failed", label: "The tour could not be reopened just now. Try again." },
    /**
     * The example's own words (#457). The demo is a real answer sheet that fills itself, so it
     * needs exactly the strings a person reads around it: that it is an example, that it saves
     * nothing, whose questions it asks, which column is whose, and what the Gap between two
     * columns is. `components/tour/**` is at a literal budget of 0, so none of these may be
     * typed there.
     */
    {
      id: "demo-example",
      label: "An example: the answers fill themselves, and nothing here is saved.",
    },
    {
      id: "demo-example-note",
      label:
        "Both sides are shown, only to show the Gap. The real sheet keeps the other person's answers hidden until you have both submitted.",
    },
    { id: "demo-source", label: "Questions from {title}" },
    { id: "demo-yours", label: "You {value}" },
    { id: "demo-theirs", label: "They {value}" },
    { id: "demo-gap-heading", label: "Where the two answers part" },
    { id: "demo-gap", label: "Gap {value}" },
    { id: "demo-no-gap", label: "No Gap" },
    {
      id: "demo-cancelled",
      label:
        "The example stopped when you took over. The sheet is yours to answer, or start it again.",
    },
    { id: "demo-again", label: "Start the example again" },
    { id: "demo-saved-nothing", label: "The example was not submitted, and nothing was saved." },
  ],
  sections: [
    {
      id: "dashboard",
      heading: "Your console",
      body: "These four numbers are counts of your own relationships, and each card opens the list it counts.",
    },
    {
      id: "relationships",
      heading: "My relationships",
      body: "Every relationship you are part of is in this list. A row that still needs your answers says so before you open it.",
    },
    {
      id: "start",
      heading: "Start from a template",
      body: "A relationship begins with a template — the set of questions you and the other person will both answer.",
    },
    {
      id: "answer",
      heading: "You answer separately",
      /**
       * The one step whose sentence quotes the example's own numbers (#457): the pair comes from
       * `tourDemoAnswers` above, so the words and the sheet the demo fills cannot disagree. The
       * target is the demo's real answer sheet — the same `AnswerForm` `/assessment/instances/[id]`
       * renders — rather than a picture of one.
       */
      body: `You both answer those questions on your own. Watch the example fill itself: ${demoFirstAnswer.you} against ${demoFirstAnswer.theirs} on the first question, and the Gap is where your two sets of answers part.`,
    },
    {
      id: "blind",
      heading: "Nothing is visible early",
      body: "Neither of you can read the other's answers until you have both submitted. The Gap opens only then.",
    },
    {
      id: "help",
      heading: "A person, when you need one",
      body: "Support is one row away in this rail, and that is where you reach someone about the tour or the product.",
    },
  ],
});
