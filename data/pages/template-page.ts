/**
 * `/templates/relationship/[slug]` — **the in-app template page** (bundle 06,
 * `relationship-template.html`, #1259).
 *
 * A signed-in member arrives here from the Library card's **View Details**, so this is a *member*
 * surface, not a marketing one: it renders inside the shell, and its one primary action is the
 * create flow's stage 1. It is not a second copy of `/relationship-templates/[slug]` — that page
 * sells a *type* to a stranger (kicker `Relationship Template`, "All Templates" back to the
 * catalogue), and this one answers "what will I be asked, and what does it cost me" for a person
 * who is already in the product.
 *
 * The page prints the record's own words (title, summary, its Aspects and their two named ends)
 * and the type's own descriptor, so the only copy here is the **frame**: the kicker, the four
 * chips' wording, the two descriptor headings, the Aspects band's legend, the aside's three
 * panels, the closing band and the sentences the two empty/refusal states need.
 *
 *   eyebrow       `Library Template`
 *   heading       `{title}` — the record's, filled by `lib/member/template-page.ts`
 *   chips         `{count} Aspects` · `About {count} Minutes` · `{count} People`
 *   actions       `Create Relationship` · `Save to My Templates`
 *   descriptor    the two headings over the type's authored sentences
 *   aspects       the band's heading, body, legend strip and the two scale-end frames
 *   aspects-empty a template that carries no Aspects
 *   start/trial/how  the sticky aside's three panels
 *   closing       the band where the reader finishes
 *   unreadable    the database did not answer
 *   refusals      what `Save to My Templates` says when the copy is refused
 *
 * **`{placeholders}` are filled by `fillLabel`** and every `{count}` is counted from the row the
 * read returned, never typed here. `{price}` is the plan's month from `data/billing-plans.ts` and
 * `{role}` is the Counterparty's own role word from `data/relationship-types.ts`.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templatePageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Library Template",
  /** A frame, not a sentence: the name belongs to the record. */
  heading: "{title}",
  items: [
    /** The three chips under the name, in bundle 06's order. The shelf's category chip is read
     * from `data/pages/dashboard-templates.ts` — one vocabulary for the shelf and the page. */
    { id: "aspects", label: "{count} Aspects" },
    { id: "minutes", label: "About {count} Minutes" },
    /** A relationship is between two people; the count is the product's, not the row's. */
    { id: "people", label: "{count} People" },
    /** The owner's button labels, verbatim, and the same pair the Library card carries. */
    { id: "create", label: "Create Relationship" },
    { id: "save", label: "Save to My Templates" },
    /** The two headings over the type's authored `descriptor` sentences. */
    { id: "for-heading", label: "Who It’s For" },
    { id: "not-for-heading", label: "Not For" },
    /** The scale ends, framed here and filled from each Aspect's own two values. */
    { id: "scale-left", label: "1 · {left}" },
    { id: "scale-right", label: "5 · {right}" },
    /** Back to the shelf this page was opened from. */
    { id: "back", label: "Back to Templates" },
  ],
  sections: [
    {
      id: "aspects",
      heading: "The {count} Aspects",
      body: "Every Aspect uses the same 1–5 scale. You can turn any off or reword it when you create.",
      items: [
        { id: "legend", label: "Each of you answers every Aspect:" },
        { id: "feel", label: "Feel · How It Is Now" },
        { id: "wish", label: "Wish · How You Want It" },
        { id: "advanced", label: "Advanced Mode adds Think and Guess." },
      ],
    },
    /**
     * A template with no Aspects is a real row — a private copy somebody saved and has not filled
     * in yet — and it is the one thing the band cannot draw as a list. It says why it is empty and
     * where the fix is, instead of leaving a border with nothing inside it.
     */
    {
      id: "aspects-empty",
      heading: "No Aspects Yet",
      body: "This template carries no Aspects, so there is nothing for either person to answer. Open it in My Templates to add one, or start from a template in the Library.",
    },
    {
      id: "start",
      items: [
        { id: "heading", label: "Start With Your {role}" },
        { id: "body", label: "You set it up and invite your {role}. They join for free." },
        /** Used where the template names no relationship type, so there is no role word to print. */
        { id: "heading-generic", label: "Start This Relationship" },
        {
          id: "body-generic",
          label: "You set it up and invite the other person. They join for free.",
        },
      ],
    },
    {
      id: "trial",
      heading: "7-Day Free Trial",
      items: [
        { id: "no-card", label: "No card needed to start" },
        { id: "after", label: "{price} a month after, only with a card" },
        { id: "invitee", label: "The person you invite is never charged" },
      ],
    },
    {
      id: "how",
      heading: "How It Works",
      items: [
        {
          id: "setup",
          value: "1–5",
          label: "Stage 1–5 · Set Up",
          body: "Name it, pick Settings and Aspects, invite them. About 4 minutes.",
        },
        {
          id: "align",
          value: "6",
          label: "Stage 6 · Align",
          body: "You each answer privately, then see where you’re In Synch and where there’s a Gap.",
        },
        {
          id: "talk",
          value: "→",
          label: "Talk",
          body: "Start with the Next Step: the widest Gap first.",
        },
      ],
    },
    { id: "closing", heading: "Ready when you are. Setup takes about 4 minutes." },
    {
      id: "unreadable",
      heading: "This Template Could Not Be Read",
      body: "The database did not answer. Nothing was changed.",
    },
    /**
     * `Save to My Templates` posts the shipped copy writer (`clonePublic`, the one the shelf's
     * kebab calls) and redirects to the shelf on success. A refusal comes back as `?problem=<code>`
     * and is drawn from here — a code this fixture has no sentence for draws no band, which is the
     * rule `lib/page-copy.ts::itemLabelOr` states.
     */
    {
      id: "refusals",
      items: [
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "not-yours", label: "That template belongs to another account." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
  ],
});
