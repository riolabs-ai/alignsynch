/**
 * `/templates` — the public Relationship Templates **directory**.
 *
 * The nav's `Templates` row used to be an anchor into the front page's `#templates` band
 * (`/#templates`), so the one destination a visitor clicks expecting a catalogue landed on a
 * section of the home page. This is the page that anchor now means: a public product list, in
 * the marketing group, with no app shell and no session — the same chrome as `/pricing`.
 *
 * **The page is the list.** It carries a hero (the name, one sentence, one action) and the
 * catalogue, and nothing between them: the front page's band already argues what a template is,
 * and a directory that repeats the argument before showing the shelf makes a reader who came for
 * the shelf scroll past it. That is why there is no `intro`, `included` or `buy` section here —
 * those three bands were removed with the page's rewrite, and a copy row that no view renders is
 * a row a fixture is allowed to forget.
 *
 * **No number is typed.** The catalogue band's count sentence is
 * `"{types} templates across {realms} realms."` and `lib/templates-page.ts` fills it from
 * `data/relationship-types.ts` through the same `isPurchasable()` gate the shop reads, refusing
 * a heading that does not carry both placeholders. There is likewise no testimonial, no rating
 * and no "trusted by": the product has none of those records, and a page that prints one would
 * be printing a number no fixture can check.
 *
 * **The card labels are here so the cards can be drawn anywhere.** `template-use`,
 * `template-example`, `template-roles`, `aspects` and `template-price` are the five strings a
 * card repeats per row; `components/templates/template-card.tsx` prints them and writes none of
 * them (E23 holds both this route and `/` at 0 leaf literals). `data/pages/home-alignsynch.ts`
 * carries the same five ids for the home band, which is why the home shelf and this page cannot
 * call one action by two names.
 *
 * Both card actions are **public destinations**: `/register` creates the account that buys the
 * relationship, and `template-example` opens `/assessment/demo/<type>` only where the fixture
 * holds a worked example. A marketing page that linked `/templates/relationship/<id>/create`
 * would hand a signed-out visitor a sign-in wall, which is the defect this page exists to
 * remove.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templatesPageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "The catalogue",
  heading: "Relationship Templates",
  subtitle:
    "A template is one relationship's Aspects — the questions both people answer, each side blind to the other. Pick the template that names your relationship and both people answer it; the report turns the two sets of answers into the agenda for your next session.",
  cta: { label: "Start a relationship", href: "/register" },
  items: [
    /** The eyebrow over the catalogue. Page-level, so no band mistakes one for a card. */
    { id: "eyebrow-catalogue", label: "Every template" },
    /**
     * The five strings a catalogue card repeats. `{initiator}` and `{counterparty}` are the two
     * named ends of the relationship, `{count}` the Aspects the template asks, `{price}` the
     * fixture's integer cents through `formatCurrency` — never a typed figure.
     */
    { id: "template-use", label: "Start with this template" },
    { id: "template-example", label: "See a worked example" },
    { id: "template-roles", label: "{initiator} ↔ {counterparty}" },
    { id: "template-price", label: "{price} per relationship" },
    { id: "aspects", label: "{count} Aspects" },
    /**
     * The catalogue band's count, with both numbers filled from the taxonomy. A heading that
     * spells either one is refused by `templatesPage()`, for the reason the front page's scope
     * band gives: a typed count is a count nobody re-measures.
     */
    { id: "catalogue-count", label: "{types} templates across {realms} realms." },
  ],
  sections: [
    {
      id: "catalogue",
      heading: "Every template, by relationship.",
      body: "A template is only offered if the product can run it: each row is a published catalogue entry with its own Aspects and the two roles it names.",
    },
  ],
});
