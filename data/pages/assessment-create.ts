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
  /**
   * Stage 1's heading, and the dialog's accessible name (#709). The owner renamed it from
   * "Create a relationship" to the artifact's own `s4.heading` (#760): the four stages are
   * **Relationship Details · Relationship Settings · Relationship Aspects · Create the
   * relationship**, and a stage heading that disagrees with the screen the artifact draws is the
   * drift `docs/specs/flow-stages.md` exists to catch.
   */
  heading: "Relationship Details",
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
        { id: "back", label: "Back" },
      ],
    },
    {
      /**
       * The stage foot's one shared word (#760). Every stage 1–4 draws `[Back][Cancel]` as one
       * left group before the advancing act, and `Cancel` is the same word on all four — one row
       * here rather than four copies that could drift, the way `stages.close` is the shell's one
       * close label.
       */
      id: "foot",
      items: [{ id: "cancel", label: "Cancel" }],
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
       * The walk (#771) — plan → account → method → confirm → done, drawn inside stage 4.
       *
       * The owner's rule: choosing a plan must not leave the screen, and a relationship nobody has
       * paid for yet is **saved as a draft** rather than blocked. So the method panel defers the
       * capture to publish, where the hard gate already lives
       * (`components/dashboard/relationship-detail.tsx`, #690), and the last panel is what flips the
       * stage's own control to `connect-cta`.
       *
       * `confirm-method-draft` is the honest half of that: the confirmation says the method will be
       * asked for at publish, because no card is taken on this screen.
       */
      id: "payment-flow",
      items: [
        { id: "continue", label: "Continue" },
        { id: "back", label: "Back" },
        { id: "account-heading", label: "Create your account" },
        {
          id: "account-note",
          label:
            "The relationship comes back to you, so this is where it is kept. The account is created when this stage finishes, and nothing here blocks the invitation.",
        },
        { id: "method-heading", label: "Add a payment method" },
        {
          id: "method-note",
          label:
            "The method is captured inside this page when your relationship is published — no card detail touches our code.",
        },
        { id: "method-defer", label: "Pay when I publish" },
        {
          id: "method-defer-note",
          label:
            "Nothing is charged today. Your relationship is saved as a draft, and the method is asked for once, when you publish your opinions for the other person to answer.",
        },
        { id: "confirm-heading", label: "Confirm payment" },
        { id: "confirm-plan", label: "Plan" },
        { id: "confirm-method", label: "Method" },
        { id: "confirm-method-draft", label: "Asked for at publish" },
        {
          id: "confirm-body",
          label:
            "Nothing is charged today. The 7-day trial starts when the method is saved, and the first charge lands only when you publish the assessment.",
        },
        { id: "confirm-cta", label: "Confirm" },
        { id: "change-plan", label: "Change plan" },
        { id: "done-heading", label: "You're all set" },
        {
          id: "done-body",
          label:
            "Your relationship is ready to create. Nothing has been charged, and the method is asked for when you publish.",
        },
        { id: "connect-cta", label: "Complete and Connect" },
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
       * Stage 1 — **Details** (#688, named by #735; copy replaced by the owner's saved pass, #760).
       *
       * The prototype's `s4.*` block, verbatim where the words are the owner's: two seats, the
       * counterparty's address, and the card title both of them read. The template band above the
       * form is the record's own facts, not copy.
       *
       * **The inventory is the spec's, field for field** (`docs/specs/flow-stages.md` → *Stage 1,
       * Details*), and `tests/create-fields.test.ts` pins it: four fields on a 6/6 grid and the
       * description across all twelve, `back` as the secondary action beside
       * "Continue to Stage 2". Two lines the artifact does not draw were deleted here —
       * `email-help` and `submit-note` — because an extra sentence is a spec change, not a copy
       * improvement.
       *
       * **Every label is the owner's, not a clarified version of it** (#760). The v7 artifact's
       * Edit-copy pass replaced five of them — the initiator's, the counterparty's, the address,
       * the title and the description — and the build renders them character for character. The
       * advance action is `Continue to Stage 2`: the stages are numbered on the rail, so the foot
       * names the step it goes to rather than describing what that step asks.
       */
      id: "who",
      heading: "Relationship Details",
      body: "One template, two seats, and the facts that shape every screen after this one.",
      items: [
        { id: "initiator-label", label: "Your Name as the Relationship Initiator" },
        { id: "initiator-help", label: "The seat this relationship is created from." },
        { id: "counterparty-label", label: "Counterparty's Name as Seen on the Invite" },
        { id: "counterparty-placeholder", label: "Their name" },
        {
          id: "counterparty-help",
          label: "They will complete their name preference when they claim the invitation.",
        },
        { id: "email-label", label: "Email Address used to send the Counterparty Invite" },
        { id: "email-placeholder", label: "name@example.com" },
        { id: "title-label", label: "Your Personalized Relationship Title" },
        { id: "title-placeholder", label: "Relationship Basics" },
        { id: "title-help", label: "The personalized name of the created Relationship." },
        { id: "description-label", label: "Personalized Relationship Description" },
        {
          id: "description-placeholder",
          label: "A sentence on why you are doing this — both of you read it on the card.",
        },
        { id: "description-help", label: "Optional. Shown to both parties, never scored." },
        { id: "submit", label: "Continue to Stage 2" },
        /** The secondary action in the foot's left group — the artifact's `s4.back`. */
        { id: "back", label: "Back" },
      ],
    },
    {
      /**
       * Stage 2 — **Settings** (#688, named by #735; copy replaced by the owner's saved pass, #760).
       *
       * The prototype's `s5.*` block, and the v7 artifact's whole point about this stage: **two
       * independent choices of equal weight**, drawn with one control. `mode-label` and
       * `setting-label` are the two fieldset headings — `Opinions Mode` and `Alignment Setting` —
       * and each option's help says what that option does in the model's own terms ("two Opinion
       * questions per Aspect") rather than in an adjective a reader has to decode.
       *
       * `mode-fixed` is the chip beside the left heading: Mode is fixed at creation, so the line
       * that used to explain that in a sentence is gone with it. `setting-help` and `setting-note`
       * are the owner's: the first says what the Setting is a lens over, the second names the two
       * thresholds exactly as `content/assessment.ts` defines them.
       */
      id: "mode",
      heading: "Relationship Settings",
      body: "Two independent choices: Mode decides how many Opinion questions each Aspect asks, and Setting decides how strictly the Gap analysis is judged.",
      items: [
        { id: "mode-label", label: "Opinions Mode" },
        { id: "mode-fixed", label: "Fixed at creation" },
        { id: "mode-basic-help", label: "Two Opinion questions per Aspect." },
        { id: "mode-advanced-help", label: "Four Opinion questions per Aspect." },
        { id: "setting-label", label: "Alignment Setting" },
        {
          id: "setting-help",
          label:
            "How strictly the Gap analysis is judged — a lens over the Gaps, never a question.",
        },
        {
          id: "setting-note",
          label: "Soft tolerates a Small Gap (1); Full accepts only In Synch.",
        },
        { id: "submit", label: "Continue to Stage 3" },
        { id: "back", label: "Back" },
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
      heading: "Relationship Aspects",
      body: "Copied from the template. You can rename or reword an Aspect here, and add one — it is yours from the moment the relationship is created.",
      items: [
        { id: "count", label: "{count} Aspects" },
        { id: "tap-to-edit", label: "Tap an Aspect to edit it in place." },
        { id: "drag-hint", label: "Drag to Reorder Aspects" },
        { id: "prompt-label", label: "The question both seats answer" },
        { id: "left-label", label: "Left opinion label" },
        { id: "left-help", label: "The low end of the scale — what a 1 means." },
        { id: "right-label", label: "Right opinion label" },
        { id: "right-help", label: "The high end — what a 5 means." },
        { id: "edit", label: "Edit" },
        { id: "save", label: "Save Aspect" },
        { id: "cancel", label: "Cancel" },
        /**
         * The question the open row asks before it throws away what was typed (#760). The artifact
         * repaired its own editor because a click into a field re-toggled the row shut and
         * swallowed Save; the row now closes only on Save or Cancel, and Cancel with changes asks
         * first. The sentence is copy, so it is here rather than in the component (E23).
         */
        { id: "unsaved", label: "Discard the changes to this Aspect?" },
        { id: "grip", label: "Reorder {name}" },
        { id: "saved", label: "Aspect saved." },
        { id: "reordered", label: "Order saved." },
        { id: "refused", label: "That Aspect was not saved." },
        /**
         * The shared editor's two list controls (#774). Stage 3 does not draw them — V4 keeps the
         * template's list fixed until #699 — but `components/assessment-flow/aspect-list.tsx` names
         * both ids, so they are declared here, where that component's copy is bound.
         */
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove {name}" },
        { id: "submit", label: "Continue to Stage 4" },
        { id: "back", label: "Back" },
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
