/**
 * `/dashboard/templates/[id]` — one of the member's own templates, being edited (#533 phase 2).
 *
 * The screen is `components/admin/template-editor.tsx` in its `band: "private"` variation: the same
 * tabs, the same per-Aspect accordion, the same save band and the same preview of the party's
 * answer sheet. What changes is the band underneath — a member's template is **private**, so there
 * is no catalogue to publish it to (public listing is admin-curated) and the band says that in words
 * rather than offering a button that would refuse.
 *
 *   record      who this is and what state it is in
 *   details     the record's own fields — title, summary, slug, and the catalogue facts it does not
 *               own (realm, price), shown read-only
 *   aspects     the Aspect editor: its three fields and the row controls
 *   preview     the party's sheet, rendered from the draft and never from a saved row
 *   save        the reason field, the button and the two notices
 *   private     the band that replaces the console's publish controls
 *   refusals    one sentence per code the save can answer with
 *   locked      the panel an archived template draws instead of the editor
 *   problems    `zAssessment`'s own findings, field by field
 *   unreadable  the database did not answer
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardTemplateEditorPageCopy: PageCopy = zPageCopy.parse({
  heading: "Your template",
  subtitle:
    "Edit the words and the Aspects. Every save carries a reason and lands in the audit log in the same transaction as the change. The preview draws the draft you are editing, not a saved row.",
  items: [
    { id: "editable", label: "Editable" },
    { id: "locked", label: "Read-only" },
    { id: "tab-details", label: "The record" },
    { id: "tab-aspects", label: "Aspects" },
    { id: "tab-preview", label: "Preview" },
  ],
  sections: [
    {
      id: "details",
      heading: "The record",
      body: "Title and summary are what the other person sees before they start. The slug is the template's identity; it is derived from the title when you create one and kept stable so nothing that already names this row breaks.",
      items: [
        { id: "title", label: "Title" },
        { id: "summary", label: "Summary" },
        { id: "slug", label: "Slug" },
        { id: "type", label: "Type" },
        { id: "assessment", label: "Assessment" },
        { id: "realm", label: "Realm" },
        { id: "price", label: "Price" },
        { id: "not-in-catalogue", label: "Not in the catalogue" },
        {
          id: "catalogue-note",
          label:
            "Realm and price belong to the relationship type this slug names, when it names one. They are read from the catalogue and are not fields on your template.",
        },
      ],
    },
    {
      id: "aspects",
      heading: "Aspects",
      body: "One Aspect is one question you will both answer, on the 1..5 band, with a Left Value at notch 1 and a Right Value at notch 5. An Aspect's id is stable: reword its prompt and a relationship that already copied it still names the same row.",
      items: [
        { id: "prompt", label: "What is asked" },
        { id: "left", label: "Left Value (1)" },
        { id: "right", label: "Right Value (5)" },
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove" },
        { id: "up", label: "Move up" },
        { id: "down", label: "Move down" },
        { id: "new-aspect", label: "New Aspect" },
      ],
    },
    {
      id: "preview",
      heading: "As the other person sees it",
      body: "The answer sheet this template becomes, rendered from the draft in the tab beside this one. It is inert here: nothing on this panel is saved, and a real relationship answers through the flow's own sheet.",
    },
    {
      id: "save",
      heading: "Save",
      body: "The reason is not optional — it is the audit row's own sentence, and a save without one is refused before anything is written.",
      items: [
        { id: "reason", label: "Reason" },
        { id: "submit", label: "Save the template" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Saved. Audit action {actionId}." },
      ],
    },
    {
      id: "private",
      heading: "Private to you",
      body: "This template is yours and only yours: it is not offered in the public catalogue, and deciding what the catalogue shows is an operator's decision, not a switch on this screen. A relationship you start from it copies these Aspects into its own record, so you can tune them there without changing this template or any other relationship.",
    },
    {
      /**
       * The console's band, declared here because the editor is shared (#533 phase 2).
       *
       * `band="private"` means this section is never rendered on a member's screen — but E23 binds
       * a component's copy asks to every fixture its budget row names, and that rule is what stops
       * a shared component from being handed a copy it would render blank. So the section states
       * the same facts in the member's own voice: what a published version means, and that the
       * decision is not theirs.
       */
      id: "publish",
      heading: "The catalogue is not yours to publish to",
      body: "Public listing is the console's decision, so there is no publish control on your screens. If this template ever reaches the catalogue, it is because an operator published one of its versions — and the version a relationship started from stays the one it was configured with, whatever happens to the template afterwards.",
      items: [
        { id: "state-draft", label: "Not offered" },
        { id: "state-published", label: "Offered in the catalogue" },
        { id: "state-archived", label: "Archived" },
        { id: "live", label: "Live version {version}" },
        { id: "history", label: "Highest version {version} — not offered" },
        { id: "never", label: "Never published" },
        { id: "reason", label: "Why" },
        { id: "publish", label: "Publish a version" },
        { id: "unpublish", label: "Withdraw it" },
        { id: "working", label: "Working…" },
        { id: "published", label: "Published version {version}." },
        { id: "unpublished", label: "Withdrawn. Version {version} remains in the history." },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "invalid-draft", label: "The model refused this template — check each field." },
        { id: "not-editable", label: "That template is archived — it cannot be edited." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "not-yours", label: "That template belongs to another account." },
        { id: "slug-taken", label: "Another template already uses that slug." },
        { id: "reason-too-short", label: "A reason of at least eight characters is required." },
        { id: "role-too-low", label: "Your role may not edit a template." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
    {
      id: "locked",
      heading: "This template is archived",
      body: "An archived template is read-only here. Nothing was changed.",
    },
    {
      id: "problems",
      heading: "The model's findings",
      body: "Each line names the field and the schema's own sentence. Fix the field and save again.",
    },
    {
      id: "unreadable",
      heading: "This template could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
