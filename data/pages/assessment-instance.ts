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
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentInstancePageCopy: PageCopy = zPageCopy.parse({
  heading: "Your instance",
  sections: [
    {
      id: "answer",
      heading: "Answer every Aspect",
      body: "Two scores each, from 1 to 5: how it feels now, and how you wish it to be. Your answers are yours alone until you have both submitted.",
      items: [
        { id: "feel", label: "Feel" },
        { id: "wish", label: "Wish" },
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
        {
          id: "unsent",
          label: "No email was sent — RESEND_API_KEY is not set. Send this link yourself:",
        },
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
          label: "Every Aspect needs both scores — how it feels now, and how you wish it to be.",
        },
        { id: "not-a-party", label: "This instance is not yours to answer." },
        { id: "no-such-instance", label: "No instance answers to that link." },
        { id: "back", label: "Back to the instance" },
      ],
    },
  ],
});
