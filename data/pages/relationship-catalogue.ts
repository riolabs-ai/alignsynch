/**
 * `/relationship-templates` — the public catalogue's copy, as bundle 02 draws it (#1127).
 *
 * The visual authority is
 * `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/relationship-templates.html`. Six bands,
 * in its order: the plan step banner (only when a plan was chosen on `/pricing`), the hero with its
 * three billing ticks and the live example card, the catalogue with its category filter and search,
 * How It Works in four steps, the five questions, and the graphite closing band.
 *
 * **One band of the bundle is deliberately absent: the testimonials.** The issue names them as
 * placeholders that must not ship (*"Testimonials are placeholder copy … real quotes or remove the
 * block"*, and the acceptance line's *"Placeholder testimonials and prices are either confirmed by
 * Jaden or not rendered in production"*). Removing the block is the answer that is true today; a
 * card can add the band back with real quotes in one edit.
 *
 * **What is words, and what is a record.** Realm names, template names, role pairs, Aspect counts
 * and the example's ordinals come from `data/relationship-types.ts` through
 * `lib/relationship-catalogue.ts`; a `{plan}` price comes from `data/billing-plans.ts` through
 * `cataloguePriceNote()`. Nothing here is a figure.
 *
 * **Placeholders are load-bearing.** `lib/relationship-catalogue.ts` refuses a sentence that has
 * lost one: `{count}`, `{total}`, `{initiator}`, `{counterparty}`, `{name}`, `{plan}`.
 *
 * **The band handles are `lib/relationship-catalogue.ts`'s**, never this file's: `#catalog` and
 * `#how` are addresses the header, the CTA and the in-page links all agree on, so they are emitted
 * by one module. A bare `#anchor` is not expressible in `PageCopy` at all.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const relationshipCatalogueCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Relationship Templates",
  heading: "See Where You Agree. Talk About the Rest.",
  subtitle:
    "Pick a template, invite one person, and answer privately on the same 1–5 scale. AlignSynch shows where you're In Synch and where there's a Gap.",
  items: [
    /* The hero's three billing ticks — the promise the whole conversion path rests on. */
    { id: "tick-trial", label: "7-day free trial" },
    { id: "tick-no-card", label: "No card needed" },
    { id: "tick-invitee-pays-nothing", label: "The person you invite never pays" },

    /* The hero's two actions. */
    { id: "hero-browse", label: "Browse Templates" },
    { id: "hero-popular", label: "Start With the Most Popular" },

    /* The example card: a real Aspect, drawn on the locked scale, with its Gap and its Next Step. */
    { id: "example-kicker", label: "Example · {name}" },
    { id: "example-scale", label: "Scale 1 {left} to 5 {right}" },
    { id: "example-initiator", label: "{name} wishes {value}" },
    { id: "example-counterparty", label: "{name} wishes {value}" },
    { id: "example-gap", label: "Gap" },
    { id: "example-next-step", label: "Next Step: talk about this one first." },

    /* The catalogue band's frame. */
    { id: "catalog-heading", label: "Choose a Template" },
    {
      id: "catalog-subtitle",
      label: "Each one is a short set of Aspects made for one kind of relationship.",
    },
    { id: "search-label", label: "Search Templates" },
    { id: "search-placeholder", label: "Search templates" },
    { id: "filter-all", label: "All" },
    { id: "filter-name", label: "Categories" },
    { id: "catalog-count", label: "{visible} of {total} templates" },
    { id: "empty-title", label: "Nothing Matches" },
    { id: "empty-body", label: "Try another filter or search." },
    { id: "empty-reset", label: "Show All" },

    /* The five strings a card repeats. `{initiator}` / `{counterparty}` are the two named ends. */
    { id: "template-use", label: "Create Relationship" },
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    { id: "aspects", label: "{count} Aspects" },
    { id: "template-price", label: "{plan} · {price}/mo" },

    /* The closing band. */
    { id: "closing-heading", label: "Start Your First Relationship" },
    { id: "closing-body", label: "7 days free. No card. Your invitee never pays." },
    { id: "closing-browse", label: "Browse Templates" },
    { id: "closing-pricing", label: "See Pricing" },

    /* The plan step banner — a reader who chose a plan on `/pricing` has one step left. */
    { id: "banner-step", label: "Step 1 of 2 · Pick a Template" },
    { id: "banner-body", label: "Your {plan} plan is saved for later. Nothing to pay today." },
    { id: "banner-change", label: "Change Plan" },
  ],
  sections: [
    /**
     * How It Works — the four steps a visitor takes, worded as the bundle words them. The heading
     * is the band's anchor target (`#how`), which the header row and the in-page links both name.
     */
    {
      id: "how",
      heading: "How It Works",
      body: "Four steps. Most people finish their first round in under 10 minutes.",
      items: [
        {
          id: "how-1",
          label: "Pick a Template",
          value: "Step 1",
          body: "Start from one made for siblings, partners, co-founders and more.",
        },
        {
          id: "how-2",
          label: "Invite One Person",
          value: "Step 2",
          body: "Set it up in about 4 minutes. Your trial starts when they accept. No card.",
        },
        {
          id: "how-3",
          label: "Answer Privately",
          value: "Step 3",
          body: "You each answer on the same 1–5 scale. Nobody sees answers until you both finish.",
        },
        {
          id: "how-4",
          label: "See Where You Agree",
          value: "Step 4",
          body: "In Synch, Small Gap or Gap for every Aspect, plus one Next Step.",
        },
      ],
    },
    /**
     * The five questions. Each item is a disclosure: `label` is the question, `body` the answer —
     * the same `<details>` shape the bundle draws, so the answers are in the HTML and a reader
     * without JavaScript can open them.
     */
    {
      id: "questions",
      heading: "Questions",
      items: [
        {
          id: "q-free",
          label: "Is it really free to start?",
          body: "Yes. Your 7-day free trial starts when the other person accepts. No card needed. Add a card only if you want to keep going.",
        },
        {
          id: "q-invitee-pays",
          label: "Does the person I invite pay?",
          body: "Never. The person who starts the relationship covers it. The person invited never sees a price.",
        },
        {
          id: "q-trial-ends",
          label: "What happens when the trial ends?",
          body: "If you haven't added a card, Stage 6 pauses. Everything is saved, and you get one free extra week if you need it.",
        },
        {
          id: "q-who-sees",
          label: "Who sees my answers?",
          body: "Nobody, until you both finish. Then you see each other's answers side by side.",
        },
        {
          id: "q-change-template",
          label: "Can I change a template?",
          body: "Yes. Turn Aspects off or reword them while you set up, or save your own copy.",
        },
      ],
    },
  ],
});
