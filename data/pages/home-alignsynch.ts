/**
 * `/` for the AlignSynch build — the alignment page's copy, pitched at the leader's outcome
 * (issue #143).
 *
 * `data/pages/home.ts` is the QuizHub front page: categories, tournaments, leaderboards,
 * "Earn Rewards". This module is the other composition of the same route, and which one
 * renders is a build flag (`BRAND`), not a second page — `app/(marketing)/page.tsx` switches
 * on the brand the way `resolveBrand` does, so neither product inherits the other's front
 * page by accident.
 *
 * **The page leads with a leadership outcome, and the Gap is the proof underneath.** An earlier
 * version of this fixture opened on the two questions ("How do you feel, against how they feel?")
 * and sold a relationship curiosity; the version after it sold a practice — a heading promising
 * the reader a business they bill clients for — which made the reader a vendor before they had
 * read a word about the work. The words below are pitched at the person accountable for the
 * relationship — a lead, a manager, a partner — and the hero names what they cannot otherwise
 * hear: what their team will not say to their face. The Gap is still the mechanism, and the
 * `practice` band still describes running the cycle with each counterparty; the hero no longer
 * sells a session.
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
 * `{realms}` realms, filled from `data/relationship-types.ts` by `relationshipScope()`;
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
 *
 * The title still carries the practice word after the hero stopped carrying it. That is
 * deliberate, not drift: the title is a positioning decision of its own (it is what a search
 * result and a browser tab say), and it is not one of the three hero strings the leadership
 * card names. Moving it is a one-line change here plus a parity summary, to be taken as its
 * own decision by the owner.
 */
export function alignSynchHomeTitle(brand: Pick<Brand, "name">): string {
  return `${brand.name} — Turn one relationship into a practice`;
}

export const alignSynchHomeCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Relationship alignment · for leaders and teams",
  heading: "Know what your team will not say out loud.",
  /**
   * The hero's copy divides one job each: the eyebrow says who the page is for, the heading
   * states the outcome a leader owns (the thing their team will not say to their face), the
   * subtitle states the mechanism (two people answer the same questions blind, and where their
   * answers part is the thing to act on), and the fineprint — one sentence, never two — states
   * what a reader is buying.
   *
   * The register is leadership, not practice: the reader is accountable for the relationship and
   * for what they do next, not selling a session to a client. So no line here prices the work.
   * A heading about billing, "paid to run" and "yours to run" all made the sale the promise,
   * which read as a business a practitioner runs rather than an advantage the reader holds.
   */
  subtitle:
    "Two people answer the same questions blind. You see where intention and experience part company — and what to do next.",
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
      /**
       * The card's closing line does two jobs: it says what the Gap is *for*, and it defines the
       * one term on the card a reader cannot infer. `In Synch` is the glossary's spelling and the
       * brand's (`AlignSynch`), so it stays — but a row that says it must say what it means, or
       * the spelling reads as a typo. One line, not a tooltip and not a footnote.
       */
      body: "Two answers per Aspect; the distance between them is the Gap. When both answers match, the Gap is 0 and the row says In Synch — the brand's spelling of in sync.",
    },
    /**
     * The mode, as a caption rather than a pill: "Answered in Basic mode" says what it qualifies,
     * where a bare "Basic" badge in a hero reads as a plan tier — or as a verdict on the product.
     * It is the instance's own `mode` field, so the words are the record's and not a design's.
     */
    { id: "worked-example-mode-basic", label: "Answered in Basic mode" },
    { id: "worked-example-mode-advanced", label: "Answered in Advanced mode" },
    /**
     * One row's note: the scale the two scores sit on, and the Gap their difference came to.
     * A Gap of 0 is the glossary's In Synch and gets its own sentence rather than "Gap 0".
     */
    { id: "worked-example-row", label: "{from} → {to} · {kind} {gap}" },
    { id: "worked-example-in-synch", label: "{from} → {to} · In Synch" },
    /** The bars' accessible name: two numbers and who gave them. */
    { id: "worked-example-scores", label: "{you} {yours}, {them} {theirs}" },
    /**
     * The templates band's one call to action. The band is capped at six cards (the shelf in
     * `data/template-shelf.ts`) and this link is the whole navigation: the catalogue itself is
     * the public `/templates` page, which lists every template by realm.
     */
    { id: "templates-view-all", label: "View all relationship templates" },
    /** The two card actions, and the frame the two roles are joined by. */
    { id: "template-use", label: "Start with this template" },
    { id: "template-example", label: "See a worked example" },
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    { id: "template-price", label: "{price} per relationship" },
    /**
     * Under the hero CTA: the two facts that make the button safe to press — one relationship is
     * bought once and every session after it is the reader's, and the reader's seat is the coach's
     * rather than a third answer. **One sentence**, because the three-line version repeated the
     * purchase fact twice ("paid to run", "yours to run") and buried the fact it was trying to
     * make. Since the heading now states an outcome rather than a sale, this line is the only
     * place on the page that says what buying a relationship gets you.
     */
    {
      id: "hero-fineprint",
      label:
        "One relationship is bought once, every session after it is yours, and you are named as its coach rather than answering as a party.",
    },
    /**
     * The risk-reducer directly under the CTA. It is a claim the product already makes elsewhere —
     * `/pricing`'s FAQ says the Free plan needs "no card and no subscription" — so this is the
     * same promise at the point of decision, not a second one.
     */
    { id: "hero-reassurance", label: "Free to start · no card" },
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
      heading: "Start from the relationship you have.",
      body: "A shelf of the catalogue's templates, one per realm a practice meets first: what each one asks, who it is between, and what it costs. Every template in the catalogue is one the product can run, so nothing here is for sale that it cannot.",
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
