/**
 * `/dashboard` — the console's Overview (Console 2/5).
 *
 * Four numbers, each one a count of rows the viewer can open, each one a link to the list that
 * shows exactly those rows. The words are here because the ratchet (E23) counts them: a component
 * that writes "Waiting on the other party" is a second place the sentence can drift from the card
 * beside it.
 *
 * **The card labels are the filter names.** `awaiting-other`, `yours-to-answer` and `reports-open`
 * are the ids `lib/flow/overview.ts` filters `/assessment/instances` by, and `data/pages/
 * assessment-instances.ts` names the same three in its `filter` band. That is the one sentence
 * written twice in this fixture pair, and it is deliberate: each surface owns its own words (the
 * card is a label under a number, the list is a line above a list), while the *contract* — which
 * rows a number counts — is single-sourced in `lib/flow/overview.ts` and cannot drift.
 *
 * **No number is authored here.** There is no `value` on any item and no example figure in a body:
 * the page hands the component counts it derived from `listMyInstances()` and
 * `listPublishedTemplates()`, and `data/pages/dashboard.ts`'s ruling — "the honest page is
 * identity plus honest empty states: no invented balance, no invented quiz" — is the rule this
 * fixture follows for a console whose rows *do* exist.
 *
 * **`empty` is a band, not a zero.** A brand-new account has nothing waiting on it, and the honest
 * thing to draw is the sentence that says so plus the one action that changes it. The cards still
 * render (a zero that links to an empty list is true, and the reader can check it), and this band
 * is what turns three zeroes into an instruction.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

export const overviewPageCopy: PageCopy = zPageCopy.parse({
  heading: "Welcome back, {name}",
  subtitle: `What is waiting on you in ${brand.name}, counted from your own relationships.`,
  items: [{ id: "error-network", label: "Couldn't reach the server. Try again." }],
  sections: [
    {
      id: "counts",
      heading: "Waiting on you",
      body: "Every number is a count of your own relationships, and each one opens the list it counts. Nothing here counts anyone else's answers.",
      cta: { label: "See all your relationships", href: "/assessment/instances" },
      items: [
        { id: "awaiting-other", label: "Waiting on the other party" },
        {
          id: "awaiting-other-detail",
          label: "You are done on your side. The other party still has to answer.",
        },
        { id: "yours-to-answer", label: "Needs your answers" },
        {
          id: "yours-to-answer-detail",
          label: "You owe answers on these before the other party can see the Gap.",
        },
        { id: "reports-open", label: "Reports open" },
        {
          id: "reports-open-detail",
          label: "Both of you have answered, and you have not read the report yet.",
        },
        { id: "templates", label: "Templates available" },
        {
          id: "templates-detail",
          label: "Published templates you can start a relationship from.",
        },
        { id: "unread", label: "not read yet" },
      ],
    },
    {
      id: "empty",
      heading: "You have no relationships yet",
      body: "A relationship starts when you pick a template and invite someone to answer it. You will both answer the same Aspects without seeing each other's answers, and the Gap opens when you have both submitted.",
      cta: { label: "Start a relationship", href: "/assessment" },
    },
    {
      id: "unreadable",
      heading: "Your console could not be read",
      body: "These are counts of rows in the database, and this visit did not get an answer. Nothing here came from a cache, and no number was guessed or reused.",
      items: [{ id: "reload", label: "Try again" }],
    },
  ],
});
