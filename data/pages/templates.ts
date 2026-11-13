/**
 * `/relationship-types` — the public Templates catalogue's copy.
 *
 * The page is the approved redesign from `docs/specs/spec-as2-style-templates-redesign/` (#889):
 * a split hero with the framed photograph, a short "how AlignSynch works" band with one real
 * Aspect, **one** membership line, a sticky realm menu, the catalogue itself, and a compact
 * journey band. Every word those six surfaces print is here, because E23 attributes
 * `components/templates/**` and the page module to this fixture at a budget of **0**: a sentence
 * typed into a leaf component is a red build.
 *
 * **This file holds words, and handles.** Realm names, template names, role pairs, Aspect
 * counts, ordinals and every figure are records — they come from `data/relationship-types.ts`
 * through `lib/templates-page.ts` and are never typed here. So does `{plan}` / `{price}` on the
 * membership line: `cataloguePriceNote()` fills them from `data/billing-plans.ts`, which is the
 * only place a plan's name and figure are authored (#798 — a card and its page must not be a
 * second price model).
 *
 * **The page sells no template.** It sells the membership that includes all of them, once, above
 * the shelf — which is why no card prints a figure any more. The `template-price` row survives
 * only because the shared projection (`templateCard()`) reads it and because one test holds the
 * three surfaces to one wording; `components/templates/template-catalogue-card.tsx` never renders
 * `priceNote`. `data/pages/home-alignsynch.ts` keeps its own five card ids because the front
 * page's shelf is a different surface with a different job, and a surface owns its own wording.
 *
 * **Placeholders are load-bearing, and they are checked.** `lib/templates-page.ts` refuses this
 * fixture when a counted sentence loses one: `{types}`, `{realms}`, `{count}`, `{visible}`,
 * `{total}`, `{ordinal}`, `{plan}`, `{price}`, `{initiator}`, `{counterparty}`. That is the same
 * rule the old catalogue's counted sentence carried — a heading that spells "27" is a number
 * nobody re-measures — extended to the numbers this page now prints in four more places.
 *
 * **No anchor href is a fixture value.** `zPageCopyLink` refuses a bare fragment, and it is right
 * to: an in-page anchor is a handle the nav and the target must agree on, so `lib/templates-page.ts`
 * owns both (`CATALOGUE_ANCHOR`, `HOW_IT_WORKS_ANCHOR`) and this file owns only the words on them.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templatesPageCopy: PageCopy = zPageCopy.parse({
  /** The hero: the next decision, not the product name. */
  eyebrow: "My Relationship",
  heading: "Bring both perspectives into the conversation.",
  subtitle:
    "AlignSynch gives two people a private way to answer the same guided questions, see how their expectations line up, and choose what to discuss together.",
  items: [
    /** The hero's two actions. Their destinations are handles, not copy (see the module header). */
    { id: "hero-primary", label: "Browse templates" },
    { id: "hero-secondary", label: "How AlignSynch works" },
    /** `"27 templates"` — filled from the purchasable catalogue, never typed. */
    { id: "hero-stat-templates", label: "{types} templates" },
    /** `"7 relationship areas"` — filled from the realms that actually hold a card. */
    { id: "hero-stat-areas", label: "{realms} relationship areas" },
    /** The caption under the framed photograph. */
    {
      id: "hero-caption",
      label: "For the relationships that shape everyday life.",
      body: "At home, at work, and beyond.",
    },

    /**
     * The five strings a catalogue card repeats. `{initiator}` and `{counterparty}` are the two
     * named ends, `{count}` the Aspects the template asks — the same ids the front page's shelf
     * carries, worded for this surface's own action.
     */
    { id: "template-use", label: "Create Relationship" },
    { id: "template-details", label: "Details" },
    { id: "template-example", label: "Example" },
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    { id: "aspects", label: "{count} Aspects" },
    /**
     * The plan chip — declared here, but **not printed by this page**. `templateCard()` in
     * `lib/template-catalogue.ts` is the shared projection, and it fills `priceNote` from this row
     * for every surface that draws a card; the catalogue states membership once above the shelf
     * and no card carries a figure (`components/templates/template-catalogue-card.tsx`). The row
     * stays because the projection reads it and because
     * `tests/template-detail.test.ts` holds this label, the detail page's and the front page's to
     * one wording — a plan the shop describes three ways is the defect that test exists to stop.
     */
    { id: "template-price", label: "{plan} · {price}/mo" },

    /**
     * The catalogue's search. `search-label` is the accessible name (a placeholder is not a
     * label), `search-placeholder` is the visible hint, and the two result-count frames are the
     * `aria-live` region's text with and without a query.
     */
    { id: "search-label", label: "Search templates or roles" },
    { id: "search-placeholder", label: "Search templates or roles" },
    { id: "result-count", label: "{count} templates" },
    { id: "result-count-filtered", label: "{visible} of {total} templates" },
    { id: "empty-title", label: "No templates match." },
    { id: "empty-hint", label: "Try another relationship or role." },
    { id: "clear-search", label: "Clear search" },

    /** The realm menu's first row: every group at once. */
    { id: "realm-all", label: "All" },

    /* ------------------------------------------------------------------ *
     * The V2 catalogue (`/relationship-templates`, #905)
     *
     * A second page renders this fixture: the V2 re-cut of the catalogue, drawn from the patterns
     * `docs/specs/spec-design-page-rel-templates-v2/home/` already draws. Its words are its own
     * rows rather than edits to the rows above, so the #889 composition it replaces keeps the copy
     * it shipped with — one fixture, two surfaces, and neither one renames the other's sentences.
     * ------------------------------------------------------------------ */

    /** The V2 hero's kicker: the audience the catalogue leads with. */
    { id: "hero-eyebrow", label: "For business and corporate relationships" },
    /** The hero's promise line, under the two actions. */
    {
      id: "hero-note",
      label:
        "One relationship at a time. Two private views. A shared report when you are both ready.",
    },
    /** The hero's two doors, drawn as the package's pair of life cards. */
    { id: "life-business-kicker", label: "For work and corporate use" },
    { id: "life-business-title", label: "Business relationships" },
    { id: "life-business-action", label: "View templates" },
    { id: "life-business-name", label: "Explore business relationship templates" },
    { id: "life-personal-kicker", label: "Personal growth and relationship skills" },
    { id: "life-personal-title", label: "Personal relationships" },
    { id: "life-personal-action", label: "View templates" },
    { id: "life-personal-name", label: "Explore personal relationship templates" },

    /** The in-page menu: its accessible name and its three rows. */
    { id: "catalogue-nav-name", label: "On this page" },
    { id: "catalogue-nav-templates", label: "Templates" },
    { id: "catalogue-nav-how", label: "How it works" },
    { id: "catalogue-nav-included", label: "What's included" },
  ],
  sections: [
    /**
     * The explainer that follows the hero, carrying one **real** Staff–Manager Aspect. The
     * ordinal, the prompt and the two named ends are filled from `data/relationship-types.ts`;
     * only the frames are here.
     */
    {
      id: "how",
      heading: "A shared starting point for two perspectives.",
      body: "Each person answers the same Aspects privately. After both answer and accept, you can open a shared report and decide what to discuss next.",
      items: [
        { id: "how-eyebrow", label: "How AlignSynch works" },
        {
          id: "how-step-one",
          label: "Choose your relationship",
          body: "Start with a template that fits the two of you.",
        },
        {
          id: "how-step-two",
          label: "Answer privately",
          body: "Both people respond to the same guided prompts.",
        },
        {
          id: "how-step-three",
          label: "Review together",
          body: "See where expectations meet and what may need a conversation.",
        },
        /**
         * The fourth step, and the reason it exists: the V2 package draws the how-it-works band as
         * **four** numbered steps in one row across four columns, and a three-item list in that grid
         * is a row with a hole in it. The canon already carries this step — the shared report opens
         * once both people accept — so the band's rhythm and the product's rule agree.
         */
        {
          id: "how-step-four",
          label: "Accept, then read it together",
          body: "The shared report opens when you are both ready.",
        },
        { id: "how-more", label: "Learn more about AlignSynch" },
        /**
         * The how-it-works band's start-here strip and its one action. These three rows are the V2
         * catalogue's; the #889 composition reads `how-more` instead and never these.
         */
        { id: "how-start-eyebrow", label: "Start with work, or explore personal" },
        {
          id: "how-start-body",
          label:
            "Choose a business relationship template first, or browse options for personal growth, relationships, and friendship.",
        },
        { id: "how-action", label: "View templates" },
        /** The example panel: kicker, position, the scale's own name, and its foot. */
        { id: "example-kicker", label: "Inside a template" },
        { id: "example-position", label: "{name} · {ordinal} of {total}" },
        { id: "example-scale", label: "Five-point scale from {left} to {right}" },
        { id: "example-foot", label: "One prompt. Two private answers." },
      ],
    },

    /**
     * The one membership line. `membership-plan` carries `{plan}` and `{price}` and
     * `cataloguePriceNote()` fills both — the same helper the detail page's price line reads, so
     * the two surfaces cannot quote different figures.
     *
     * `membership-test-mode` is `/pricing`'s own sentence, repeated here rather than invented:
     * this band prints a monthly figure, and a page that prints a price without saying the
     * checkout is on test keys would imply a charge that has not happened.
     */
    {
      id: "membership",
      /**
       * The band's heading and body — the V2 catalogue's "what's included" band heads itself, and
       * the #889 composition reads only this section's items, so these two fields are invisible to
       * it. They restate only what the rows below already assert (all templates included, the
       * invited person pays nothing); no figure is typed here.
       */
      heading: "One membership covers both people.",
      body: "All templates are included. One person starts and invites the other person; the invited person pays nothing.",
      cta: { label: "See plans", href: "/pricing" },
      items: [
        { id: "membership-eyebrow", label: "What's included" },
        {
          id: "membership-note",
          label: "All templates are included",
          body: "One person starts and invites the other by link.",
        },
        { id: "membership-days", label: "7 days free", body: "to start one relationship" },
        {
          id: "membership-plan",
          label: "{plan} · {price}/mo",
          body: "unlimited active relationships",
        },
        {
          id: "membership-pair",
          label: "Two people, one membership",
          body: "the invited person pays nothing",
        },
        {
          id: "membership-test-mode",
          label: "Test mode: the card checkout runs on test keys, so no card is charged.",
        },
      ],
    },

    /** The catalogue band: what the shelf is, and the counted sentence above it. */
    {
      id: "catalogue",
      heading: "Choose a starting point.",
      items: [
        { id: "eyebrow-catalogue", label: "Relationship templates" },
        /** `"27 templates across 7 realms."` — filled from the taxonomy, never typed. */
        { id: "catalogue-count", label: "{types} templates across {realms} realms." },
      ],
    },

    /**
     * The journey, after the shelf: what happens once a template is chosen. Four facts, three
     * steps — and one rule the words must keep: the second person's answers are not visible
     * before both have accepted (`IMPLEMENTATION-PROMPT.md`, § Flow clarity and privacy).
     */
    {
      id: "journey",
      heading: "Three steps to the shared report.",
      body: "One person starts the relationship and holds the membership. The other joins from the link they are sent.",
      items: [
        {
          id: "journey-step-one",
          label: "Choose a template",
          body: "The relationship you want to work on.",
        },
        {
          id: "journey-step-two",
          label: "Invite the other person",
          body: "They join from the link. No second paid plan.",
        },
        {
          id: "journey-step-three",
          label: "Answer, then read it together",
          body: "Both answer privately. The report opens once both have accepted.",
        },
      ],
    },

    /**
     * The V2 catalogue's core band (`/relationship-templates`): the two published groups of
     * templates, head and frame. The group *names* and every type are records
     * (`data/relationship-types.ts` via `purchasableTypesByGroup()`); only the heading, the
     * sentence and the two group actions are words.
     *
     * Business leads, personal follows — the order the canon asks for and the order the drawn band
     * draws. `choose-action` and `choose-secondary` are the two jump links into the groups below
     * them, not routes: a reader deciding between work and home should not leave the page to
     * answer it.
     */
    {
      id: "choose",
      heading: "Choose a relationship to explore.",
      body: "Begin with a business relationship at work, or choose a personal relationship or friendship. Each template gives both people the same topics to consider.",
      items: [
        { id: "eyebrow-choose", label: "Relationship templates" },
        { id: "choose-action", label: "Business & corporate" },
        { id: "choose-secondary", label: "Personal & friendship" },
        { id: "templates-group-business", label: "Business & corporate relationships" },
        {
          id: "templates-group-personal",
          label: "Personal relationships, friendships, and adjacent contexts",
        },
        {
          id: "templates-note",
          label:
            "Templates give both people the same starting point for the relationship they want to explore.",
        },
        { id: "counselor-lead", label: "For counselors, therapists, and coaches:" },
        {
          id: "counselor-rest",
          label:
            "AlignSynch can be an optional structure for reflection alongside your existing support. It is not a clinical assessment, diagnosis, therapy, or a substitute for professional judgment.",
        },
      ],
    },

    /**
     * The closing band. One outcome, one supporting sentence, one action — the drawn band's shape.
     * The action is `/register`, because the creator signs up before the relationship exists
     * (`docs/specs/flow-stages.md`, stage 4).
     */
    {
      id: "final-cta",
      heading: "Start with the relationship in front of you.",
      body: "Choose a template, answer privately, and open the report when you are both ready.",
      cta: { label: "Create a relationship", href: "/register" },
    },
  ],
});
