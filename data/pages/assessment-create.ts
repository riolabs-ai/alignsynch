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
      ],
    },
    {
      /**
       * Stage 4 — **Invite** (#690, named by #735).
       *
       * The review card, the two plans and the conversion, in the words the owner settled on for
       * the approved prototype (`s8.*`). **Six facts, not a form**: the template (with its Aspect
       * count), both seats, the title, the Mode and the Setting — everything stages 1–3 decided,
       * printed back for one last read before anything is created.
       *
       * `none` is the value a blank optional field renders as, because a blank row is worse than a
       * dash: a reviewer cannot tell an empty description from a rendering bug.
       */
      id: "review",
      heading: "What gets created",
      body: "One relationship, its own copy of the Aspects, and one invitation. Nothing is charged today.",
      items: [
        { id: "template", label: "Template" },
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "title", label: "Title" },
        { id: "mode", label: "Mode" },
        { id: "setting", label: "Setting" },
        { id: "none", label: "—" },
      ],
    },
    {
      /**
       * The conversion (#690) — the one control on stage 4 that writes.
       *
       * A plain form posting to the create endpoint, like every other write in this flow: the
       * draft already carries who, mode, setting and the list, so the post names the template and
       * nothing else, and a reload of the refusal cannot create a second relationship.
       *
       * `submit-note` says what the press does *and* what it does not do. Payment is a soft prompt
       * on this screen, so the sentence has to be true for the person who adds no method: the
       * relationship is created and the invitation is sent either way.
       */
      id: "commit",
      heading: "Create the relationship",
      body: "Submitting now creates the relationship and sends the invitation. Nothing is charged yet.",
      items: [
        { id: "submit", label: "Create relationship and send invite" },
        {
          id: "submit-note",
          label:
            "Submitting copies these Aspects, creates the relationship and sends one invitation. Nobody has answered anything yet.",
        },
        {
          id: "cta-heading",
          label: "Send the invitation",
        },
        {
          id: "cta-body",
          label:
            "One email with one link. The relationship waits at Invited until they accept — nothing is charged and nothing is visible to them until they claim the seat.",
        },
        {
          id: "reassure",
          label: "You can resend, edit the title, or withdraw the invitation at any point.",
        },
        { id: "back", label: "Back to aspects" },
      ],
    },
    {
      /**
       * The two plans (#690) — **a soft prompt, not a checkout**.
       *
       * The approved prices are data here for the reason every other figure in this tree is: a
       * price typed into markup is a price that can disagree with the one the pricing page sells.
       * The rows are a single-choice group (`role="radio"`, `aria-checked`) shaped like the Mode
       * choice, and choosing one commits nothing: the plan is remembered for this screen, the
       * create is not gated on it, and the door to capture a method is the pricing page's, which
       * is where a tier is actually bought (`components/pricing/plan-checkout-button.tsx`).
       *
       * The trial sentence is the prototype's, verbatim, because it is the promise the hard gate at
       * publish rests on: nothing is charged until then.
       */
      id: "plans",
      heading: "How you would pay",
      body: "Add a way to pay now and publishing is one click later — or skip it and pay when you submit the assessment. Nothing is charged today.",
      items: [
        { id: "legend", label: "Choose a plan" },
        { id: "one", label: "One relationship" },
        {
          id: "one-note",
          label:
            "One open-ended relationship term. Switch relationships whenever you like; the term does not expire.",
        },
        { id: "one-price", label: "$9.95" },
        { id: "unlimited", label: "Unlimited relationships" },
        {
          id: "unlimited-note",
          label: "Every relationship you open, for as long as you keep the plan.",
        },
        { id: "unlimited-price", label: "$19.85" },
        { id: "per", label: "/mo" },
        { id: "best-value", label: "best value" },
        {
          id: "trial",
          label:
            "7 days free — the trial starts only when you add a method, and nothing is charged until you publish.",
        },
        { id: "trial-short", label: "7 days free" },
        { id: "add-method", label: "Add a payment method" },
        {
          id: "add-method-note",
          label:
            "Optional here. Publishing needs a method on file, and the plans page is where one is added.",
        },
      ],
    },
    {
      /**
       * The account gate (#690) — **after** stage 4, never before it.
       *
       * Until this card the gate sat on stage 1 and a signed-out visitor could not fill in the
       * form at all (#618). The approved flow puts it behind the create instead: the relationship
       * and its invitation exist first, and this screen is where a person keeps them. So the
       * sentences say what has already happened — "the invitation is already out" — rather than
       * promising a send that has already happened.
       *
       * `progress` is the strip's own label ("Account · step 2 of 3"), and the three step labels
       * are the prototype's `s9.authStep1..3`. Step 3 is already done by the time the gate draws
       * (the invite commits with the relationship), which is why the strip's third marker is a ✓
       * rather than a circle: the account is the only step left, not the only step taken.
       *
       * `sign-in` is the second tab, and it is a link rather than a second form: the sign-in
       * screen already exists, and a copy of it here would be a second place for the failure
       * sentences to drift. It carries `next` = this gate, so signing in lands back on it.
       */
      id: "account",
      heading: "Keep this relationship — create your account",
      body: "The invitation is already out, so nothing is lost by waiting. An account is the sender the invitation carries and the address we can reach you at; without one, your seat lives in this browser.",
      items: [
        { id: "progress", label: "Account · step 2 of 3" },
        { id: "step-1", label: "Relationship ready" },
        { id: "step-2", label: "Your account" },
        { id: "step-3", label: "Invitation sent" },
        { id: "tab-create", label: "Create account" },
        { id: "tab-sign-in", label: "Sign in" },
        { id: "name", label: "Your name" },
        { id: "name-help", label: "Shown to the person you invited." },
        { id: "email", label: "Email address" },
        { id: "password", label: "Password" },
        { id: "password-help", label: "At least 10 characters." },
        { id: "submit", label: "Create account and continue" },
        { id: "submitting", label: "Creating…" },
        {
          id: "required",
          label: "A name, an email address and a password are needed to create the account.",
        },
        {
          id: "failed",
          label:
            "That account was not created. Check the address and the password, or sign in if you already have an account.",
        },
        { id: "back", label: "Back to the relationship" },
      ],
    },
    {
      /**
       * Stage 1 — **Details** (#688, named by #735).
       *
       * The prototype's `s4.*` block, verbatim where the words are the owner's: two seats, the
       * counterparty's address, and the card title both of them read. The template band above the
       * form is the record's own facts, not copy.
       *
       * **The inventory is the spec's, field for field** (`docs/specs/flow-stages.md` → *Stage 1,
       * Details*), and `tests/create-fields.test.ts` pins it: four fields on a 6/6 grid and the
       * description across all twelve, `back` as the secondary action beside
       * "Continue to mode and setting". Two lines the artifact does not draw were deleted here —
       * `email-help` and `submit-note` — because an extra sentence is a spec change, not a copy
       * improvement, and `title-help` is the artifact's one clause rather than an explanation of
       * where the template's name came from.
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
        { id: "title-label", label: "What are you in the middle of" },
        { id: "title-placeholder", label: "Relationship Basics" },
        { id: "title-help", label: "The card title both of you see." },
        { id: "description-label", label: "Description" },
        {
          id: "description-placeholder",
          label: "A sentence on why you are doing this — both of you read it on the card.",
        },
        { id: "description-help", label: "Optional. Shown to both parties, never scored." },
        { id: "submit", label: "Continue to mode and setting" },
        /** The secondary action beside the primary — the artifact's `s4.back`. */
        { id: "back", label: "Back" },
      ],
    },
    {
      /**
       * Stage 2 — **Settings** (#688, named by #735).
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
        { id: "submit", label: "Continue to aspects" },
        {
          id: "submit-note",
          label:
            "Nothing is created yet. The next stage is the Aspects, and the create comes after them.",
        },
        { id: "back", label: "Back to who" },
      ],
    },
    {
      /**
       * Stage 3 — **Aspects** (#689).
       *
       * The prototype's `s6.*` block: the list the relationship will ask, collapsed to one row an
       * Aspect so five of them read without scrolling, opening in place, and reordered by the
       * handle. The two ends of the 1..5 band are the model's own Left and Right Value, and the
       * words here are the ones a person needs to know which end is which — "what a 1 means" and
       * "what a 5 means", not "low" and "high" left to be guessed.
       *
       * The Aspect rows themselves are **record data**, never copy: they are the template's, they
       * are edited by the person, and E23 counts what a component writes, not what a row says.
       */
      id: "aspects",
      heading: "Aspects",
      body: "Copied from the template. Each Aspect is one question, answered by both seats — and the two labels say what the ends of its scale mean.",
      items: [
        { id: "count", label: "{count} Aspects" },
        {
          id: "tap-to-edit",
          label: "Tap an Aspect to open it, then drag its handle to change the order.",
        },
        { id: "prompt-label", label: "The question both seats answer" },
        { id: "left-label", label: "Left opinion label" },
        { id: "left-help", label: "The low end of the scale — what a 1 means." },
        { id: "right-label", label: "Right opinion label" },
        { id: "right-help", label: "The high end — what a 5 means." },
        { id: "edit", label: "Edit" },
        { id: "save", label: "Save Aspect" },
        { id: "cancel", label: "Cancel" },
        { id: "grip", label: "Reorder {name}" },
        { id: "move-up", label: "Move {name} up" },
        { id: "move-down", label: "Move {name} down" },
        { id: "saved", label: "Aspect saved." },
        { id: "reordered", label: "Order saved." },
        { id: "refused", label: "That Aspect was not saved." },
        { id: "submit", label: "Continue to create" },
        {
          id: "submit-note",
          label:
            "Nothing is created yet. The last stage reviews the six facts and sends the invitation.",
        },
        { id: "back", label: "Back to mode" },
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
