/**
 * `/how-it-works` — the console's own onboarding page (#owner review, console rail).
 *
 * The rail's second row used to point at `/#questions`, the marketing front page's band: a
 * signed-in member was sent out of the console to a public page to be told how the product works.
 * The owner's review asked for the opposite — "this is more detailed wizard / pro instruction
 * onboarding page" — so this route is the order of operations, inside the app shell, in the words
 * a member needs before their first relationship.
 *
 * **The shape is one band per step**, not a `steps` array of sentences: each band has a `heading`
 * (the move), a `body` (what the member does) and one `product` item (what the product does). That
 * is the pair the review asked each step to state, and the two halves are rendered side by side so
 * "I do this" cannot be mistaken for "it does that". The two lead-in words are the `labels` band —
 * a band rather than a literal, because E23 counts every string in the component.
 *
 * **The vocabulary is not authored here.** Mode, Setting, Aspect, Gap and Stage names come from
 * `content/` (`MODE_LABELS`, `SETTING_LABELS`, `GAP_*`, `STAGE_LABELS`); this fixture names the
 * moves and the product's behaviour, and a renamed model term must not need a second edit here.
 * No number is written as a fact — a Step exists per Aspect and is derived from the widest Gap by
 * `content/steps.ts`, which is what the step 5 sentence says instead of counting anything.
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
    "One relationship, six moves. This page is the order of operations — what you do at each step, and what the product does with it — so nothing about the next screen is a guess.",
  cta: { label: "Start with a template", href: "/assessment/templates" },
  secondaryCta: { label: "See my relationships", href: "/assessment/instances" },
  sections: [
    {
      /**
       * The two halves of every step. One band so the component asks for two ids instead of
       * spelling "You" and "The product" six times.
       */
      id: "labels",
      items: [
        { id: "you", label: "You" },
        { id: "product", label: "The product" },
        { id: "step", label: "Step {number}" },
      ],
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
