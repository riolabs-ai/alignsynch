/**
 * `/dashboard/templates` — the member's own templates (#533 phase 2).
 *
 * The screen is a list of the templates this account wrote, and the two ways to start one: **clone
 * a public template** from the admin-curated catalogue, or **start blank** with a title and the
 * first Aspect. Both write a row this account owns and only this account reads — `visibility =
 * 'private'`, `status = 'draft'` — which is why nothing here offers to publish one. Public listing
 * is the console's decision (#533: "public listing stays admin-curated"), and the words say so
 * instead of drawing a button that would refuse.
 *
 *   list       what this screen is, and what a template is
 *   new        the blank-start form: a title, a summary, the first Aspect, and the reason
 *   clone      the other way in: copy a public template, no typing required
 *   refusals   one sentence per code the actions can answer with
 *   empty      no templates yet — a different fact from "the read failed"
 *   unreadable the database did not answer
 *
 * **Why "blank" asks for one Aspect.** `zAssessment` requires at least one `item`, so a record with
 * none is not a template any fixture could hold and no relationship could copy. The form asks for
 * the first one — a prompt and its two poles — and everything after that is the editor's. A blank
 * form that saved a row the model refuses would be a create button that always fails.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardTemplatesPageCopy: PageCopy = zPageCopy.parse({
  heading: "My templates",
  subtitle:
    "The templates you wrote, and the two ways to start one. A template here is yours alone: it is never listed publicly, and a relationship you start from it copies its Aspects so you can tune them before anyone is invited.",
  items: [
    { id: "aspects", label: "{count} Aspects" },
    { id: "relationships", label: "{count} relationships" },
    { id: "open", label: "Open" },
    { id: "none", label: "—" },
    { id: "draft", label: "Draft" },
  ],
  sections: [
    {
      id: "list",
      heading: "Your templates",
      body: "Every template you own, newest first. Opening one edits its words and its Aspects; starting a relationship from one copies its Aspects into that relationship, so editing here never changes a relationship you have already configured.",
    },
    {
      id: "new",
      heading: "Start blank",
      body: "A title, a summary and the first Aspect. A template needs at least one Aspect — it is what both people answer — so this is the one field the model will not let you leave empty. The save lands in the audit log in the same transaction, with a sentence written for you.",
      items: [
        { id: "title", label: "Title" },
        { id: "summary", label: "Summary" },
        { id: "prompt", label: "First Aspect" },
        { id: "left", label: "Left Value (1)" },
        { id: "right", label: "Right Value (5)" },
        { id: "submit", label: "Create the template" },
        { id: "submitting", label: "Creating…" },
        { id: "created", label: "{title} is ready to open." },
        { id: "open-created", label: "Open it" },
      ],
    },
    {
      id: "clone",
      heading: "Clone a public template",
      body: "The public templates are curated by the operators of this site. Cloning one copies its words and its Aspects into a template you own; the copy is private to you and the original does not change.",
      items: [
        { id: "choose", label: "Choose a template" },
        { id: "submit", label: "Clone it" },
        { id: "cloning", label: "Cloning…" },
        { id: "cloned", label: "{title} is now yours." },
        { id: "none", label: "There are no public templates to clone yet." },
      ],
    },
    {
      id: "empty",
      heading: "No templates yet",
      body: "Start one below — blank, or cloned from the public catalogue. A relationship starts from a template, so this is where the work begins.",
    },
    {
      id: "refusals",
      items: [
        { id: "invalid-draft", label: "The model refused that template — check the fields." },
        { id: "slug-taken", label: "That name is already in use. Try another title." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "not-yours", label: "That template belongs to another account." },
        { id: "not-editable", label: "That template is archived — it cannot be edited." },
        { id: "not-publishable", label: "Your role may not start a relationship." },
        { id: "trial-already-running", label: "A trial is already running on this account." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
    {
      id: "unreadable",
      heading: "Your templates could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
