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
 * `unlock-email` is the one message this screen's flow *sends* (#258) — the notice the other
 * party gets when a submit makes the instance `complete`. The words live here, beside the report
 * they announce, and not in `lib/flow/`; the sender fills `{other}`, `{recipient}`,
 * `{template}` and `{link}` through `fillLabel()`. It deliberately has no score, no Gap value
 * and no token-shaped placeholder to fill: the blind rule does not stop at the browser, so the
 * email names the instance and links to it, and the numbers stay behind the party cookie.
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
    {
      id: "unlock-email",
      items: [
        { id: "subject", label: "{other} has answered {template}" },
        {
          id: "body",
          label:
            "Hi {recipient},\n\n{other} has answered their side of {template}, and so have you. Every Aspect now has both answers, so the Gap is open to you both.\n\nOpen the instance: {link}\n\nThe answers are frozen now — neither of you can change one. Open it to read the Gap.",
        },
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
          label: "Both of you have submitted, so an answer cannot be changed.",
        },
        {
          id: "incomplete",
          label:
            "Every Aspect needs a score for every opinion this mode asks — Feel and Wish in Basic Mode, all four in Advanced Mode.",
        },
        { id: "not-a-party", label: "This instance is not yours to answer." },
        { id: "no-such-instance", label: "No instance answers to that link." },
        { id: "back", label: "Back to the instance" },
      ],
    },
  ],
});
