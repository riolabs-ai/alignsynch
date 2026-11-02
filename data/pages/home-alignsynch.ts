/**
 * `/` for the AlignSynch build — the alignment page's copy, positioned as a practice (issue #143).
 *
 * `data/pages/home.ts` is the QuizHub front page: categories, tournaments, leaderboards,
 * "Earn Rewards". This module is the other composition of the same route, and which one
 * renders is a build flag (`BRAND`), not a second page — `app/(marketing)/page.tsx` switches
 * on the brand the way `resolveBrand` does, so neither product inherits the other's front
 * page by accident.
 *
 * **The page leads with a practice, and the Gap is the proof underneath.** An earlier version
 * of this fixture opened on the two questions ("How do you feel, against how they feel?") and
 * sold a relationship curiosity. The words below sell the thing a practitioner charges for:
 * a template that is theirs, a blind two-sided answer, and a report that becomes the agenda
 * of the session they run. The `questions` and `templates` bands are unchanged — the Gap is
 * still the mechanism — but they now sit under a business framing rather than in front of it.
 *
 * Why this is not an entry in `data/pages/index.ts`: the table is keyed by the route pattern
 * (`/`), and one route carries one `PageCopy` — the fixture the `"/"` budget entry in
 * `data/pages/budget.ts` names. A second key for the same route would be a second row for a
 * surface that has one, so the alignment fixture is parsed here (by the same `zPageCopy`) and
 * read by `lib/alignment-home.ts`. Its section ids are held to the tree by `next build`: the
 * projection calls `sectionOf()`, which throws on an id this file does not declare, and `/` is
 * prerendered. `tests/alignment-home.test.ts` pins the same thing in a node run.
 *
 * What is copy here and what is not: the words are here, the *records* are not. The four
 * templates and their families come from `data/assessments.ts`; the answer counts, the party
 * names and the links are derived from it by `lib/alignment-home.ts`. So this file never names
 * a template, a relationship or a type, and the page cannot claim a fifth template or a
 * response that the fixture does not hold. The `{...}` placeholders below are the one place
 * the words meet the data.
 *
 * **No number in this file is typed.** The scope band's heading is `{types}` types across
 * `{realms}` realms, filled from `data/v1/relationship-types.ts` by `relationshipScope()`;
 * the projection refuses a heading that does not carry both placeholders, so a spelled-out
 * count cannot creep back in and drift from the fixture. There is likewise no figure anywhere
 * in this file for what a practice takes in, how many clients it has, or who has bought one:
 * the `boundary` band states that absence as a promise rather than leaving it to be inferred.
 *
 * The featured relationship is the one design decision this file carries that is not copy:
 * `/` leads with an answered assessment, and `ALIGN_SYNCH_FEATURED_SLUG` names which one. The
 * hero CTA's `href` is that same relationship, and a test fails when the two stop agreeing.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

/**
 * The relationship the front page leads with — the instance slug the hero links to.
 *
 * Avery and Rowan's Relationship Basics is the worked example: two parties, five Aspects,
 * Basic Mode on three of them and Advanced on two, and a Feel Gap of 3 on the first. It is a
 * slug rather than a whole link because the route (`/assessment/[slug]`) belongs to
 * `lib/alignment-home.ts`, and a record named in two places is a record that drifts.
 */
export const ALIGN_SYNCH_FEATURED_SLUG = "avery-rowan";

/**
 * The `/` document title for this build — `"<brand> — Turn one relationship into a practice"`.
 *
 * A function of the brand, like `homeTitle`: the page names the product itself, and the
 * alignment page's tagline is the practice the product makes possible rather than the quiz
 * template's "Play, Share, Earn". Neither word is spelled in a `.tsx`.
 */
export function alignSynchHomeTitle(brand: Pick<Brand, "name">): string {
  return `${brand.name} — Turn one relationship into a practice`;
}

export const alignSynchHomeCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Relationship alignment · for practitioners",
  heading: "Turn one assessment into a practice you can charge for.",
  subtitle:
    "Pick a relationship type, write the Aspects you actually work on, and send it to a client and the person they're aligning with. Both answer blind. You get the Gap — and the agenda for the session you're paid to run.",
  /**
   * Two CTAs, and the order is the argument: creating the first relationship is what the reader
   * came to do, and the worked example is how they check the product can do it. Both are
   * destinations a reader without an account can reach — `/register` makes one, and the
   * instance route is public — which is why neither points into the console.
   */
  cta: { label: "Create your first assessment", href: "/register" },
  secondaryCta: { label: "See a worked example", href: "/assessment/avery-rowan" },
  items: [
    /**
     * The eyebrow over each band. They live on the page rather than inside their sections
     * because `cardsOf()` reads every item of `practice` and `seats` as a titled card — an
     * eyebrow in those arrays would be a card with no paragraph, and the projection refuses it.
     */
    { id: "eyebrow-practice", label: "How the practice works" },
    { id: "eyebrow-questions", label: "The mechanism" },
    { id: "eyebrow-templates", label: "The catalogue" },
    { id: "eyebrow-families", label: "Scope" },
    { id: "eyebrow-seats", label: "Your seat" },
    /**
     * The hero's worked-example card: the featured relationship, drawn from its own opinions.
     * `{title}`, `{from}`, `{to}`, `{gap}` and the two party names are filled by
     * `lib/alignment-home.ts` out of `data/assessments.ts` — this file owns the frame, never the
     * numbers inside it.
     */
    {
      id: "worked-example",
      label: "Worked example · {title}",
      body: "Two answers per Aspect. The distance between them is the Gap — the only thing the session has to work with.",
    },
    /** The mode pill: the one thing about the featured instance a reader can check at a glance. */
    { id: "worked-example-mode-basic", label: "Basic" },
    { id: "worked-example-mode-advanced", label: "Advanced" },
    /**
     * One row's note: the scale the two scores sit on, and the Gap their difference came to.
     * A Gap of 0 is the glossary's In Synch and gets its own sentence rather than "Gap 0".
     */
    { id: "worked-example-row", label: "{from} → {to} · {kind} {gap}" },
    { id: "worked-example-in-synch", label: "{from} → {to} · In Synch" },
    /** The bars' accessible name: two numbers and who gave them. */
    { id: "worked-example-scores", label: "{you} {yours}, {them} {theirs}" },
    /**
     * The templates band's three views. The values are markup (`catalogue`/`library`/`mine`);
     * the words are here, because a tab is a label a reader reads.
     */
    { id: "templates-tab-catalogue", label: "Relationship templates" },
    { id: "templates-tab-library", label: "Library templates" },
    { id: "templates-tab-mine", label: "My relationships" },
    /** The two card actions, and the frame the two roles are joined by. */
    { id: "template-use", label: "Use this template" },
    { id: "template-example", label: "Read the example" },
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    /**
     * The third view, as a door: `/` is public, so it names no relationship and renders none.
     * `value` is the route the door opens — `/assessment/instances` decides who may walk in.
     */
    {
      id: "templates-mine",
      label: "Open my relationships",
      value: "/assessment/instances",
      body: "Your relationships live behind your session, in the console — not on this page, which anyone can read. Sign in and the list is one click away.",
    },
    /** Under the hero CTA: what is bought once, and which seat the reader holds. */
    {
      id: "hero-fineprint",
      label:
        "One relationship is bought once; every session after it is yours to run. You are named on the relationship as its coach — not as a third party answering.",
    },
    /** The two sides of every Aspect. A reader's own answer, and the other party's. */
    { id: "side-you", label: "You" },
    { id: "side-them", label: "They" },
    /** A template's link, named after the two people who answered it. */
    { id: "template-read", label: "Read {left} and {right}" },
    /**
     * The state of a template nobody has answered yet — and nothing more.
     *
     * The row renders as a note, not a link, and the note has no control beside it: there is no
     * copy-into-a-relationship flow on this page, so the sentence must not offer one. Say the
     * state (unanswered), not the verb a reader cannot perform.
     */
    {
      id: "template-unplayed",
      label: "No relationship yet",
      body: "Nobody has answered this template yet. Its Aspects are still unnamed — the two answers each one asks for arrive with the relationship.",
    },
    /** One row of a template: how many Aspects it asks, counted from the record. */
    { id: "aspects", label: "{count} Aspects" },
  ],
  sections: [
    {
      id: "practice",
      heading: "Create once. Run it with every client.",
      items: [
        {
          id: "practice-create",
          label: "Create",
          body: "Write the Aspects for one relationship type — what you actually ask about in session. That template is your product; it doesn't change per client.",
        },
        {
          id: "practice-invite",
          label: "Invite both sides",
          body: "Send it to your client and to their counterparty. Neither sees the other's answers until both accept — so nothing is softened for your benefit.",
        },
        {
          id: "practice-session",
          label: "Run the session",
          body: "The report names every Gap by kind and size, and the Steps that follow from it. That's your agenda, and the reason the next session is billable.",
        },
      ],
    },
    {
      id: "questions",
      heading: "The same question, answered twice",
      body: "Every Aspect gets two answers, one from each of you. Neither is a score to chase. One says where the relationship is today; the other says where you each want it to go.",
      items: [
        {
          id: "question-feel",
          label: "How does it feel to you?",
          value: "How does it feel to them?",
          body: "The same Aspect from both sides. Subtract one score from the other and you have the Feel Gap.",
        },
        {
          id: "question-wish",
          label: "How do you wish it to be?",
          value: "How do they wish it to be?",
          body: "What each of you wants next, on the same Aspect. The Wish Gap is how far those two wishes sit apart.",
        },
      ],
    },
    {
      id: "templates",
      heading: "Start from a type, a template, or your own list.",
      body: "The catalogue is every relationship type this product sells; the library is what this deployment has already built. A type is only offered if a template backs it, so nothing here is for sale that the product can't run.",
    },
    {
      id: "families",
      heading: "{types} relationship types, across {realms} realms.",
      body: "A type is only offered if a template backs it, so you are never selling something the product can't run. Business and Office relationships are a practice's spine; Home and Social are what clients bring with them.",
    },
    {
      id: "seats",
      heading: "You're the coach on the relationship — a role, not a third answer.",
      body: "Three seats exist on every relationship. The coach reads the relationship and runs the cycle; the two parties answer. A coach never submits an opinion, so the report can't be shaped by the person being paid for it.",
      items: [
        {
          id: "seat-initiator",
          label: "Initiator",
          body: "Bought the relationship and invited the other side.",
        },
        {
          id: "seat-counterparty",
          label: "Counterparty",
          body: "Answers independently, blind until both accept.",
        },
        {
          id: "seat-coach",
          label: "Coach",
          body: "Reads, runs the session, starts the next cycle. No opinion of their own.",
        },
      ],
    },
    {
      id: "boundary",
      heading: "What this page does not claim.",
      body: "No pay figures, no client counts, no logos. The product model is real and priced per relationship; what a practice brings in depends on what it charges and how many clients it runs.",
    },
  ],
});
