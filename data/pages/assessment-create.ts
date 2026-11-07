/**
 * `/assessment/templates/[templateId]/create` — the create step (#409, wired by #427).
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
 * **The submit now creates the relationship**, so the sentence beside it says what submitting
 * does rather than that it cannot. A refusal comes back to this same screen as
 * `?problem=<code>`; the `problems` section is the one sentence per code the store can answer
 * with, and `refused` is the screen drawn when the code means the template itself cannot be
 * read (somebody else's, an instance, an id that names nothing).
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
      /**
       * The journey's rail (#618) — the third step, drawn on the create screen. Same ids and shape
       * as the product page's rail, so the two screens read as one journey rather than two pages
       * that happen to be near each other.
       */
      id: "steps",
      items: [
        { id: "1", label: "Products" },
        { id: "2", label: "This product" },
        { id: "3", label: "Create the relationship" },
        { id: "count", label: "Step {step} of 3" },
        { id: "label", label: "Creating a relationship" },
      ],
    },
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
      /**
       * The account gate (#618).
       *
       * The page used to render the form to a signed-out visitor, and the endpoint still accepts a
       * signed-out post (it writes a null initiator, #146/#213). The product spec is the opposite:
       * "not a user? → signup, then edit meta". So the screen asks for the account *first* rather
       * than after the relationship exists — a relationship created with no account is in nobody's
       * list, and there is no screen from which its creator could finish, pay for or even find it.
       *
       * Both links carry `next` = this template's create path, so the product survives the round
       * trip in the URL rather than in a cookie or a hidden field.
       */
      id: "gate",
      heading: "An account holds this relationship",
      body: "The relationship you are about to create belongs to your account: it is where the invitation comes from and where you come back to see it answered. Creating one takes a name, an email address and a password, and it brings you back to this same template.",
      items: [
        { id: "sign-up", label: "Create an account" },
        { id: "sign-in", label: "I already have an account" },
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
          id: "submit-note",
          label:
            "Submitting copies the Aspects, creates the relationship and sends one invitation. Nobody has answered anything yet.",
        },
      ],
    },
    {
      id: "problems",
      heading: "That relationship was not created",
      items: [
        {
          id: "invalid-input",
          label:
            "A field was missing or was not one this form offers. Choose a Mode and a Setting, then try again.",
        },
        {
          id: "unknown-template",
          label: "There is no template at that address, so there is nothing to copy.",
        },
        {
          id: "template-not-published",
          label:
            "That template is not published. Only a published template can be copied into a relationship.",
        },
        {
          id: "template-has-no-aspects",
          label:
            "That template has no Aspects, so a relationship made from it would have nothing to ask.",
        },
        {
          id: "record-is-an-instance",
          label:
            "That record is already a relationship. A relationship is created from a template, not from another relationship.",
        },
        {
          id: "template-not-yours",
          label:
            "That template was written by another account. You can copy the platform's templates and the ones you wrote.",
        },
        {
          id: "instance-limit",
          label:
            "You already hold as many open relationships as your plan allows. Close one before creating another.",
        },
        // #505 — the plan's own limit, which is the one the pricing page sells. It is a different
        // sentence from `instance-limit` because it is a different count: relationships this
        // account started, not sessions it holds a seat on.
        {
          id: "relationship-limit",
          label:
            "Your plan includes one active relationship at a time, and you already have one. Finish it before starting another, or move to a paid plan for unlimited active relationships.",
        },
        {
          id: "mode-not-entitled",
          label: "The Mode you chose is not on your plan. Choose Basic, or change your plan.",
        },
        // #618 — the door both refusals above name and neither drew. One label for both codes,
        // because it points at the same page: the plan grid, which is where a tier is chosen and
        // where the checkout button for that tier lives. Neither sentence changed.
        { id: "plans", label: "See plans and prices" },
      ],
    },
    {
      id: "refused",
      heading: "Nothing was created",
      body: "The template this form would have copied could not be read, so there is no form to fill in. Your templates are still where you left them.",
      items: [{ id: "back", label: "Back to your templates" }],
    },
  ],
});
