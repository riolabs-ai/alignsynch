/**
 * `/assessment/instances/[instanceId]` — the one screen both parties share (#146).
 *
 * Three states, three bands: `answer` (the viewer's own sheet), `waiting` (the other party
 * has not submitted, and nothing of theirs is drawn) and `report` (both submitted; the
 * existing `AssessmentReportView` draws the copy's Aspects and every Gap through
 * `gapOf()`).
 *
 * `problems` holds the refusals a submit can come back with, one item per code in
 * `SubmissionRejection` (`lib/flow/state.ts`). The screen maps the code to the id, so a
 * refusal is a sentence a reader can act on rather than a status code in a tab.
 *
 * `viewer` is the band #202 added: the party this session **answers as**, named in the
 * header region on every visit. The bug it closes was a session being moved into the other
 * party's column with nothing on screen saying so, so this is a standing sentence and not a
 * one-time notice — it is drawn in all three states, before the report and while answering.
 *
 * The email copy is not here: since #548 every message the product sends is a template in
 * `lib/email/templates/`, rendered through the band (`lib/email/band.ts`) so the plain text is
 * composed first and the HTML derived from it. The `unlock-email` band this file used to carry
 * moved to `report-ready.ts` with the rest of the set; the screen's own words stayed.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentInstancePageCopy: PageCopy = zPageCopy.parse({
  heading: "Your instance",
  sections: [
    {
      id: "viewer",
      items: [
        { id: "initiator", label: "You are answering as {name}, the Initiator." },
        { id: "counterparty", label: "You are answering as {name}, the Counterparty." },
        // The coach's band: a coach reads the relationship but never answers it, so there is no
        // `{name}` to fill — the sentence is the whole fact, and the badge beside the mode name
        // is the one word of it (`coach-badge`).
        { id: "coach", label: "You are viewing as Coach — read-only." },
        { id: "coach-badge", label: "Coach" },
      ],
    },
    // #274 — the one stage sentence, and the only place the four stage names are authored on
    // this screen. `lib/flow/stage.ts` decides which row is drawn; it can never draw
    // "Aligned", because that is a verdict over the finished Gap and belongs on the report.
    // No sentence names a count: `{names}` is who has not answered, which the waiting band
    // already says, and "3 of 5 answered" is the blind-rule leak this product refuses.
    {
      id: "stage",
      items: [
        { id: "invited", label: "Invited — waiting for {counterparty} to accept the invitation." },
        {
          id: "invited-expired",
          label:
            "Invited — the invitation to {counterparty} has expired, so they cannot accept it.",
        },
        { id: "connected", label: "Connected — {names} still to answer." },
        {
          id: "connected-unknown",
          label: "Connected — you both have a seat; the answers are not both in yet.",
        },
        { id: "sharing", label: "Sharing — the report is open to both of you." },
        /**
         * #619 — both sheets are sealed and the relationship's fee is not settled. The Gap is
         * still shut, so the `sharing` sentence would be false; the sentence says only what the
         * status knows, and the plan and the payment are drawn by the publish panel below it.
         */
        {
          id: "awaiting-payment",
          label:
            "Sharing — both sheets are sealed; the Gap opens when the assessment is published.",
        },
        /**
         * #503 — a session an operator ended. The badge and the sentence are two items because
         * the badge sits beside the title where a stage name would go, and there is no stage name
         * to put there.
         */
        { id: "voided-badge", label: "Voided" },
        {
          id: "voided",
          label:
            "Voided — an operator ended this session, so it takes no more answers. What you both wrote is kept and the report is unchanged.",
        },
      ],
    },
    {
      id: "answer",
      heading: "Answer every Aspect",
      items: [
        {
          id: "body-basic",
          label:
            "Two scores each, from 1 to 5: how it feels now, and how you wish it to be. Your answers are yours alone until you have both submitted.",
        },
        {
          id: "body-advanced",
          label:
            "Four scores each, from 1 to 5: how it feels now, how you wish it to be, how you think they feel, and how you guess they feel. Your answers are yours alone until you have both submitted.",
        },
        { id: "feel", label: "Feel" },
        { id: "wish", label: "Wish" },
        { id: "think", label: "Think" },
        { id: "guess", label: "Guess" },
        { id: "submit", label: "Submit answers" },
        { id: "resubmit", label: "Update answers" },
      ],
    },
    {
      id: "waiting",
      heading: "Waiting for both answers",
      body: "Neither of you can see the other's answers until you have both submitted. Nothing of theirs is shown here — not a score, not a Gap.",
      items: [
        { id: "waiting-for", label: "Still to answer: {names}" },
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
      ],
    },
    {
      id: "report",
      heading: "You have both answered",
      body: "The answers are frozen and the Gap is open to both of you. Nothing here is stored: every Gap is computed from the two scores beside it.",
    },
    /**
     * The confirmation a submit lands on (#t_0aa81144).
     *
     * The submit used to answer with a 303 to this screen and nothing else: the person had answered
     * every Aspect and was handed a form or a blank wait, with no sentence saying their answers
     * were saved, what the other party still had to do, or how to change their mind. This band is
     * drawn *above* the ordinary screen for the one visit the submit created (`?submitted=1`), and
     * only while the report is still closed — once both parties have accepted, the report is the
     * answer and a "thank you, nothing is shown yet" band would be false.
     */
    {
      id: "submitted",
      heading: "Thank you — your answers are saved",
      body: "Nothing you wrote is shown to {other} yet. You will both see the report once you have both answered and accepted.",
      items: [
        {
          id: "waiting",
          label: "What happens next",
          body: "{other} answers the same questions from their side and accepts the session. When both of you have accepted, the report opens for you both.",
        },
        {
          id: "change",
          label: "How to change an opinion",
          body: "Open your answer sheet and change any score before you accept. After you accept, your answers are sealed.",
        },
        { id: "change-link", label: "Open your answer sheet" },
        { id: "session-link", label: "Back to the session" },
        /**
         * The entry point to the acceptance step (#617). The submit used to land here with the
         * sheet and the session and nothing else, and nothing anywhere linked to `/accept` — so a
         * person who had answered every Aspect had no way to accept, and a human-created session
         * could never reach `complete`. This band is drawn for exactly that person: their own sheet
         * is finished and their own acceptance is missing.
         */
        { id: "accept-link", label: "Review and accept this session" },
      ],
    },
    {
      /**
       * The acceptance entry point on the ordinary instance screen (#617).
       *
       * `submitted` covers the visit a submit created; this section covers every later visit — the
       * party who closed the tab, came back from the report link in an email, or answered on one
       * device and opened the screen on another. Both draw their words from here rather than from
       * a literal, so the one sentence that points at `/accept` is authored once.
       *
       * Drawn only while the session is `answering`, the viewer is a party, their sheet is complete
       * and their own acceptance is missing: those are the facts the endpoint itself requires, so
       * the link is offered exactly when the click would be recorded.
       */
      id: "accept",
      heading: "Acceptance is the last step",
      body: "Answering is not accepting. Your sheet is complete — review the session and accept it yourself, and the report opens for both of you once {other} accepts too.",
      items: [
        { id: "accept-link", label: "Review and accept this session" },
        {
          id: "you-accepted",
          label:
            "You accepted this session. The report opens for both of you when {other} accepts too.",
        },
      ],
    },
    {
      /**
       * The Steps panel (#478) — "Steps for Improving the Relationship", ported from the `/v1`
       * prototype's `steps-panel.tsx` into the screen that already stores the rows.
       *
       * Every word is here because the panel is a server component: a tick is a form post, a reword
       * is a `<details>` form, and neither carries a sentence of its own. The two state labels
       * (`Open` / `Done` / `Closed`) are **not** here — they are `STEP_STATUS_LABELS` in
       * `content/steps.ts`, authored once beside the state machine.
       *
       * `progress` divides by `active` (rows that are still work), never by `total`: a closed Step is
       * history and counting it would make a finished plan look half-done. `closed` is a separate
       * sentence because it is a separate fact.
       */
      id: "steps",
      heading: "Steps for Improving the Relationship",
      body: "Each Step comes from the widest Gap on its Aspect in the last session. Tick it off, or reword it into something you will actually do — the suggestion stays beside your words, and the list is kept on this relationship, so it survives a reload.",
      items: [
        { id: "progress", label: "{done} of {active} done" },
        { id: "progress-closed", label: "{closed} closed" },
        { id: "empty", label: "No Steps yet" },
        {
          id: "empty-body",
          label:
            "Steps appear when you both accept a session — each one is derived from the widest Gap on its Aspect, and then kept here so you can mark it done.",
        },
        {
          id: "empty-body-aligned",
          label: "Every Gap on the last session was In Synch, so there is nothing to work on.",
        },
        { id: "mark-done", label: "Mark done: {text}" },
        { id: "mark-open", label: "Mark open: {text}" },
        { id: "suggested", label: "Suggested: {text}" },
        { id: "edit", label: "Edit" },
        { id: "save", label: "Save" },
        { id: "cancel", label: "Cancel" },
        { id: "step-text", label: "Step text" },
        { id: "closed-note", label: "No Gap left on this Aspect; kept as history" },
        { id: "read-only", label: "A coach reads the Steps; only a party ticks them." },
      ],
    },
    {
      /**
       * The two seats, named — the header block `components/my-quizzes/quiz-details.tsx` draws for
       * a quiz's players, translated to a relationship's two parties (#409).
       *
       * `you` marks the seat this request answers as; it is drawn from the role the read resolved,
       * never from a name compared in the view. `unclaimed` is the Counterparty seat before the
       * invitation is claimed — the one state in which a party row does not exist at all, and the
       * honest word for it rather than an empty name.
       *
       * Nothing in this band is a count. A seat's *name* is not a fact about its answers, which is
       * the whole line the blind rule draws: the parties are always legible, and what either of
       * them wrote is not.
       */
      id: "parties",
      heading: "The two seats",
      items: [
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "you", label: "you" },
        { id: "unclaimed", label: "Not claimed yet" },
        { id: "coach", label: "Coach — read-only" },
      ],
    },
    {
      /**
       * #533 phase 3 — the lapse, drawn on both seats. The body names the initiator's membership
       * and the instant from the row, and the item says the part the counterparty needs not to
       * invent: they bought nothing and nothing they did ended it.
       */
      id: "lapsed",
      heading: "The membership behind this relationship ended",
      body: "It ended on {endedAt}. It was the initiator's membership — you did not fail at anything and there is nothing here for you to fix — and until a payment lands this relationship is read-only for both of you: no new answers, no edits, and the invitation no longer works.",
      items: [
        {
          id: "lapsed-note",
          label:
            "Your answers are kept and stay readable. The relationship becomes writable again if the initiator's payment lands.",
        },
      ],
    },
    {
      /**
       * What was paid, for the Initiator alone (#409). Two facts and no arithmetic: the plan and
       * the instant it was bought. A total would be a number nobody was charged — one
       * relationship, one purchase — so there is no item for one here.
       */
      id: "paid",
      heading: "What was paid",
      items: [
        { id: "plan", label: "Plan" },
        { id: "bought", label: "Bought {date}" },
        { id: "nothing", label: "Nothing has been paid on this relationship." },
      ],
    },
    {
      id: "invite",
      items: [
        { id: "sent", label: "Invitation emailed to {email}" },
        // Two ways for a send not to happen, and they are not the same sentence (#220). `unset`
        // is a deployment with no mailer — it may name that fact to an operator, but never the
        // variable, whose name is in the server log. `failed` is a send that was attempted and
        // refused: it says only that, because the cause (a rate limit, an unverified domain, a
        // bad recipient) is not something the reader can see or act on.
        {
          id: "unset",
          label:
            "No email was sent — this deployment has no mail sender configured. Send this link yourself:",
        },
        { id: "failed", label: "The invitation could not be sent. Send this link yourself:" },
        { id: "link-label", label: "Invitation for {counterparty}" },
        // #257 — the copy control beside that link. Three sentences, because there are three
        // things that can happen and only one of them is a success: the link is on the
        // clipboard, the browser refused and the link's text is selected for the reader, or the
        // browser refused *and* the text could not be selected. The last one claims no
        // selection, because a message that says "it is selected now" when it is not is worse
        // than no message — the reader would paste nothing.
        { id: "copy", label: "Copy link" },
        { id: "copy-done", label: "Link copied — paste it into a message to {counterparty}." },
        {
          id: "copy-manual",
          label:
            "Your browser would not let the page copy the link, so it is selected above — press Ctrl+C or ⌘C to copy it.",
        },
        {
          id: "copy-unavailable",
          label:
            "Your browser would not copy the link, and it could not be selected for you — select it above and copy it yourself.",
        },
        { id: "claimed", label: "{counterparty} has claimed the invitation" },
        // #266 — three states, and the two that are not `claimed` name the deadline, because
        // "no invitation has been claimed yet" and "the invitation died last Tuesday" are the
        // same sentence to a reader who cannot see the clock. `expired` is deliberately not
        // silent about the consequence: the link is not drawn in that state (`readFlowScreen`
        // withholds it), so the panel says why there is nothing to send.
        {
          id: "unclaimed",
          label: "{counterparty} has not claimed the invitation yet (it expires {date})",
        },
        {
          id: "expired",
          label:
            "This invitation expired on {date}. The link no longer works — send {counterparty} a new one below.",
        },
        // #275 — the re-invite. One action, and it is revoke-and-replace: the new link is the only
        // live one, so the panel says the old link dies rather than leaving the Initiator to
        // assume two links now work. The budget (`{count} of {cap}`) is drawn because a refusal
        // that arrives as a surprise is the thing the issue's copy guidance forbids; the refusals
        // themselves are below, one item per code in `RESEND_REFUSALS` and keyed by that code, so
        // the panel looks up the sentence the store's refusal named.
        { id: "resend-heading", label: "Send {counterparty} a new invitation" },
        { id: "resend-email", label: "Their email address" },
        { id: "resend-submit", label: "Send a new link" },
        {
          id: "resend-note",
          label:
            "The new link replaces the one in the last email: the old link stops working as soon as you send this.",
        },
        { id: "resend-count", label: "Re-invitations sent: {count} of {cap}" },
        {
          id: "cooldown",
          label:
            "A new invitation went out less than 24 hours ago, so this one was not sent. You can send another a day after that.",
        },
        {
          id: "cap-reached",
          label:
            "This invitation has been sent three times, which is as many as this app allows. Start a new instance with {counterparty} instead.",
        },
        {
          id: "already-claimed",
          label:
            "This invitation has already been claimed, so there is nothing to send again — the link is spent.",
        },
        {
          id: "instance-complete",
          label:
            "Both of you have answered, so this invitation is finished and there is nothing left to send.",
        },
        {
          id: "invalid-email",
          label: "That is not an address a message can be sent to. Check it and send again.",
        },
        { id: "not-initiator", label: "Only the Initiator can send a new invitation." },
        { id: "no-invite", label: "This instance has no invitation to send again." },
      ],
    },
    {
      id: "problems",
      items: [
        {
          id: "frozen",
          label: "You have accepted this session, so an answer cannot be changed.",
        },
        {
          id: "incomplete",
          label:
            "Every Aspect needs a score for every opinion this mode asks — Feel and Wish in Basic Mode, all four in Advanced Mode.",
        },
        { id: "not-a-party", label: "This instance is not yours to answer." },
        { id: "no-such-instance", label: "No instance answers to that link." },
        // #478 — the Steps endpoint's two codes. A tick can name a row this relationship does not
        // hold (`no-such-step`), and a party can write a status the model does not allow (`invalid`).
        { id: "no-such-step", label: "That Step is not on this relationship." },
        { id: "invalid", label: "That change is not one a Step allows." },
        { id: "back", label: "Back to the instance" },
      ],
    },
  ],
});
