/**
 * `/admin/email-templates` — the transactional-mail override console (#1138).
 *
 * **Every word the surface renders lives here**, which is why `/admin/email-templates` sits at
 * budget 0 in `data/pages/budget.ts`: the list, the editor's labels, the three state words, the
 * recipient words, the refusal sentences and the two panels are all this file. A literal written
 * into `components/admin/email-templates/**` is a red build.
 *
 * **Why the states are three words and not adjectives.** `default` / `draft` / `published` are
 * #1138's own vocabulary (requirement 5 and the list's "status (default / draft / published)"), and
 * an operator's question is "what is production sending" — which a synonym like "customised" would
 * answer worse. `draft` is drawn **beside** `published` when both exist, because a saved edit does
 * not stop the old words going out.
 *
 * **The refusal sentences are keyed by code**, one per value `lib/admin/email-templates.ts` and
 * `lib/admin/act.ts` can answer, so the screen looks up a sentence instead of composing one from an
 * error's text. The two variable refusals are worded to name the fix — the `{{name}}` or the word —
 * rather than repeating "refused".
 *
 * **No sample names here.** The preview's cast is `lib/email/samples.ts`'s (it is not product copy,
 * it is one set of values a form is tested with), so this file never repeats "Robin" or "Elena".
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminEmailTemplatesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Email Templates",
  subtitle:
    "The transactional mail this product sends, and the code default behind each one. An edit is saved as a draft; production mail changes only when you publish, and Reset to Default drops the override.",
  items: [{ id: "open", label: "Open" }],
  sections: [
    {
      id: "list",
      heading: "The register",
      body: "Every member-facing template the code carries, with what production is sending today. A template with no override is `default` — the words in this repository, not a row.",
    },
    {
      id: "columns",
      items: [
        { id: "template", label: "Template" },
        { id: "class", label: "Class" },
        { id: "recipient", label: "Recipient" },
        { id: "status", label: "Status" },
        { id: "edited", label: "Last edited" },
        { id: "open", label: "Open" },
      ],
    },
    {
      id: "status",
      items: [
        { id: "default", label: "Default" },
        { id: "draft", label: "Draft" },
        { id: "published", label: "Published" },
      ],
    },
    {
      id: "class",
      items: [
        { id: "transactional", label: "Transactional" },
        { id: "marketing", label: "Marketing" },
      ],
    },
    {
      id: "recipient",
      items: [
        { id: "counterparty", label: "Counterparty" },
        { id: "initiator", label: "Initiator" },
        { id: "both", label: "Either seat" },
        { id: "member", label: "Member" },
        { id: "subscriber", label: "Subscriber" },
      ],
    },
    {
      id: "fields",
      heading: "The override",
      body: "Subject, preheader and body. The body is plain text — a blank line separates paragraphs and a line starting with ## is a heading — and the band composes the HTML from it. The footer, the class and the unsubscribe line are the band's and cannot be edited here.",
      items: [
        { id: "subject", label: "Subject" },
        { id: "preheader", label: "Preheader" },
        { id: "body", label: "Body" },
        { id: "chips", label: "Facts this body may say" },
        { id: "default", label: "Show the code default" },
        { id: "draft-source", label: "Draft — not in production" },
        { id: "published-source", label: "Published — what production sends" },
        { id: "default-source", label: "Default — nothing is published for this template" },
      ],
    },
    {
      id: "preview",
      heading: "Preview",
      body: "One set of sample facts, rendered through the same band a real send uses. The text is canonical; the HTML beside it is derived from the text.",
      items: [
        { id: "sample", label: "Sample data — no member's link and no live token" },
        { id: "text", label: "Plain text" },
        { id: "html", label: "HTML, derived" },
        { id: "overridden", label: "Showing your unsaved edit" },
        { id: "refused", label: "This preview is refused" },
        {
          id: "refused-body",
          label: "The words below would break a rule this template is held to.",
        },
      ],
    },
    {
      id: "actions",
      items: [
        { id: "save", label: "Save draft" },
        { id: "saving", label: "Saving…" },
        { id: "publish", label: "Publish" },
        { id: "publishing", label: "Publishing…" },
        { id: "reset", label: "Reset to Default" },
        { id: "resetting", label: "Resetting…" },
        { id: "test", label: "Send Test" },
        { id: "testing", label: "Sending…" },
        { id: "test-note", label: "Sent to your own address, with sample data and a test footer." },
        { id: "saved", label: "Draft saved." },
        { id: "published", label: "Published — the next send uses these words." },
        { id: "reset-done", label: "Override dropped. The next send uses the code default." },
      ],
    },
    {
      id: "versions",
      heading: "Version history",
      body: "Every save, publish and reset, newest first. A retired row keeps the words it carried and the instant it stopped being live.",
      items: [
        { id: "version", label: "Version" },
        { id: "status", label: "State" },
        { id: "editor", label: "Editor" },
        { id: "at", label: "When" },
        { id: "restore", label: "Restore to draft" },
        { id: "restoring", label: "Restoring…" },
        { id: "restored", label: "Restored to a draft — publish it to change production." },
        { id: "none", label: "No version yet. This template has never been overridden." },
        { id: "retired", label: "Retired" },
      ],
    },
    {
      id: "read-only",
      heading: "This body is not editable here",
      body: "This template keeps its words in code — two bodies, one per seat — so there is no markdown section to override. The preview below is the default a send uses today.",
    },
    {
      id: "refusals",
      items: [
        { id: "no-such-template", label: "That template is not one this page carries." },
        {
          id: "not-editable",
          label: "This template's words live in code, so there is nothing to save.",
        },
        {
          id: "invalid-override",
          label: "The save was refused — see the problem beside the field.",
        },
        { id: "no-draft", label: "There is no saved draft to publish. Save one first." },
        { id: "nothing-to-reset", label: "This template is already the default." },
        { id: "version-conflict", label: "Another edit took this version. Reload and try again." },
        { id: "empty-subject", label: "A subject is required." },
        { id: "empty-body", label: "A body is required." },
        { id: "unknown-variable", label: "That is not a fact this template holds." },
        {
          id: "counterparty-leak",
          label:
            "A Counterparty-recipient mail may not mention price, trial, card, plan, extension or an amount.",
        },
        { id: "role-too-low", label: "Your role may not edit a mail." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "That did not go through." },
        { id: "unset", label: "This deployment has no mail key, so nothing was sent." },
        { id: "test-failed", label: "The provider refused the test message." },
      ],
    },
    {
      id: "empty",
      heading: "No templates",
      body: "The register carries no member-facing template, which means the code is missing rather than the list being filtered.",
    },
    {
      id: "unreadable",
      heading: "The overrides could not be read",
      body: "The database did not answer. The templates are listed from the code, but no status is known — nothing was changed.",
    },
  ],
});
