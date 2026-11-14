/**
 * `/how-it-works` — the console's onboarding page (#owner review, console rail), replayed (#898).
 *
 * The rail's second row used to point at `/#questions`, the marketing front page's band: a
 * signed-in member was sent out of the console to a public page to be told how the product works.
 * The owner's review asked for the opposite — "this is more detailed wizard / pro instruction
 * onboarding page" — so this route became the order of operations, inside the app shell, in the
 * words a member needs before their first relationship.
 *
 * **#898 turned the drawn explainer into a recording.** "How it works" that *describes* a flow
 * drifts: the page keeps saying stage 3 asks five Aspects long after the product asks four, and
 * nothing in the gate can see it. So the page now plays back a walk a browser actually made —
 * `docs/qa-demo-flow/transcript.json`, written by `pnpm demo:flow`, checked by
 * `pnpm demo:flow:check` — and every step band shows the values the persona typed and the screen the
 * product answered with. The copy here is the frame around that recording: what it is, what the two
 * halves of a step mean, and what the six moves are once creation is over. The steps themselves are
 * never authored in this file — they are the run's, which is why they cannot be wrong about the
 * product without the check going red.
 *
 * The `labels` band is a band rather than a literal because E23 counts every string in the
 * component; the same is true of the `paths`, `actions`, `fields`, `columns` and `findings` bands,
 * which are the vocabularies the stepper renders — a path name, an action, a form field, a column
 * heading. `fillLabel` fills `{number}` and `{count}` from the transcript at render time.
 *
 * **The vocabulary is not authored here.** Mode, Setting, Aspect, Gap and Stage names come from
 * `content/`; this fixture names the moves and the product's behaviour, and a renamed model term
 * must not need a second edit here. No number is written as a fact — a Step exists per Aspect and
 * is derived from the widest Gap by `content/steps.ts`, which is what the step 5 sentence says
 * instead of counting anything.
 *
 * The `limits` band is the honest half the review asked for: three facts about this build that a
 * reader would otherwise discover by hitting them — mail delivery depends on the deployment, a
 * control the product cannot honour is disabled on its own screen with the reason beside it, and
 * nothing schedules the next round.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const howItWorksPageCopy: PageCopy = zPageCopy.parse({
  heading: "How it works",
  subtitle:
    "One relationship, six moves — replayed from a browser that walked the create flow screen by screen, so nothing about the next screen is a guess.",
  // #794 (D2) — this CTA pointed at `/assessment/templates`, a signed-in screen: a marketing page
  // deep-linking a stranger into a login wall. It points at the public catalogue instead, which is
  // the page that actually sells a relationship type. The *words* are unchanged; only the
  // destination moved, from a door nobody could open to the one that is open.
  cta: { label: "Start with a template", href: "/relationship-templates" },
  secondaryCta: { label: "See my relationships", href: "/assessment/instances" },
  sections: [
    {
      /**
       * The words of one step. One band so the component asks for ids instead of spelling "You" and
       * "The product" — and, since #898, "Typed", "Pressed" and "Checked" too.
       */
      id: "labels",
      items: [
        { id: "you", label: "You" },
        { id: "product", label: "The product" },
        { id: "step", label: "Step {number}" },
      ],
    },
    {
      /**
       * What the recording is, and the run's own headline numbers. `items` are filled from the
       * transcript's `summary` and `cleanup` blocks — the counts are the run's, never this file's.
       */
      id: "demo",
      heading: "A run, recorded",
      body: "What follows is not a drawing of the flow. A browser opened the demo build, typed a persona's details and wrote down every screen it met; each band below is one of those steps, with what was entered beside what appeared. The run is recorded: `pnpm demo:flow` writes the transcript and `pnpm demo:flow:check` fails when a committed step or screenshot stops matching a fresh run, so this page cannot drift into showing a flow the product no longer performs. Where a step did not hold, its band says so and the findings name what the run met instead.",
      items: [
        { id: "paths", label: "{count} paths" },
        { id: "steps", label: "{count} steps" },
        { id: "findings", label: "{count} findings" },
        { id: "left-behind", label: "{count} records left on the branch" },
      ],
    },
    {
      id: "paths",
      heading: "Three ways the same flow ends",
      body: "The walk ran the same stages three times with different intentions. Each path ends where it ends — the badge says whether it reached the screen it was meant to, not whether it succeeded.",
      items: [
        { id: "create-published", label: "Create and publish" },
        { id: "create-draft", label: "Keep it as a draft" },
        { id: "unpaid", label: "Stop at payment" },
        { id: "reached", label: "Reached its last screen" },
        { id: "stopped", label: "Stopped short" },
        {
          id: "no-steps",
          label:
            "This path recorded no steps — the run stopped before it walked this one. The transcript is committed as it ran; nothing was filled in to make the page look complete.",
        },
        { id: "terminal", label: "Meant to end on" },
        { id: "step-count", label: "{count} steps" },
        { id: "nothing-left", label: "nothing left behind" },
        { id: "records-left", label: "{count} records left behind" },
      ],
    },
    {
      /** What the run did at a step. One word each, because the badge has no room for a sentence. */
      id: "actions",
      items: [
        { id: "fill", label: "Typed" },
        { id: "click", label: "Pressed" },
        { id: "assert", label: "Checked" },
      ],
    },
    {
      /** The columns of a band, and the two verdicts. */
      id: "columns",
      items: [
        { id: "route", label: "Route" },
        { id: "entered", label: "What was entered" },
        { id: "appeared", label: "What appeared" },
        { id: "nothing-entered", label: "Nothing typed — this step is a check, not a form" },
        { id: "held", label: "Held" },
        { id: "missed", label: "Did not hold" },
      ],
    },
    {
      /**
       * The form fields the run filled, keyed by the transcript's own key. A key with no row here is
       * rendered raw (its name is the transcript's vocabulary, not a sentence) rather than dropped:
       * a new field in the flow must still show its value.
       */
      id: "fields",
      items: [
        { id: "title", label: "Title" },
        { id: "initiator-first", label: "Your first name" },
        { id: "initiator-last", label: "Your last name" },
        { id: "counterparty-first", label: "Their first name" },
        { id: "counterparty-last", label: "Their last name" },
        { id: "email", label: "Their email" },
        { id: "description", label: "Description" },
        { id: "mode", label: "Mode" },
        { id: "alignment-setting", label: "Setting" },
        { id: "pin", label: "Pin" },
        { id: "role", label: "Role" },
        { id: "plan", label: "Plan" },
      ],
    },
    {
      /**
       * A recording that only showed what worked would be a brochure. The findings are the run's own
       * `findings` block — a report, never a failure of the walk — and `actual` sits behind a
       * disclosure because the run quotes the whole screen it met, chrome and all.
       */
      id: "findings",
      heading: "Where the run found something",
      body: "These are the places where the product did something the walk did not expect. The transcript kept them as they happened, and the frame beside each one is the screen the run met.",
      items: [
        { id: "expected", label: "The run expected" },
        { id: "actual", label: "The screen said" },
        { id: "note", label: "Why" },
        { id: "quoted", label: "What the page rendered" },
        { id: "no-shot", label: "No screen was captured for this one" },
      ],
    },
    {
      /**
       * The six moves: what happens once the recording's five stages have created the relationship.
       * The recording stops at creation, so this band is the part of the page that is still words —
       * stated as the *rest* of the relationship rather than as a second walkthrough.
       */
      id: "moves",
      heading: "The six moves, in words",
      body: "The recording covers creating a relationship. What both people do once they are in one is the rest of this page:",
    },
    {
      id: "step-template",
      heading: "Pick a relationship type and a Template",
      body: "Open Templates and choose the relationship you want to work on — a manager and their report, a parent and their child, two colleagues. Open a template to read the Aspects it asks before you commit to it.",
      items: [
        {
          id: "product",
          label:
            "The catalogue shows each template's Relationship Type, the Aspects it asks, and the two roles it seats. Opening one shows the Mode (which Opinions it asks) and the Setting its Gaps will be judged against.",
        },
      ],
    },
    {
      id: "step-invite",
      heading: "Invite the other person — the Member",
      body: "Name the person you are doing this with and send them the invitation. There are two seats and you take one; they take the other. Nobody answers on anybody else's behalf.",
      items: [
        {
          id: "product",
          label:
            "The product opens their seat and holds the relationship at Invited until they open the link. The link is single-use and lasts seven days, and it is always printed for you to copy.",
        },
      ],
    },
    {
      id: "step-answer",
      heading: "Both answer blind",
      body: "Each of you answers every Aspect twice: how it feels today, and how you wish it to be. You answer from your own side, on your own sheet, and you submit the whole sheet at once.",
      items: [
        {
          id: "product",
          label:
            "Each sheet is sealed on submit and stays sealed through the review window. Until you have both accepted, neither of you can see the other's answers — they are absent, not greyed out — and the relationship list says only that the other person is not done.",
        },
      ],
    },
    {
      id: "step-accept",
      heading: "Both accept",
      body: "Read what the two of you said, then accept it. Acceptance is each party's own act: one acceptance is not the relationship agreeing.",
      items: [
        {
          id: "product",
          label:
            "The accept screen puts the two seats side by side with the Aspects beneath them. The second acceptance is what completes the relationship and opens the report: one acceptance is not the relationship agreeing, and the control is disabled wherever a decision cannot be recorded, with the reason beside it.",
        },
      ],
    },
    {
      id: "step-report",
      heading: "Read the report and its Steps",
      body: "Open the report and read the Gap on each Aspect — the distance between how each of you scored it — then work through the Steps it derives.",
      items: [
        {
          id: "product",
          label:
            "Once both of you have accepted, every Gap is computed when the page is read, from the two stored sheets, and judged against the Setting. Each Aspect gets exactly one Step, sourced from its widest Gap; an Aspect in synch gets none, because there is nothing to do.",
        },
      ],
    },
    {
      id: "step-next",
      heading: "Start the next session",
      body: "Come back to a relationship when something has changed and answer again. A relationship is a series of sessions, not a single test you passed or failed.",
      items: [
        {
          id: "product",
          label:
            "The report you already read stays as it was: a later session is a new record, so what the two of you agreed and saw is never rewritten underneath you.",
        },
      ],
    },
    {
      id: "limits",
      heading: "What this build does not do yet",
      body: "The sequence above is the product; these are the places where this build is honest about the gaps, so you meet them here rather than on a screen you thought had worked.",
      items: [
        {
          id: "mail",
          label:
            "An invitation is always printed as a link you can copy. Whether it is also emailed depends on the deployment's mail provider: with none configured, no message was attempted and the invite screen says so.",
        },
        {
          id: "unrecorded",
          label:
            "A step the product cannot record is refused in place. The screen that owns it disables the control and states the reason instead of saving something that looks like a decision.",
        },
        {
          id: "no-schedule",
          label:
            "Nothing schedules the next session for you, and nothing chases the other party. A reminder is a feature this build does not have; the relationship list is where the state of one lives.",
        },
      ],
    },
  ],
});
