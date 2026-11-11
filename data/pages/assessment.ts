/**
 * `/assessment` — the template list and the create form (#146).
 *
 * The route's surface is `app/(mainlayout)/assessment/page.tsx` plus
 * `components/assessment-flow/**`; the words are here so the components hold none (E23).
 *
 * The email copy is not here: since #548 every message the product sends is a template in
 * `lib/email/templates/`, rendered through the band (`lib/email/band.ts`) so the plain text is
 * composed first and the HTML derived from it. The `invitation-email` band this file used to
 * carry moved to `invitation.ts` with the rest of the set.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentPageCopy: PageCopy = zPageCopy.parse({
  heading: "Assessments",
  subtitle:
    "Pick a template and name the person you want to answer with. They answer from one link, blind until you have both submitted.",
  sections: [
    {
      id: "create",
      heading: "Start a relationship",
      body: "You answer first. They see none of it until they have answered too — and you see none of theirs.",
      cta: {
        // The authoring form (#255). A `cta` and not a bare href in the view: the path is then
        // resolved against `content/routes.ts` by E23, so a moved form is a red build and not a 404.
        label: "Write your own template",
        href: "/assessment/templates/new",
      },
      items: [
        { id: "mode-label", label: "Which mode?" },
        { id: "mode-basic", label: "Basic Mode — Feel and Wish" },
        { id: "mode-advanced", label: "Advanced Mode — Feel, Wish, Think and Guess" },
        {
          id: "mode-help",
          label:
            "The mode is chosen now and fixed for this relationship: both of you answer the same sheet, and it cannot be switched later.",
        },
        { id: "initiator-name", label: "Your name" },
        { id: "initiator-placeholder", label: "Avery" },
        { id: "counterparty-name", label: "Their name" },
        { id: "counterparty-placeholder", label: "Rowan" },
        { id: "email", label: "Their email" },
        { id: "email-placeholder", label: "rowan@example.com" },
        { id: "submit", label: "Create and invite" },
      ],
    },
    {
      id: "templates",
      heading: "Published templates",
      body: "A relationship copies the template's Aspects when it is created. Editing a template later never touches a session someone has answered.",
    },
    {
      /**
       * The catalogue card (#409), the same one `/assessment/templates` draws. The picker needs
       * two words of its own only because its card carries the create form: the link out, and the
       * type/realm the template's summary names.
       */
      id: "card",
      items: [
        { id: "view-details", label: "View details" },
        { id: "aspects", label: "{count} Aspects" },
        { id: "type", label: "Relationship Type" },
        { id: "realm", label: "Realm" },
        { id: "unnamed-type", label: "No relationship type" },
        { id: "unnamed-realm", label: "Not stated" },
        { id: "roles", label: "{initiator} / {counterparty}" },
        /**
         * The same four words `/assessment/templates` draws, in this surface's own voice: the
         * price is the plan's (`CATALOGUE_PRICE_CENTS`), the primary action is the create screen
         * this page links to, and the exemplar link appears only where a finished sheet exists.
         */
        { id: "price-label", label: "Included in" },
        { id: "price", label: "{plan} · {price}/mo" },
        { id: "use", label: "Use this template" },
        { id: "see-example", label: "See a finished example" },
      ],
    },
    {
      /** The seven realm groups, and the one for templates that name no type (#409). */
      id: "groups",
      heading: "By realm",
      items: [{ id: "other", label: "No realm" }],
    },
    {
      id: "empty",
      heading: "No published template",
      body: "A template has to be published before a relationship can be created from it.",
    },
    {
      // The notice a save draws here (#255). `{title}` is the template that was just saved, filled
      // by `fillLabel()` from the list the page already read — the redirect carries the record's id
      // and never the words somebody typed.
      id: "created",
      heading: "Template saved",
      body: "“{title}” is published. It is in the list below, and you can start a relationship from it now.",
    },
  ],
});
