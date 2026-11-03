/**
 * `/admin/templates/[id]` — one template, being drafted (#502a).
 *
 * The editor is `components/create/quiz-editor.tsx` bound to a template record: tabs over the
 * panels, one accordion row per Aspect, add/remove, and a preview that renders the record as a
 * party sees it. The fixture is the words for all of that:
 *
 *   record      who this is and what state it is in (editable or locked, and why)
 *   details     the record's own fields — title, summary, slug — and the catalogue facts this
 *               record does **not** own (realm, price, roles)
 *   aspects     the Aspect editor: its three fields, and the row controls
 *   preview     the party's sheet, rendered from the draft and never from a saved row
 *   save        the reason field, the button and the two notices
 *   refusals    one sentence per code, so a refusal is a sentence and never a driver diagnostic
 *   locked      the panel a published template draws instead of the editor
 *
 * **Realm and price are the catalogue's, and the screen says so.** A template record carries a
 * `slug`, and `data/relationship-types.ts` authors the type that slug names — its realm, its two
 * roles and its price. Those are drawn here, read-only: editing one is editing the taxonomy, which
 * is a fixture (a code change), not a record. A new slug shows "not in the catalogue" and no
 * price, because inventing either would be the second source of truth the model refuses.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminTemplateEditorPageCopy: PageCopy = zPageCopy.parse({
  heading: "Draft a template",
  subtitle:
    "Edit the record, its Aspects and its words. Every save carries a reason and lands in the audit log in the same transaction as the change. The preview draws the draft you are editing, not a saved row.",
  items: [
    { id: "editable", label: "Draft — editable" },
    { id: "locked", label: "Read-only" },
    { id: "tab-details", label: "The record" },
    { id: "tab-aspects", label: "Aspects" },
    { id: "tab-preview", label: "Preview" },
  ],
  sections: [
    {
      id: "details",
      heading: "The record",
      body: "Title and summary are what a person sees before they start; the slug is the template's identity and what the catalogue joins on.",
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
            "Realm and price belong to the relationship type this slug names; they are read from data/relationship-types.ts and are not fields on the record.",
        },
      ],
    },
    {
      id: "aspects",
      heading: "Aspects",
      body: "One Aspect is one question both parties answer, on the 1..5 band, with a Left Value at notch 1 and a Right Value at notch 5. An Aspect's id is stable: reword its prompt and relationships that already answered it still name the same row.",
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
      heading: "As a party sees it",
      body: "The answer sheet this template becomes, rendered from the draft in the tab beside this one. It is inert here: nothing on this panel is saved, and a party of a real relationship answers through the flow's own sheet.",
    },
    {
      id: "save",
      heading: "Save",
      body: "The reason is not optional — it is the audit row's own sentence, and a save without one is refused before anything is written.",
      items: [
        { id: "reason", label: "Reason" },
        { id: "submit", label: "Save the draft" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Saved. Audit action {actionId}." },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "invalid-draft", label: "The model refused this template." },
        { id: "not-editable", label: "That template is published." },
        { id: "slug-taken", label: "Another template already uses that slug." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "reason-too-short", label: "A reason of at least eight characters is required." },
        { id: "role-too-low", label: "Your role may not author a template." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
    {
      id: "locked",
      heading: "This template is published",
      body: "Editing it in place would rewrite the Aspects every relationship already copied, so the console refuses and this screen says why. Versioning — publish N+1 and leave N for the relationships that started on it — is the next card.",
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
