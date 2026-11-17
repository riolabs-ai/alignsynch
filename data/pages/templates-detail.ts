/**
 * `/relationship-templates/[slug]` — one relationship template's public page (#794, ported to
 * bundle 02's composition by #1127).
 *
 * Every word the page prints lives here: the kicker and the breadcrumb's first row, the two
 * descriptor headings, the Aspects band's heading and its legend, the aside's four panels (start,
 * trial, How It Works), the closing band, and the link labels (start, example, back).
 * `lib/template-detail.ts` is the join and `components/templates/template-detail.tsx` the view, so
 * the component holds no string of its own — E23 attributes `components/templates/**` to this
 * fixture at budget 0 and the next literal written there is a red build.
 *
 * **The heading is a frame, not a sentence.** It reads `"{name}"` and the model fills it from
 * `data/relationship-types.ts`, because twenty-seven pages that each spelled their own title would
 * be twenty-seven places a rename hides. `{initiator}` / `{counterparty}` are the two named ends of
 * the relationship, `{count}` is the type's own Aspect count, and `{price}` / `{role}` are filled
 * by the model from `data/membership-plans.ts` (the plan that sells this template) and the record.
 *
 * The fixture carries no descriptor text: who a template is for, and who it is not for, is
 * authored with the type (`descriptor.whoItsFor` / `whoItsNotFor`) because the catalogue card, the
 * dashboard and this page must say the same thing. Only the two headings above those sentences are
 * copy.
 *
 * **The page no longer prints the plan *chip*.** It used to draw `Basic · $9.99/mo` in a one-line
 * action row; bundle 02 draws the trial instead — what starts free, what it costs after, and who
 * never pays — so the figure is the plan's month inside that panel and nowhere else.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templatesDetailPageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Relationship Template",
  heading: "{name}",
  items: [
    /** The two named ends, joined by the same frame the catalogue card uses. */
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    /** The header's second badge: the type's own Aspect count. */
    { id: "badge-aspects", label: "{count} Aspects" },
    /** The descriptor's two headings. The sentences under them belong to the record. */
    { id: "descriptor-for", label: "Who it is for" },
    { id: "descriptor-not-for", label: "Who it is not for" },
    /**
     * The page's one primary action — the create flow's stage 1 for this template. "Create
     * Relationship" is the artifact's own label and the label every other entry into the flow uses.
     */
    { id: "template-use", label: "Create Relationship" },
    /** Offered only where `demoAnswersFor()` holds a sheet for this type. */
    { id: "template-example", label: "See a worked example" },
    /** Back to the catalogue the reader arrived from. */
    { id: "template-back", label: "All Templates" },
    /** The breadcrumb's first row — the catalogue, one address up. */
    { id: "crumb-root", label: "Templates" },
    /** The Aspects band's legend strip: both ends of the scale, and what each party answers. */
    { id: "aspects-legend", label: "Each of you answers every Aspect:" },
    { id: "aspects-feel", label: "Feel · How It Is Now" },
    { id: "aspects-wish", label: "Wish · How You Want It" },
    { id: "aspects-scale-left", label: "1 · {left}" },
    { id: "aspects-scale-right", label: "5 · {right}" },
    /**
     * The aside's start panel. `{role}` is the Counterparty's own role word from the record
     * ("Sibling", "Report", …), so the panel addresses the person the reader is inviting rather
     * than a generic "them".
     */
    { id: "start-heading", label: "Start With Your {role}" },
    { id: "start-body", label: "You set it up and invite your {role}. They join for free." },
    { id: "start-note", label: "You create your account at Stage 4. No card needed." },
    /** The aside's trial panel — what starts free, what follows it, and who never pays. */
    { id: "trial-heading", label: "7-Day Free Trial" },
    { id: "trial-no-card", label: "No card needed to start" },
    { id: "trial-after", label: "{price} a month after, only with a card" },
    { id: "trial-invitee", label: "The person you invite is never charged" },
    /** The closing band, which repeats the one action rather than adding a second one. */
    { id: "closing-heading", label: "Ready when you are. Setup takes about 4 minutes." },
  ],
  sections: [
    {
      id: "aspects",
      heading: "The {count} Aspects both people answer",
      /**
       * The legend: what a 1–5 answer between two named ends means. It says neither end is the
       * right answer on purpose — the page is a conversation aid, not an instrument.
       */
      body: "Each Aspect is one question, answered by both people from 1 to 5. The two ends are named with the question, and a low answer is a position on the scale rather than a wrong one.",
    },
    {
      id: "how",
      heading: "How It Works",
      items: [
        {
          id: "setup",
          label: "Stage 1–5 · Set Up",
          body: "Name it, pick Settings and Aspects, invite them. About 4 minutes.",
        },
        {
          id: "align",
          label: "Stage 6 · Align",
          body: "You each answer privately, then see where you are In Synch and where there is a Gap.",
        },
        {
          id: "talk",
          label: "Talk",
          body: "Start with the Next Step: the widest Gap first.",
        },
      ],
    },
  ],
});
