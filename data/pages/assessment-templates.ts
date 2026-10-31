/**
 * `/assessment/templates` — the template library (#console 5/5).
 *
 * The screen answers one question: **which templates may this account use, and which of them did
 * it write?** The data side is `record.author_user_id` — `NULL` for a built-in, the author's id
 * for a template a person wrote — and the three tabs are that one column read three ways.
 *
 * The bands, and why each is a band rather than a sentence in a component (E23 counts every
 * literal in `components/assessment-flow/**`, and this route's budget is 0):
 *
 *   `list`      the heading and the one paragraph that explains what a row counts.
 *   `tabs`      All / Mine / Built-in. Three labels, because the tab row is the screen's thesis.
 *   `status`    Any status / Published / Archived — `record.status`, which archiving flips.
 *   `search`    the field's label, its placeholder, the button and the clear link.
 *   `row`       everything a row says: authorship, status, the three counts, and the four actions.
 *   `legacy`    the sentence about a template written before authors were recorded. It is not
 *               decoration: a person who wrote one last month will look under "Mine" and not find
 *               it, and the honest answer is on the page rather than in a support article.
 *   `empty`     no template at all — a database with no built-ins and no authored row.
 *   `no-match`  there are templates; this tab, status or search excludes them all.
 *   `notice`    what a save, an archive, an unarchive or a duplicate leaves behind, by title.
 *   `unavailable` the database did not answer — a panel, not Next's 500.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templateLibraryPageCopy: PageCopy = zPageCopy.parse({
  heading: "Your templates",
  subtitle:
    "The templates this account can use: the platform's own, and the ones you wrote. Open one to see its Aspects, copy it, or archive it when you no longer want it in the list.",
  sections: [
    {
      id: "list",
      heading: "Every template you can use",
      body: "A row counts the Aspects it asks and the instances made from it. Archiving a template hides it from the catalogue and stops new instances; the instances already made from it keep working.",
    },
    {
      id: "tabs",
      heading: "Which templates",
      items: [
        { id: "all", label: "All templates" },
        { id: "mine", label: "Mine" },
        { id: "built-in", label: "Built-in" },
      ],
    },
    {
      id: "status",
      heading: "Status",
      items: [
        { id: "all", label: "Any status" },
        { id: "published", label: "Published" },
        { id: "archived", label: "Archived" },
      ],
    },
    {
      id: "search",
      heading: "Find one",
      items: [
        { id: "label", label: "Search by title" },
        { id: "placeholder", label: "Parent & Child" },
        { id: "submit", label: "Search" },
        { id: "clear", label: "Clear" },
      ],
    },
    {
      id: "columns",
      heading: "Templates",
      items: [
        { id: "title", label: "Template" },
        { id: "aspects", label: "Aspects" },
        { id: "instances", label: "Instances" },
        { id: "authorship", label: "Who wrote it" },
        { id: "status", label: "Status" },
        { id: "created", label: "Created" },
        { id: "actions", label: "Actions" },
      ],
    },
    {
      id: "row",
      items: [
        { id: "authorship-mine", label: "Yours" },
        { id: "authorship-built-in", label: "Built-in" },
        { id: "status-published", label: "Published" },
        { id: "status-archived", label: "Archived" },
        { id: "aspects", label: "{count} Aspects" },
        { id: "instances", label: "{count} instances" },
        { id: "created", label: "Created {date}" },
        { id: "open", label: "Open" },
        { id: "duplicate", label: "Duplicate" },
        { id: "archive", label: "Archive" },
        { id: "unarchive", label: "Unarchive" },
      ],
    },
    {
      id: "create",
      heading: "Write one",
      body: "A template is a title and up to eight Aspects, each with a Left and a Right Value. Instances copy those Aspects when they are created, so editing later never reaches an answer somebody already gave.",
      cta: { label: "Write a template", href: "/assessment/templates/new" },
    },
    {
      id: "legacy",
      heading: "Templates with no author",
      body: "A template written before the app recorded authors has no author on its row. It is listed as Built-in, because that is the only fact the database holds about it — it is not lost, and it still opens and runs.",
    },
    {
      id: "empty",
      heading: "No template yet",
      body: "This account can use no template: nothing built in, and nothing written. Write one to have something to start an instance from.",
      cta: { label: "Write a template", href: "/assessment/templates/new" },
    },
    {
      id: "no-match",
      heading: "Nothing matches",
      body: "There are templates, but not under this tab, status and search together. Clear the search or pick another tab.",
    },
    {
      id: "notice",
      items: [
        {
          id: "archived",
          label: "“{title}” is archived. Instances already made from it are unaffected.",
        },
        { id: "unarchived", label: "“{title}” is published again, and can start new instances." },
        { id: "duplicated", label: "“{title}” was copied into your templates." },
        { id: "refused", label: "That template could not be changed from this account." },
        { id: "missing", label: "There is no such template here." },
      ],
    },
    {
      id: "unavailable",
      heading: "The templates could not be read",
      body: "The database did not answer. Nothing is lost; this page just could not read the rows it draws.",
      items: [{ id: "reload", label: "Read the list again" }],
    },
  ],
});
