/**
 * `/assessment/templates/[templateId]/create` — the create step, shipped as **in-progress UI**
 * (#409, R1-E).
 *
 * The v1 create form's shape, on the app's own route: the template and its two seats at the
 * top, then the counterparty, then the two choices that shape everything after creation.
 *
 * The two choices are explained in the words a decider needs, and the difference between them
 * is stated on the form rather than implied:
 *
 * - **Mode is fixed at creation.** Both parties answer one shape, which is what makes two
 *   sheets comparable at all. It is not a later preference.
 * - **Setting is what a party may change later.** It moves the bar the report is judged
 *   against; it never changes a question.
 *
 * The submit cannot work yet, and the form says so beside the control. Nothing on this screen
 * calls a write path, so a reader is never handed a success for something that did not happen.
 *
 * `{count}` is the template's own Aspect count, filled by `fillLabel()` from the record the
 * page read. The Mode and Setting option names are the model's own glossary (`MODE_LABELS`,
 * `SETTING_LABELS`, `SETTING_DEFINITIONS`), not a second copy of them here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentCreatePageCopy: PageCopy = zPageCopy.parse({
  heading: "Create a relationship",
  subtitle: "One template, two seats, and the two choices that shape every screen after this one.",
  sections: [
    {
      id: "template",
      heading: "The template you are copying",
      body: "Its Aspects are copied into the relationship at creation. Nothing on this screen edits them.",
      items: [
        { id: "aspects", label: "{count} Aspects" },
        {
          id: "seats",
          label:
            "Two seats: an Initiator and a Counterparty. Both answer the same sheet, and neither sees the other's answers until both accept.",
        },
        { id: "back", label: "Back to the template" },
      ],
    },
    {
      id: "form",
      heading: "Who and how",
      items: [
        { id: "initiator-label", label: "Your name — the Initiator" },
        { id: "initiator-help", label: "The seat this relationship is created from." },
        { id: "counterparty-label", label: "Who you are asking" },
        { id: "counterparty-placeholder", label: "Their name" },
        {
          id: "counterparty-help",
          label:
            "Display only: the seat is filled when they claim the invitation. A name typed here is not a party.",
        },
        { id: "email-label", label: "Their email address" },
        { id: "email-placeholder", label: "name@example.com" },
        {
          id: "email-help",
          label:
            "The invitation goes here. Without a mailer, the relationship page shows the link instead.",
        },
        { id: "mode-label", label: "Mode" },
        { id: "mode-basic-help", label: "Feel and Wish on every Aspect." },
        { id: "mode-advanced-help", label: "Feel, Wish, Think and Guess on every Aspect." },
        {
          id: "mode-fixed",
          label:
            "Mode is fixed at creation. Both parties answer one shape, so two sheets can be compared.",
        },
        { id: "setting-label", label: "Setting" },
        {
          id: "setting-changeable",
          label:
            "Setting is what a party may change later: it moves the bar the report is judged against, never a question.",
        },
        { id: "submit", label: "Create the relationship" },
        {
          id: "not-wired",
          label:
            "Not wired yet — this screen is not connected to the create path, so submitting it cannot create a relationship. Nothing was saved.",
        },
      ],
    },
  ],
});
