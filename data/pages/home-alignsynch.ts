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
 * The `/` document title for this build — `"<brand> — Personal and Business Relationships"`.
 *
 * A function of the brand, like `homeTitle`: the page names the product itself, and the AS2
 * redesign's tagline is the two audiences the approved page opens on (#853) rather than the quiz
 * template's "Play, Share, Earn". Neither word is spelled in a `.tsx`.
 *
 * **It moved with the page.** The retired composition's title named a leader's outcome
 * ("Relationship alignment for leaders and teams"); the approved page's eyebrow says "For personal
 * and business relationships" and its two hero cards are a personal life and a business life, so
 * the tab title says the same thing the page says. A title that still sold a leadership outcome
 * over a page that no longer argues one is the drift this function exists to make a one-line
 * change.
 */
export function alignSynchHomeTitle(brand: Pick<Brand, "name">): string {
  return `${brand.name} — Personal and Business Relationships`;
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
    { id: "eyebrow-practice", label: "How the work works" },
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
    /**
     * The card's one figure: the plan that includes every template, and its interval. `{plan}` and
     * `{price}` come from `data/billing-plans.ts` through `cataloguePriceNote()` — the same string
     * `/templates` and `/templates/<slug>` carry, because the three surfaces sell one plan (#798).
     */
    { id: "template-price", label: "{plan} · {price}/mo" },
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
      heading: "One approach. Used with every relationship.",
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
          body: "The report names every Gap by kind and size, and the Steps that follow from it. That's your agenda, and why the next conversation has somewhere to go.",
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
      body: "No pay figures, no client counts, no logos. The product model is real, and the pricing page states what it costs.",
    },
  ],
});

/**
 * The `/` page that ships on this build since #853 — the AS2 redesign's copy.
 *
 * **Two compositions of one route live in this file, and this is the live one.** The export above
 * is the retired alignment composition (issue #143): `components/home/alignment-home.tsx` still
 * draws it, `lib/alignment-home.ts` still projects it, and `tests/alignment-home.test.ts` still
 * holds it to its records — it is kept as the reference the AS2 sections vary from, and it is not
 * reachable from `/` any more. `app/(marketing)/page.tsx` renders *this* fixture. Deleting the
 * retired pair is its own card: it takes `components/home/template-shelf.tsx`, three test files and
 * the `template-ancestor:` headers that point at that view with it, which is a review of its own
 * and none of #853's business.
 *
 * Both are parsed by the same `zPageCopy`, so both are held to the same rules — no unknown keys, no
 * section id twice, every `cta.href` a route in `content/routes.ts`.
 *
 * ## What is copy here and what is not
 *
 * The words are here. The templates are not: the two template groups are
 * `data/relationship-types.ts`'s own taxonomy (`purchasableTypesByGroup()`, the same grouping the
 * catalogue and the dashboard library draw), each chip links through `catalogueDetailPath()`, and
 * the three "questions to ask" prompts are written here because they are copy — the blank is a
 * blank, not a record. So the page cannot claim a relationship type the product cannot run, and it
 * cannot print a count or a price nobody re-measures: it prints none.
 *
 * ## The ids are the join, and the prefixes are the convention
 *
 * `lib/home-alignsynch.ts` reads this fixture and hands each section component a resolved
 * view-model; a component never names an id. Three prefixes drive ordered lists, so a copy edit
 * (add a benefit, reorder the steps) needs no `.tsx` change:
 *
 *   `step-N`     a numbered step in the how-it-works band, rendered in declared order
 *   `benefit-N`  one benefit row, rendered in declared order
 *   `story-N-*`  one participant card's title / quote / alternate quote / support sentence
 *
 * A missing id throws when the page renders — `/` is prerendered by the gate, so a typo is a red
 * build rather than a blank heading — and `tests/as2-home.test.tsx` pins the same ids in a node
 * run.
 */
export const alignSynchHomeAs2Copy: PageCopy = zPageCopy.parse({
  eyebrow: "For personal and business relationships",
  heading: "Know the feelings. Handle the expectations.",
  subtitle:
    "Choose a relationship, record how you see it, and invite the other person to do the same. Compare your opinions and talk through what differs.",
  items: [
    /* The in-page menu's accessible name. It lives on the page bag rather than in the menu's own
       section because the menu's items *are* the five targets — a sixth row would render as a
       sixth link. */
    { id: "nav-name", label: "On this page" },
    /*
     * The hero's two actions. Both are in-page anchors, so neither is a `cta`: a copy `cta.href`
     * must be a route, and `#relationship-templates` is a scroll position on this page.
     */
    { id: "hero-action", label: "Choose a relationship" },
    { id: "hero-secondary", label: "See how it works" },
    { id: "hero-note", label: "A clearer view of where you agree—and where you don't." },
    /*
     * The two hero cards: a kicker, the card's name, the action inside it, and the accessible name
     * the whole card carries (the card is one link, so it needs one useful name).
     */
    { id: "life-personal-kicker", label: "Personal relationships" },
    { id: "life-personal-title", label: "Personal Life" },
    { id: "life-personal-action", label: "View templates" },
    { id: "life-personal-name", label: "Explore personal relationship templates" },
    { id: "life-business-kicker", label: "Work relationships" },
    { id: "life-business-title", label: "Business Life" },
    { id: "life-business-action", label: "View templates" },
    { id: "life-business-name", label: "Explore business relationship templates" },
  ],
  sections: [
    {
      /** The in-page menu. Each item's id **is** its anchor target, so the menu cannot advertise a
       *  band the page does not emit: `lib/home-alignsynch.ts` builds the href from the id, and the
       *  band that carries that id is the one this file's section list declares. */
      id: "section-nav",
      items: [
        { id: "how-it-works", label: "How it works" },
        { id: "relationship-templates", label: "Templates" },
        { id: "questions", label: "The model" },
        { id: "stories", label: "Responses" },
        { id: "benefits", label: "Why it matters" },
      ],
    },
    {
      id: "how-it-works",
      heading: "How AlignSynch works",
      body: "Choose a relationship and its aspects. Each person records an opinion on those same aspects. Then compare your answers and discuss the differences.",
      items: [
        /* A band's eyebrow is an *item*, not a section field: `zPageCopySection` carries heading,
           body and cta, and no band-level kicker — the reader joins it by id like any other row. */
        { id: "eyebrow-how-it-works", label: "How it works" },
        {
          id: "step-1",
          label: "Choose the relationship",
          body: "Select a personal, school, community, or business relationship. Edit the suggested aspects to fit.",
        },
        {
          id: "step-2",
          label: "Invite the other person",
          body: "Register and invite your counterpart to respond to the same aspects.",
        },
        {
          id: "step-3",
          label: "Record your opinions",
          body: "Each person shares how they see the aspects of this relationship.",
        },
        {
          id: "step-4",
          label: "Compare and discuss",
          body: "Review where your answers differ and talk through those gaps.",
        },
        { id: "how-start-eyebrow", label: "Start here" },
        {
          id: "how-start-body",
          label: "Browse the relationship templates and choose one to make your own.",
        },
        { id: "how-action", label: "View templates" },
      ],
    },
    {
      id: "relationship-templates",
      heading: "Start with a relationship",
      body: "Choose a personal, school, community, or business relationship. Start with suggested aspects, then edit them to fit your situation.",
      items: [
        /** The two group headings, keyed to `TypeGroup` by the projection — the taxonomy decides
         *  which types sit under which, this owns only the words above them. */
        { id: "templates-group-business", label: "Business & Work" },
        { id: "templates-group-personal", label: "Personal, School & Community" },
        { id: "templates-action", label: "Browse Business & Work" },
        { id: "templates-secondary", label: "Browse Personal, School & Community" },
        {
          id: "templates-note",
          label:
            "Each template includes suggested aspects you can edit for the people and circumstances involved.",
        },
      ],
    },
    {
      /** `id="questions"` is load-bearing: the shared header and footer both link to
       *  `/#questions`, and that anchor predates this page. */
      id: "questions",
      heading: "See how feelings, wishes, and assumptions can drift apart.",
      body: "First, notice where your views may differ. Then compare opinions on a scale, with room for answers between yes and no.",
      items: [
        { id: "eyebrow-questions", label: "The AlignSynch model" },
        { id: "bread-step", label: "The Bread" },
        { id: "bread-kicker", label: "Feel · Wish · Think · Guess" },
        { id: "bread-title", label: "Four ways a gap can form" },
        {
          id: "bread-deck",
          label:
            "Notice the difference between what you feel or wish and what you think or guess about the other person.",
        },
        {
          id: "bread-line-feel",
          label: "FEEL",
          body: "You feel it is different than they feel.",
        },
        {
          id: "bread-line-wish",
          label: "WISH",
          body: "You wish it to be different than they wish.",
        },
        {
          id: "bread-line-think",
          label: "THINK",
          body: "You think they feel it is different than they really feel.",
        },
        {
          id: "bread-line-guess",
          label: "GUESS",
          body: "You guess they wish it to be different than they really wish.",
        },
        { id: "bread-note-lead", label: "Four potential pitfalls" },
        { id: "bread-note-rest", label: "to notice in most relationships." },
        { id: "bread-list-name", label: "Four potential relationship pitfalls" },
        { id: "butter-step", label: "The Butter" },
        { id: "butter-kicker", label: "Opinions are on a sliding scale" },
        { id: "butter-title", label: "Opinions fall along a scale" },
        {
          id: "butter-deck",
          label:
            "An answer can be somewhere between yes and no. A small difference is still useful to notice.",
        },
        {
          id: "butter-scale-name",
          label: "A scale from yes to no, with room somewhere in between",
        },
        { id: "butter-scale-yes", label: "YES" },
        { id: "butter-scale-no", label: "NO" },
        { id: "butter-scale-middle", label: "Somewhere in between" },
        {
          id: "butter-line-feel",
          label: "FEEL",
          body: "Actually, you feel it is only slightly different.",
        },
        {
          id: "butter-line-wish",
          label: "WISH",
          body: "You wish it to slowly change only a little bit.",
        },
        {
          id: "butter-line-they-feel",
          label: "FEEL",
          body: "They feel it is just a tad different.",
        },
        {
          id: "butter-line-they-wish",
          label: "WISH",
          body: "They wish it to be just a touch different.",
        },
        { id: "butter-list-name", label: "Examples of opinions between yes and no" },
      ],
    },
    {
      id: "stories",
      heading: "A clearer view can open a conversation.",
      body: "These reflections describe seeing where things stand, finding a gentler way to talk, and recognizing that answers aren't always just yes or no.",
      items: [
        { id: "eyebrow-stories", label: "What participants said" },
        { id: "story-1-title", label: "See where things stand" },
        {
          id: "story-1-quote",
          label: "“This let me see where things stand and where we wish them to go in the future.”",
        },
        {
          id: "story-1-support",
          label:
            "Reach a state of agreement, harmony, and understanding. Progress—even slight progress—can give hope.",
        },
        { id: "story-2-title", label: "Open a softer conversation" },
        {
          id: "story-2-quote",
          label: "“This works because it opened an easy soft communication channel for me!”",
        },
        {
          id: "story-2-quote-alt",
          label:
            "“It was hard for us to discuss these things. This opened our eyes to what we need to work on.”",
        },
        {
          id: "story-2-support",
          label: "Sometimes it is hard to know how to ask in a soft, non-confrontational way.",
        },
        { id: "story-3-title", label: "Find more than yes or no" },
        {
          id: "story-3-quote",
          label:
            "“There would have been no other way for me to see all the angles of this relationship!”",
        },
        {
          id: "story-3-quote-alt",
          label:
            "“It allowed us to visit some important relationship aspects in a nice soft way to see what we need to work on.”",
        },
        {
          id: "story-3-support",
          label: "Answers can land partway in between. You may be closer than you think.",
        },
        { id: "prompts-title", label: "Questions to ask" },
        { id: "prompts-note", label: "You don't know until you ask." },
        { id: "prompts-name", label: "Relationship conversation starters" },
        { id: "prompt-1", label: "Are you on the same page as ______?" },
        { id: "prompt-2", label: "Are you In-Synch with ______?" },
        { id: "prompt-3", label: "Are you in Alignment with ______?" },
        { id: "prompt-4", label: "Where are your differences with ______?" },
        { id: "stories-action-body", label: "Choose a relationship to explore." },
        { id: "stories-action", label: "Pick a relationship" },
      ],
    },
    {
      id: "benefits",
      heading: "Why healthy relationships matter",
      body: "At home or at work, relationships shape how we live and work together.",
      items: [
        { id: "eyebrow-benefits", label: "Why it matters" },
        { id: "benefits-action", label: "Choose a relationship" },
        {
          id: "benefit-1",
          label: "Less risk of losing connection",
          body: "Misunderstandings can strain a partnership, customer relationship, or personal connection. Seeing a gap gives you something to address.",
        },
        {
          id: "benefit-2",
          label: "Stronger working relationships",
          body: "Clearer expectations can make it easier to collaborate, care for one another, and solve problems together.",
        },
        {
          id: "benefit-3",
          label: "Emotional well-being",
          body: "Supportive relationships can bring comfort, encouragement, and a sense of community.",
        },
        {
          id: "benefit-4",
          label: "Physical well-being",
          body: "Healthy social connections contribute to overall well-being.",
        },
        {
          id: "benefit-5",
          label: "Less stress and anxiety",
          body: "Support from colleagues or loved ones can help when life gets difficult.",
        },
        {
          id: "benefit-6",
          label: "Connection over time",
          body: "Strong social support gives people a place to learn, grow, and stay connected.",
        },
        {
          id: "benefit-7",
          label: "A sense of belonging",
          body: "Healthy relationships can ease isolation and help people feel part of a community.",
        },
        {
          id: "benefit-8",
          label: "More happiness",
          body: "Positive relationships are an important part of life satisfaction.",
        },
        {
          id: "benefit-9",
          label: "Stronger self-esteem",
          body: "Support from others can reinforce self-worth and confidence.",
        },
        {
          id: "benefit-10",
          label: "Support through hard times",
          body: "Having someone to lean on can make challenges easier to face.",
        },
        {
          id: "benefit-11",
          label: "Better communication",
          body: "Talking through expectations gives people practice expressing what matters to them.",
        },
        {
          id: "benefit-12",
          label: "A shared sense of purpose",
          body: "Working toward understanding can give a relationship clearer direction.",
        },
        {
          id: "benefits-callout",
          label:
            "Healthy relationships take effort, communication, and mutual respect—whether at work, in business, or in personal life.",
        },
      ],
    },
    {
      id: "final-cta",
      heading: "Reduce stress. Reduce surprises.",
      body: "Start by choosing one relationship to explore.",
      items: [{ id: "final-cta-action", label: "Choose a relationship" }],
    },
  ],
});
