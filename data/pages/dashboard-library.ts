/**
 * `/dashboard/library` — the member's own library (#542 phase 1).
 *
 * **What it is not.** `/assessment/templates` is the catalogue: the platform's templates plus the
 * account's, the picker you start a relationship from. `/dashboard/templates` is the authoring
 * screen: create, clone, edit, and the editor behind it. This route is the third question — *what
 * have I already got?* — and it answers it from one read (`lib/member/library.ts`): the templates
 * this member owns, plus the ones their relationships were actually built from, each with the
 * number of relationships using it.
 *
 * **The empty state names the action.** A new account has neither, and the honest sentence is
 * "nothing here yet — start with a template or write one", with the two links that do it. A
 * paragraph about the product's value would be marketing copy inside the dashboard, which #542
 * rules out: this reader has already bought it.
 *
 * **`owned` and `used` are two facts, not one.** A row can be the member's own template that no
 * relationship uses yet, or a template they adopted by starting a relationship from it. The badge
 * says which, because "mine" and "in use" are different reasons to see a row.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardLibraryPageCopy: PageCopy = zPageCopy.parse({
  heading: "Library",
  subtitle:
    "The templates you own and the ones your relationships are built from — what you can start the next one with.",
  sections: [
    {
      id: "rows",
      items: [
        { id: "aspects", label: "{count} Aspects" },
        { id: "relationships", label: "Used in {count} relationships" },
        // Singular, because a count of one is the common case for a new library and "1
        // relationships" is the kind of sentence that makes a screen look unfinished.
        { id: "relationship-one", label: "Used in {count} relationship" },
        { id: "unused", label: "Not used yet" },
        { id: "owned", label: "Yours" },
        { id: "adopted", label: "From the catalogue" },
        { id: "open", label: "Open" },
        { id: "open-owned", label: "Edit" },
      ],
    },
    {
      id: "empty",
      heading: "Nothing in your library yet",
      body: "A template is here once you write one, or once a relationship is built from one. Either move puts it in this list.",
      cta: { label: "Start with a template", href: "/dashboard/templates" },
      secondaryCta: { label: "Browse the catalogue", href: "/assessment/templates" },
    },
    {
      id: "unreadable",
      heading: "The library could not be read",
      body: "The database did not answer: {reason}. Nothing is lost — reload the page once the connection is back.",
    },
    {
      id: "my-templates",
      heading: "My templates",
      body: "Write a template, clone one from the catalogue, and edit the ones you own.",
      cta: { label: "My templates", href: "/dashboard/templates" },
    },
    {
      id: "my-relationships",
      heading: "My relationships",
      body: "The relationships themselves — who is in each one, what stage it is at, and the Gap once both sides have answered.",
      cta: { label: "My relationships", href: "/assessment/instances" },
    },
  ],
});
