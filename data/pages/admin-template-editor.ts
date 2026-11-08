/**
 * `/admin/templates/[id]` — one template, being drafted and published (#502a, #502b).
 *
 * The editor is `components/create/quiz-editor.tsx` bound to a template record: tabs over the
 * panels, one accordion row per Aspect, add/remove, and a preview that renders the record as a
 * party sees it. The fixture is the words for all of that:
 *
 *   record      who this is and what state it is in (editable or read-only, and why)
 *   details     the record's own fields — title, summary, slug — and the catalogue facts this
 *               record does **not** own (realm, price, roles)
 *   aspects     the Aspect editor: its three fields, and the row controls
 *   preview     the party's sheet, rendered from the draft and never from a saved row
 *   save        the button and the two notices
 *   publish     the version band (#502b): the live state, the live version, publish, unpublish and
 *               their notices. Unpublishing is a status write — the versions it names stay
 *   refusals    one sentence per code, so a refusal is a sentence and never a driver diagnostic
 *   read-only   the panel an archived template draws instead of the editor
 *
 * **Realm and price are the catalogue's, and the screen says so.** A template record carries a
 * `slug`, and `data/relationship-types.ts` authors the type that slug names — its realm, its two
 * roles and its price. Those are drawn here, read-only: editing one is editing the taxonomy, which
 * is a fixture (a code change), not a record. A new slug shows "not in the catalogue" and no
 * price, because inventing either would be the second source of truth the model refuses.
 *
 * **A published template is editable again (#502b).** It stopped being editable in `502a` because an
 * in-place edit drifted every relationship that had copied it; now each relationship reads the
 * version it was created from, so an edit is a private draft until it is published as N+1. The words
 * below say that, because a form that silently changes what it does is worse than one that refuses.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminTemplateEditorPageCopy: PageCopy = zPageCopy.parse({
  heading: "Draft a template",
  subtitle:
    "Edit the record, its Aspects and its words. Every save lands in the audit log in the same transaction as the change. The preview draws the draft you are editing, not a saved row.",
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
      body: "A save lands in the audit log in the same transaction as the change. The sentence it carries is written for you — it names this template and the console — and no screen asks you to type one.",
      items: [
        { id: "submit", label: "Save the draft" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Saved. Audit action {actionId}." },
      ],
    },
    {
      /**
       * The band the member's screen draws (#533 phase 2) — and the console declares it because
       * **one editor draws both bands**: `components/admin/template-editor.tsx` reads `publish` or
       * `private` depending on its `band` prop, and E23 binds a component's asks to every copy its
       * budget row names. A console template is not publicly listed until a version is published,
       * so the same words are true here.
       */
      id: "private",
      heading: "Private until published",
      body: "A template is not offered in the catalogue until one of its versions is published. Until then it is visible only on this screen, and no relationship can be started from it.",
      items: [
        { id: "state-draft", label: "Not offered" },
        { id: "state-published", label: "Offered in the catalogue" },
        { id: "state-archived", label: "Archived" },
        { id: "live", label: "Live version {version}" },
        { id: "history", label: "Highest version {version} — not offered" },
        { id: "never", label: "Never published" },
        { id: "publish", label: "Publish a version" },
        { id: "unpublish", label: "Unpublish" },
        { id: "working", label: "Working…" },
        { id: "published", label: "Published version {version}. Audit action {actionId}." },
        { id: "unpublished", label: "Unpublished. Version {version} remains in the history." },
      ],
    },
    {
      id: "publish",
      heading: "Publish",
      body: "Publishing writes this template's stored words and Aspects as a new immutable version. Every relationship reads the version it was created from, so a live relationship keeps the questions it was asked even after this template changes. Unpublishing withdraws the template from the catalogue and keeps every version.",
      items: [
        { id: "state-draft", label: "Not offered" },
        { id: "state-published", label: "Offered in the catalogue" },
        { id: "state-archived", label: "Archived" },
        { id: "live", label: "Live version {version}" },
        { id: "history", label: "Highest version {version} — not offered" },
        { id: "never", label: "Never published" },
        { id: "publish", label: "Publish a version" },
        { id: "unpublish", label: "Unpublish" },
        { id: "working", label: "Working…" },
        { id: "published", label: "Published version {version}. Audit action {actionId}." },
        {
          id: "unpublished",
          label:
            "Unpublished. Version {version} and its history remain in the catalogue of records.",
        },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "invalid-draft", label: "The model refused this template." },
        { id: "not-editable", label: "That template is archived — unarchive it before editing." },
        {
          id: "not-published",
          label: "That template is not published, so there is nothing to withdraw.",
        },
        {
          id: "version-conflict",
          label: "Another publish took the next version. Reload and try again.",
        },
        { id: "slug-taken", label: "Another template already uses that slug." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "role-too-low", label: "Your role may not author a template." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
    {
      id: "locked",
      heading: "This template is archived",
      body: "An archived template is read-only here: unarchive it from the template library before editing it. Archiving is the member's action on a template they own, and it is not unpublishing — a published version is never deleted by either.",
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
