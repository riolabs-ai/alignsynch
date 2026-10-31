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
        { id: "claimed", label: "{counterparty} has claimed the invitation" },
        { id: "unclaimed", label: "{counterparty} has not claimed the invitation yet" },
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
