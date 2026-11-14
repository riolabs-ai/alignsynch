/**
 * `/templates/relationship/[templateId]/create` and `…/create/mode` — the create flow's two steps
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
import { formatCurrency } from "../../content/core";
import { billingPlan } from "../billing-plans";
import type { PaidPlanId } from "../billing-prices";
import { lifecycleStageSection } from "./lifecycle";

/**
 * One tier's monthly figure, from the fixture that sells it (#975).
 *
 * This section used to carry two typed prices — `$9.95` and `$19.85` — under a comment claiming
 * they were "data here for the reason every other figure in this tree is: a price typed into
 * markup is a price that can disagree with the one the pricing page sells". They were typed here,
 * and they did disagree: `/dashboard/templates` sold `Basic · $8.95/mo` and `/pricing` sold the
 * same, while stage 5 of the create flow asked the same person for `$9.95 /mo` and `$19.85 /mo`
 * over the identical two choices. Three prices, one relationship, no gate anywhere that compared
 * them.
 *
 * So the figure is read, never typed: `data/billing-plans.ts` is the one home for a price, and
 * this module names a tier and prints its monthly amount. A tier that stops existing is a thrown
 * error at import — a screen with a missing price is a screen that would otherwise print `$0.00`.
 */
const ONE_RELATIONSHIP_PLAN_ID = "basic";
const UNLIMITED_PLAN_ID = "principal";

/**
 * **The tier each plan row sells — the crossing between stage 5's row ids and the catalogue.**
 *
 * The `plans` section below is keyed by the row ids the prototype prints (`one`, `unlimited`,
 * `one-note`, `one-price`), and each row's figure is read from the tier named here
 * (`monthlyPriceOf(ONE_RELATIONSHIP_PLAN_ID)`). That pair is what a checkout must be asked for, and
 * it is declared once, here, beside the prices it produces — a second map anywhere else is how the
 * two vocabularies drifted apart in the first place.
 *
 * **Why it needs saying out loud.** Both vocabularies are `string`, so nothing in the type system
 * saw the walk posting a row id as a tier: stage 5 sent `"one"`, the adapter answered *"one" is not
 * a plan this product sells*, the card frame never mounted, and — with `#1019`'s send behind that
 * gate — no new relationship could be completed. `tests/plan-billing-tier.test.tsx` binds this map
 * to `BILLING_PLAN_IDS` **and** to a Price at both intervals, so the next rename on either side
 * fails a check instead of a checkout.
 *
 * `satisfies Record<string, PaidPlanId>` keeps a tier that is not sold (`free`) out of the map at
 * compile time; the reverse direction — a row this map prices that the panel does not draw — is
 * the key comparison the test makes, since no type can see a map entry nothing reads.
 */
export const PLAN_BILLING_TIER = {
  one: ONE_RELATIONSHIP_PLAN_ID,
  unlimited: UNLIMITED_PLAN_ID,
} as const satisfies Record<string, PaidPlanId>;

/** The plan rows the money panel draws: the keys of the map above. */
export type PlanRowId = keyof typeof PLAN_BILLING_TIER;

function monthlyPriceOf(id: typeof ONE_RELATIONSHIP_PLAN_ID | typeof UNLIMITED_PLAN_ID): string {
  const plan = billingPlan(id);
  if (plan === undefined) {
    throw new Error(
      `data/billing-plans.ts has no "${id}" plan — the create flow's stage 5 prints its monthly figure`,
    );
  }
  return formatCurrency(plan.monthlyCents);
}

export const assessmentCreatePageCopy: PageCopy = zPageCopy.parse({
  /**
   * Stage 1's heading, and the dialog's accessible name (#709). The owner renamed it from
   * "Create a relationship" to the artifact's own `s4.heading` (#760): the stages are
   * **Relationship Details · Relationship Settings · Relationship Aspects · Account · Invite**,
   * and a stage heading that disagrees with the screen the artifact draws is the drift
   * `docs/specs/flow-stages.md` exists to catch.
   */
  heading: "Relationship Details",
  /**
   * The sentence under the heading — the v9 artifact's `s4.body` (#825). It is the stage's own
   * <p>, not a section's, because the field inventory below is a list of fields and nothing else.
   */
  subtitle: "Name both people and the relationship. Everything here can change later.",
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
       * The stage foot's one shared word (#760). Every stage 1–5 draws `[Back][Cancel]` as one
       * left group before the advancing act, and `Cancel` is the same word on all five — one row
       * here rather than five copies that could drift, the way `stages.close` is the shell's one
       * close label.
       */
      id: "foot",
      items: [{ id: "cancel", label: "Cancel" }],
    },
    {
      /**
       * The two plans (#690, re-headed by #911).
       *
       * **The figures are read from `data/billing-plans.ts` (#975).** They were typed here as
       * `$9.95` / `$19.85` and had drifted from the plan fixture the shelf and `/pricing` sell
       * (`Basic · $8.95/mo`), so one person asking "what does this cost?" got three answers.
       * `monthlyPriceOf()` above names the tier and prints its amount; nothing in this file
       * spells a price. The rows are a single-choice group (`role="radio"`, `aria-checked`)
       * shaped like the Mode choice, and choosing one commits nothing — the card step is where a
       * card is taken, and it charges nothing either.
       *
       * **#911 changed what this step is for.** It used to be a soft prompt beside a send that went
       * through unpaid. Now the walk's first step is where the money is *decided*: the two things
       * the money buys are named on it (a membership plan joined, and this relationship activated),
       * and the send on the right does not unlock until the card is saved. The heading is the
       * owner's phrase, `join membership plan`, never "how you would pay" — the step is an act, not
       * a survey.
       *
       * The trial sentence is the prototype's, verbatim, because it is the promise the card step
       * rests on: nothing is charged when the card is saved.
       */
      id: "plans",
      heading: "Join a membership plan",
      body: "Two things the money buys: you join a membership plan, and this relationship is activated. Nothing is charged today — the trial starts when the card is saved.",
      items: [
        { id: "legend", label: "Choose a plan" },
        { id: "one", label: "Basic" },
        {
          id: "one-note",
          label:
            "One open-ended relationship term. Switch relationships whenever you like; the term does not expire.",
        },
        { id: "one-price", label: monthlyPriceOf(ONE_RELATIONSHIP_PLAN_ID) },
        { id: "unlimited", label: "Principal" },
        {
          id: "unlimited-note",
          label: "Every relationship you open, for as long as you keep the plan.",
        },
        { id: "unlimited-price", label: monthlyPriceOf(UNLIMITED_PLAN_ID) },
        { id: "per", label: "/mo" },
        { id: "best-value", label: "best value" },
        {
          id: "trial",
          label:
            "7 days free — the trial starts only when the card is saved, and nothing is charged before that.",
        },
        { id: "trial-short", label: "7 days free" },
        /**
         * #911 — **what the money buys, named once.** The card asked for the two things by name, so
         * they are two rows rather than a sentence: the plan the person joined (filled with its own
         * name and price from the rows above) and the relationship that is activated by sending it.
         */
        { id: "buys-heading", label: "What the money buys" },
        { id: "buys-join", label: "Join membership plan — {plan}" },
        {
          id: "buys-activate",
          label: "Activate relationship — the invitation goes out and both seats go live.",
        },
        /**
         * #870 — the plan panel for an account that **already pays**. Asking somebody on a paid
         * tier to choose plan is the same defect as asking them to buy twice, so the walk states
         * what they are on and what it includes instead of drawing the radio group. `{plan}` is
         * the tier's own name from `lib/billing` (#835's entitlement), never a word from here.
         */
        {
          id: "included",
          label: "You are on {plan}. There is nothing to choose here.",
        },
        {
          id: "included-plan-label",
          label: "Your plan",
        },
      ],
    },
    {
      /**
       * The walk (#771, three steps since #911) — **plan → card → thank you**, inside stage 5.
       *
       * The artifact (`prototype-relationship-lifecycle-v9.html`) draws the pay flow in the left
       * column and the send in the right one; #911 made the send **wait for the walk**, so the two
       * columns are one decision and one control: the foot's advance is
       * `send email to counterparty now`, disabled until the card is saved.
       *
       * Three steps, not five. `account` is stage 4 now (#825), so a sign-in panel here would be a
       * second sign-in the spec forbids, and the confirmation the old walk drew is the card step's
       * own record — Stripe's frame submits, and the thank-you states what is true afterwards. The
       * last step carries **no button**: the walk ends there, and its one sentence says where the
       * reader goes next (the send control beside it, or the draft).
       *
       * `card-stripe-*` are the frame's chrome. The card **fields** are Stripe's, mounted from
       * `components/billing/stripe-frame.tsx` — and since #912 this walk is its **only** caller: the
       * dashboard's capture dialog is deleted, so there is exactly one card-capture surface in this
       * app (`tests/one-payment-surface.test.ts`).
       */
      id: "payment-flow",
      heading: "Payment",
      body: "Two steps and a thank-you. Nothing is charged today.",
      items: [
        { id: "continue", label: "Next" },
        { id: "back", label: "Back" },
        { id: "card-heading", label: "Card" },
        {
          id: "card-body",
          label:
            "The card fields are Stripe's, drawn inside this page — you never leave it and no card detail touches our code.",
        },
        {
          id: "card-charged",
          label: "Nothing is charged today. The 7-day trial starts when the card is saved.",
        },
        { id: "card-starting", label: "Opening the card fields…" },
        { id: "card-secure", label: "Secure payment · Stripe" },
        { id: "card-test-mode", label: "test mode" },
        { id: "card-frame", label: "The card fields Stripe draws here" },
        { id: "card-frame-note", label: "Cancel and nothing is saved." },
        {
          id: "card-refused",
          label:
            "The card was not saved, and nothing has been charged. Try again, or keep the draft instead.",
        },
        { id: "card-hosted", label: "Stripe asked for the card on its own page." },
        { id: "card-hosted-link", label: "Open the card page" },
        { id: "thanks-heading", label: "Thank you" },
        {
          id: "thanks-body",
          label:
            "The plan is active and the card is on file. Nothing has been charged today — the trial starts when the card is saved.",
        },
      ],
    },
    {
      /**
       * Stage 4 — **Account** (#825, superseding the gate that used to follow the create).
       *
       * #659 said "Account is not a stage" and the flow asked for the account *after* the
       * relationship existed, on a second surface that did nothing else. v9 reverses that: the
       * creator signs up **before** the row is written, so the Initiator is known when it is
       * written instead of being attached to it afterwards.
       *
       * Three sentences, each owning a different fact (#777, option A) — the stage used to say the
       * same one up to four times:
       *
       *   `body`          where the answers are: a cookie on this device, until the sign-in
       *                   completes. It carries the "nothing you already typed is lost" promise
       *                   that a signed-out creator is the one who needs, so no second sentence
       *                   repeats it.
       *   `signed-in-body` whose account sends the invitation — the one fact a signed-in person
       *                   deciding to continue is missing.
       *   `created-body`  what state the relationship is in: the re-entered state (stage 5's
       *                   `Back`), where it already exists and there is nothing left to create.
       *
       * A fact is stated once. Adding a fourth sentence back in is how this stage read as a wall.
       */
      id: "account",
      heading: "Create your account",
      body: "Your answers stay on this device until you sign in.",
      items: [
        { id: "signed-in-heading", label: "You're signed in" },
        {
          id: "signed-in-body",
          label: "The invitation is sent from this account.",
        },
        {
          id: "created-body",
          label:
            "The relationship exists as a draft. The account it belongs to is the one you are signed in with.",
        },
        { id: "submit", label: "Continue to Stage 5" },
        { id: "back", label: "Back" },
      ],
    },
    {
      /**
       * Stage 5 — **Invite** (#825, gated by #911).
       *
       * Two acts, and the difference between them is the whole stage: the send publishes the draft
       * and mails the one invitation; `Continue as Draft` keeps it, sends nothing and charges
       * nothing. Both sentences under the card exist to make the second one safe to choose: the
       * relationship already exists, and no email has gone out.
       *
       * **The send waits for the walk (#911).** `submit` is the owner's sentence, in the owner's
       * words — lowercase on purpose, because it reads as the act rather than as a button label —
       * and it is disabled until the plan and the card are done. `locked` is the sentence that
       * explains the disabled control (a control that greys out with no reason is where people close
       * the tab), and `active` is the same position once it clears. Both sit in the right column,
       * immediately above the foot that carries the control.
       */
      id: "invite",
      heading: "Send the invitation",
      body: "The relationship is ready. Send the invitation now, or keep it as a draft and send it when you are ready.",
      items: [
        { id: "cta-heading", label: "Send the invitation" },
        {
          id: "cta-body",
          label:
            "One email with one link. The relationship waits at Invited until they accept — nothing is charged and nothing is visible to them until they claim the seat.",
        },
        { id: "submit", label: "send email to counterparty now" },
        {
          id: "locked",
          label:
            "Send unlocks when the plan and the card are done. Keep the draft instead and nothing is charged.",
        },
        {
          id: "active",
          label: "The plan is active and the card is on file. The invitation can go now.",
        },
        { id: "draft", label: "Continue as Draft" },
        {
          /**
           * #1014 — the send's transport refusal, drawn in the walk's own panel. It is the one
           * sentence this card adds: every other word on the action step already existed (the
           * stage's heading, its body, its two labels, its unlocked line). It says the three true
           * things — nothing was sent, nothing was charged, and the draft is still theirs — because
           * a send that failed to reach the app must not read as a send that failed to happen.
           *
           * The `?resend=` band owns the codes the *endpoint* refuses with (no membership, not the
           * Initiator, already published); this is the one the network itself can produce.
           */
          id: "send-refused",
          label:
            "The invitation did not go out — the request could not reach the app. Nothing was sent and nothing was charged. Try again, or keep the draft.",
        },
        { id: "note-heading", label: "What you can do later" },
        {
          id: "reassure",
          label: "You can resend, edit the title, or withdraw the invitation at any point.",
        },
        {
          id: "draft-help",
          label:
            "A draft sends nothing and charges nothing. It stays under My relationships until you send it.",
        },
        { id: "sent-to", label: "The invitation goes to" },
        { id: "back", label: "Back" },
      ],
    },
    {
      /**
       * Stage 1's field inventory, v9 (#825) — **the fields, not the screen's words**. The
       * heading and the sentence under it are the *page's* (`heading` / `subtitle` below), so
       * the screen says "Relationship Details" once: before this the section repeated the page
       * heading as an `<h2>` three lines under its own `<h1>`.
       *
       * The artifact draws each seat as **first + last**, the invitation address, the title and
       * the description, in that completion order, and the five required fields carry a red
       * asterisk (`*`, `aria-hidden`) with the word beside it for a screen reader —
       * `required-note` is that word, and it is copy, not markup, because a reader hears it.
       *
       * **The placeholders that say `Required` and `Optional` are the artifact's own.** They sit
       * in the two halves whose requirement is not obvious from the label — the last names —
       * rather than on every field, which is why the email and the title carry none.
       */
      id: "who",
      items: [
        { id: "title-label", label: "Your Personalized Relationship Title" },
        { id: "title-help", label: "The personalized name of the created Relationship." },
        { id: "initiator-first-label", label: "Initiator First Name" },
        { id: "initiator-last-label", label: "Initiator Last Name" },
        { id: "initiator-last-placeholder", label: "Required" },
        { id: "initiator-help", label: "The seat this relationship is created from." },
        { id: "counterparty-first-label", label: "Counterparty First Name" },
        { id: "counterparty-first-placeholder", label: "Their name" },
        { id: "counterparty-last-label", label: "Counterparty Last Name" },
        { id: "counterparty-last-placeholder", label: "Optional" },
        {
          id: "counterparty-help",
          label: "They will complete their name preference when they claim the invitation.",
        },
        { id: "email-label", label: "Counterparty Email for Invite" },
        { id: "email-placeholder", label: "name@example.com" },
        { id: "description-label", label: "Personalized Relationship Description" },
        {
          id: "description-placeholder",
          label: "A sentence on why you are doing this — both of you read it on the card.",
        },
        { id: "description-help", label: "Optional. Shown to both parties, never scored." },
        /**
         * The required marker's audible half. The asterisk is `aria-hidden` — a glyph, not a
         * word — so this is what a screen reader says instead, once per required field.
         */
        { id: "required-note", label: "required" },
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
      body: "Copied from the template. You can rename or reword an Aspect here, add or remove one, and drag them into the order you want — the list is yours from the moment the relationship is created.",
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
         * The shared editor's two list controls (#774), and the floor under them (#699).
         * `components/assessment-flow/aspect-list.tsx` names all three ids: `add` / `remove` are
         * drawn at stage 3 now, and `last` is the sentence that refuses removing the final Aspect —
         * a relationship asks at least one, so the control is disabled instead of the create
         * refusing an empty list a stage later.
         */
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove {name}" },
        {
          id: "last",
          label: "A relationship asks at least one Aspect. Add another before removing this one.",
        },
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
          id: "template-archived",
          // #870 — the status half of the old "template-not-published" sentence, split out. The
          // store used to refuse an unpublished template with *"…is draft with no published
          // version"*, which stated two facts as one and read like a contradiction. This is the
          // status fact and it is true for `archived` and for the author-only `draft` alike, so
          // the two states a `record.status` can hold do not need two sentences nobody can tell
          // apart on screen.
          label:
            "That template is not published, so nothing can copy it. Publish it and the create step opens.",
        },
        {
          id: "template-not-published",
          // #870 — the version half. A published template with no `template_version` row is a
          // template nothing can copy (#502b), and after the split this sentence states only that.
          label:
            "That template has no published version yet. Publishing it writes one, and a relationship is copied from that version.",
        },
        {
          id: "template-has-no-aspects",
          label:
            "That template has no Aspects, so a relationship made from it would have nothing to ask.",
        },
        // #699 — the creator's own list, emptied. Its own sentence rather than the template's:
        // the template was fine, and what the person needs to do is add a row back.
        {
          id: "aspects-none",
          label: "A relationship needs at least one Aspect. Add one to the list before continuing.",
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
        // #505 — the plan's own limit, and the one the create gate still asks: relationships this
        // account started, not sessions it holds a seat on. It is the only refusal `lib/flow/store`
        // raises at create (#835 removed the mode and session-count legs).
        {
          id: "relationship-limit",
          label:
            "Your plan includes one active relationship at a time, and you already have one. Finish it before starting another, or move to a paid plan for unlimited active relationships.",
        },
        {
          id: "mode-not-entitled",
          // #835 — this sentence is drawn as a stage-5 **notice**, not a refusal: Advanced Mode is
          // not on the Free tier, but publishing grants the entry paid tier for seven days and
          // that tier plays it. So the line is about day eight, and it never says the Mode was
          // refused — nothing refuses it any more.
          label:
            "Advanced Mode is included in your seven-day trial. After the trial ends, it needs a plan that includes it.",
        },
        {
          /**
           * #957's server half — the create endpoint is stage 4's draft write, and a post that did
           * not come through the stages is refused by name rather than created.
           *
           * The sentence names **what the product does** and not the technical fact ("the post
           * carried no draft flag"), because the person reading it pressed something that should
           * have started the flow: the relationship is saved as a draft first, and stage 5 decides
           * whether the invitation goes out. The door beside it is stage 1 of that same template.
           */
          id: "create-not-from-flow",
          label:
            "A relationship is saved as a draft from the create flow, and the invitation is sent from the step after it. Start it from the template and it will be saved — nothing has gone out.",
        },
        // #618 — the door the two plan lines above name and neither drew. One label for both
        // codes, because it points at the same page: the plan grid, which is where a tier is
        // chosen and where the checkout button for that tier lives. Neither sentence changed.
        { id: "plans", label: "See plans and prices" },
        /**
         * #870 — the doors a **template** refusal names. Before that card every one of the
         * template codes drew `link: null`, so a band that said "that template is not published"
         * offered nothing to press on a stage that had no other control either.
         *
         * Each label names the page it opens rather than the fix, because the two are not the
         * same: `open-template` lands on the template's own page, where the publish control is the
         * existing status transition, and `fix-aspects` lands on the member's editor, which is the
         * only surface that can add one. `back-to-templates` is the library — the exit for a code
         * with no fix at all (not yours, not there, already a relationship).
         */
        { id: "open-template", label: "Open this template" },
        /**
         * #957's server half — the door a refused bare post names: stage 1 of the template it
         * could not copy from. It is the same address every catalogue card opens since #957, so the
         * refusal hands the person the flow rather than the library.
         */
        { id: "start-the-flow", label: "Start the relationship" },
        { id: "fix-aspects", label: "Edit this template's Aspects" },
        { id: "back-to-templates", label: "Back to your templates" },
        { id: "back-to-relationships", label: "Back to my relationships" },
        /**
         * #870 — the one-click publish a stage-1 refusal offers its author. The words are a
         * *summary* of the fixture's own status transition (`setTemplateStatus`), not a second
         * rule: pressing it posts `status=published` to the same endpoint the template page posts
         * to, and comes back to stage 1.
         */
        { id: "publish-template", label: "Publish this template" },
        {
          id: "publish-template-note",
          label:
            "This writes the template's first published version from the Aspects it already has. Nothing else changes.",
        },
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
