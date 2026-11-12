/**
 * `/templates/[slug]` — one relationship template's public page.
 *
 * Every word the page prints lives here: the hero's heading frame, the two descriptor headings,
 * the Aspects band's heading and its legend, the price line, and the three link labels (start,
 * example, back). `lib/template-detail.ts` is the join and
 * `components/templates/template-detail.tsx` the view, so the component holds no string of its
 * own — E23 attributes `components/templates/**` to this fixture at budget 0 and the next literal
 * written there is a red build.
 *
 * **The heading is a frame, not a sentence.** It reads `"{name}"` and the model fills it from
 * `data/relationship-types.ts`, because twenty-seven pages that each spelled their own title
 * would be twenty-seven places a rename hides. `{initiator}` / `{counterparty}` are the two named
 * ends of the relationship, and `{plan}` / `{price}` are the plan's name and monthly figure from
 * `data/billing-plans.ts` — never a typed figure, and never a per-relationship charge (#798).
 *
 * The fixture carries no descriptor text: who a template is for, and who it is not for, is
 * authored with the type (`descriptor.whoItsFor` / `whoItsNotFor`) because the catalogue card,
 * the dashboard and this page must say the same thing. Only the two headings above those
 * sentences are copy.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templatesDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "{name}",
  items: [
    /** The two named ends, joined by the same frame the catalogue card uses. */
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    /** The descriptor's two headings. The sentences under them belong to the record. */
    { id: "descriptor-for", label: "Who it is for" },
    { id: "descriptor-not-for", label: "Who it is not for" },
    /**
     * The plan that includes this template, and its interval — `{plan}` and `{price}` are filled
     * from `data/billing-plans.ts` by `cataloguePriceNote()`. Never a per-relationship charge: the
     * shop does not sell one, and this row and the catalogue card's are the same string (#798).
     */
    { id: "template-price", label: "{plan} · {price}/mo" },
    /** The page's one primary action — the account that buys the relationship. */
    { id: "template-use", label: "Start with this template" },
    /** Offered only where `demoAnswersFor()` holds a sheet for this type. */
    { id: "template-example", label: "See a worked example" },
    /** Back to the directory the reader arrived from. */
    { id: "template-back", label: "All relationship templates" },
  ],
  sections: [
    {
      id: "aspects",
      heading: "The Aspects both people answer",
      /**
       * The legend: what a 1–5 answer between two named ends means. It says neither end is the
       * right answer on purpose — the page is a conversation aid, not an instrument.
       */
      body: "Each Aspect is one question, answered by both people from 1 to 5. The two ends are named with the question, and a low answer is a position on the scale rather than a wrong one.",
    },
  ],
});
