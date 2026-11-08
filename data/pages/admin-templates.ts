/**
 * `/admin/templates` — the console's authored templates (#502a).
 *
 * The words an operator reads on the list, and the create band that starts a draft. The shape of
 * the fixture is the shape of the screen:
 *
 *   list        what the screen is, and what a template is (a record with Aspects and no parties)
 *   new-draft   the band that creates one: its fields, its button and its two notices
 *   columns     the table's headings, in the order the table draws them
 *   status      the three publication states a row can carry — a word each, never an adjective
 *   refusals    one sentence per code `lib/admin/templates.ts` and `lib/admin/act.ts` can answer
 *   empty       "there are no templates in this database yet", which is not the same fact as
 *               "the filters match nothing" (this screen has no filters, so only one is needed)
 *   unreadable  the database did not answer
 *
 * **A draft is shown, and it is not a published template.** The screen says which rows are
 * editable (`status.draft`) and which are read-only (`status.published`), because #502a authors
 * drafts only: publishing is versioned and is the next card. A row that has been played on is
 * read-only here, and the list says so beside the relationship count rather than letting an
 * operator discover it when a save is refused.
 *
 * **The create band asks for one Aspect, not a blank row.** `zAssessment` requires at least one
 * Aspect `superRefine`s and the schema's `items: z.array(zAspect).min(1)`, so a record with none is
 * not a template a fixture could hold — and the console may not accept what the model cannot.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminTemplatesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Templates",
  subtitle:
    "The assessment templates this database holds — the relationships' unit of value. Author a draft here; publishing is versioned and is the next step, so a template that has been played on is read-only on this screen.",
  items: [
    { id: "edit", label: "Open" },
    { id: "read-only", label: "Read-only" },
  ],
  sections: [
    {
      id: "list",
      heading: "The catalogue",
      body: "Every template record, drafts first. A template is a record with Aspects and no parties; a relationship is a template copied and given two parties. The count beside a row is how many relationships already copy it — a row with one is read-only until publishing is versioned.",
    },
    {
      id: "columns",
      items: [
        { id: "title", label: "Title" },
        { id: "slug", label: "Slug" },
        { id: "status", label: "State" },
        { id: "aspects", label: "Aspects" },
        { id: "relationships", label: "Relationships" },
        { id: "updated", label: "Dated" },
        { id: "open", label: "Open" },
      ],
    },
    {
      id: "status",
      items: [
        { id: "draft", label: "Draft" },
        { id: "published", label: "Published" },
        { id: "archived", label: "Archived" },
      ],
    },
    {
      id: "new-draft",
      heading: "Start a draft",
      body: "A title, a one-line summary and the first Aspect. Everything after that is the editor's; the save is refused unless the record is one the model would accept, and it is written to the audit log.",
      items: [
        { id: "title", label: "Title" },
        { id: "summary", label: "Summary" },
        { id: "prompt", label: "First Aspect" },
        { id: "left", label: "Left Value (notch 1)" },
        { id: "right", label: "Right Value (notch 5)" },
        { id: "submit", label: "Create the draft" },
        { id: "submitting", label: "Creating…" },
        { id: "created", label: "Draft created — {title} is ready to edit." },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "invalid-draft", label: "The model refused this template." },
        { id: "not-editable", label: "That template is published." },
        { id: "slug-taken", label: "Another template already uses that slug." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "role-too-low", label: "Your role may not author a template." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
    { id: "empty", heading: "No templates yet", body: "This database holds no template records." },
    {
      id: "unreadable",
      heading: "The templates could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
