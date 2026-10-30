/**
 * `/` for the AlignSynch build — the alignment page's copy (issue #143).
 *
 * `data/pages/home.ts` is the QuizHub front page: categories, tournaments, leaderboards,
 * "Earn Rewards". This module is the other composition of the same route, and which one
 * renders is a build flag (`BRAND`), not a second page — `app/(mainlayout)/page.tsx` switches
 * on the brand the way `resolveBrand` does, so neither product inherits the other's front
 * page by accident.
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
 * response that the fixture does not hold. The two `{...}` placeholders below are the one place
 * the words meet the data.
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
 * The `/` document title for this build — `"<brand> — How you feel, against how they feel"`.
 *
 * A function of the brand, like `homeTitle`: the page names the product itself, and the
 * alignment page's tagline is the product's two questions rather than the quiz template's
 * "Play, Share, Earn". Neither word is spelled in a `.tsx`.
 */
export function alignSynchHomeTitle(brand: Pick<Brand, "name">): string {
  return `${brand.name} — How you feel, against how they feel`;
}

export const alignSynchHomeCopy: PageCopy = zPageCopy.parse({
  heading: "How do you feel, against how they feel?",
  subtitle:
    "You both answer the same five Aspects, twice over: how it is now, and how you each want it to be. The answers rarely match, and the distance between them is the Gap.",
  cta: { label: "Read Avery and Rowan", href: "/assessment/avery-rowan" },
  items: [
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
      heading: "Four templates",
      body: "A template does nothing until two people copy it and answer its five Aspects. {title}, answered by {left} and {right}, is the one with answers to read.",
    },
    {
      id: "families",
      heading: "Two families",
      body: "Every Relationship Type the templates cover. If no template backs a type, it isn't offered.",
    },
  ],
});
