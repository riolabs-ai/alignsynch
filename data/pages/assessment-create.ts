/**
 * `/assessment/templates/[templateId]/create` and `…/create/mode` — the create flow's two steps
 * (#409, wired by #427, split by #688).
 *
 * One fixture for both stages, because they are one flow: the rail, the refusals and the
 * "nothing to copy" screen are shared, and a second fixture would be a second vocabulary for one
 * relationship. The `who` and `mode` sections are the two forms; `validation` is the one band a
 * server-side refusal draws.
 *
 * The two choices are explained in the words a decider needs, and the difference between them
 * is stated on the screen rather than implied:
 *
 * - **Mode is fixed at creation.** Both parties answer one shape, which is what makes two
 *   sheets comparable at all. It is not a later preference.
 * - **Setting is what a party may change later.** It moves the bar the report is judged
 *   against; it never changes a question.
 *
 * **A refusal names the field, not the column.** Stage 1 and stage 2 validate before the store
 * is asked anything (`lib/flow/create-draft.ts`), and the refusal carries a field id and a
 * reason; `lib/flow/create-copy.ts` fills the reason's sentence with that field's own label, so
 * the band says "Their email address is required" rather than `counterparty_email`.
 *
 * **The create itself still refuses in codes.** A store refusal comes back as
 * `?problem=<FlowErrorCode>`; the `problems` section is the one sentence per code, and `refused`
 * is the screen drawn when the code means the template itself cannot be read (somebody else's,
 * an instance, an id that names nothing).
 *
 * `{count}` is the template's own Aspect count, filled by `fillLabel()` from the record the
 * page read. The Mode and Setting option names are the model's own glossary (`MODE_LABELS`,
 * `SETTING_LABELS`, `SETTING_DEFINITIONS`), not a second copy of them here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { lifecycleStageSection } from "./lifecycle";

export const assessmentCreatePageCopy: PageCopy = zPageCopy.parse({
  heading: "Create a relationship",
  subtitle: "One template, two seats, and the two choices that shape every screen after this one.",
  sections: [
    /**
     * The onboarding flow's rail (#687) — the six stages, with this screen as the first of them
     * (Who). The words are authored once, in `data/pages/lifecycle.ts`, and *referenced* here:
     * the same rail sits above every stage, so a copy per fixture would be six places a rename
     * hides. This screen replaced the browse journey's three-step rail (#618, "Products · This
     * product · Create the relationship") with it, because the create step is where the flow
     * starts — the template screens before it are pre-stage views, not numbered stages.
     */
    lifecycleStageSection,
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
      /**
       * Stage 1 — **Who** (#688).
       *
       * The prototype's `s4.*` block, verbatim where the words are the owner's: two seats, the
       * counterparty's address, and the card title both of them read. The template band above the
       * form is the record's own facts, not copy.
       */
      id: "who",
      heading: "Who and how",
      body: "One template, two seats, and the facts that shape every screen after this one.",
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
        { id: "title-label", label: "What are you in the middle of" },
        { id: "title-placeholder", label: "Relationship Basics" },
        {
          id: "title-help",
          label: "The card title both of you see — the template's name is only the starting point.",
        },
        { id: "description-label", label: "Description" },
        {
          id: "description-placeholder",
          label: "A sentence on why you are doing this — both of you read it on the card.",
        },
        { id: "description-help", label: "Optional. Shown to both parties, never scored." },
        { id: "submit", label: "Continue to mode and setting" },
        { id: "submit-note", label: "Nothing is created yet. The next step fixes the Mode." },
      ],
    },
    {
      /**
       * Stage 2 — **Mode** (#688).
       *
       * The prototype's `s5.*` block. Mode is fixed at creation and the Setting is the one choice
       * a party may move later; both sentences say so on the screen rather than leaving a person
       * to learn it from a report.
       */
      id: "mode",
      heading: "Mode and setting",
      body: "Mode is fixed at creation: both parties answer one shape, which is what makes two sheets comparable at all.",
      items: [
        { id: "mode-label", label: "Mode" },
        { id: "mode-fixed", label: "Fixed at creation" },
        { id: "mode-basic-help", label: "Feel and Wish on every Aspect." },
        { id: "mode-advanced-help", label: "Feel, Wish, Think and Guess on every Aspect." },
        {
          id: "mode-fixed-note",
          label: "Mode cannot be changed after the relationship is created.",
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
        { id: "back", label: "Back to who" },
      ],
    },
    {
      /**
       * The one band a server-side refusal draws (#688).
       *
       * A refusal carries a *field* and a *reason*; the sentence is composed here with the field's
       * own label, so the person is told "Their email address is required" and never that
       * `counterparty_email` failed a CHECK. The label is not repeated here — it is read from the
       * stage's own section, so a rename moves every sentence that names it.
       */
      id: "validation",
      heading: "Check one field",
      items: [
        { id: "required", label: "{field} is required." },
        { id: "email", label: "{field} must be an address the invitation can reach." },
        {
          id: "choice",
          label:
            "{field} is not one of the options this form offers — choose one of the options below.",
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
