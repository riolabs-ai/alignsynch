/**
 * `/assessment/instances/[instanceId]/sent` — the create flow's stage 5, **Connect** (#691,
 * named by #735).
 *
 * The screen the commit lands on: what happens next, who was invited, the invitation's own state,
 * and the way into the relationship. Every word is here, and the two bands the screen shares with
 * other surfaces are *referenced*, not copied:
 *
 *   `stages`   `data/pages/lifecycle.ts` — the six names the rail above this screen draws. A stage
 *              screen that mounts `StageRail` must carry this section, because E23 resolves the ids
 *              a reachable file asks for against *this* surface's fixture.
 *   `invite`   `data/pages/assessment-instance.ts` — one invitation's vocabulary: the state
 *              sentences, the resend form's four labels, its refusals and the copy control's three
 *              outcomes. The relationship screen and this one draw the same row, so the words are
 *              one home rather than two.
 *
 * The two bands authored here are the ones only this screen has: `status` (the one sentence naming
 * where the invitation stands — the four `inviteStateOf()` states plus `none`, the absent row) and
 * `timeline` (the variation: the invitation as three moments, not
 * as a status word). The owner's sentences are the artifact's — `s9.*` in
 * `docs/review/artifacts/prototype-relationship-lifecycle-v5.html` — with `{counterparty}` and
 * `{date}` where the prototype typed Rowan's name and the day.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { inviteBandSection } from "./assessment-instance";
import { lifecycleStageSection } from "./lifecycle";

export const assessmentSentPageCopy: PageCopy = zPageCopy.parse({
  heading: "Invitation sent",
  subtitle:
    "{counterparty} has an email with one link. The relationship waits at Invited until they accept.",
  sections: [
    lifecycleStageSection,
    {
      /**
       * The state line. One sentence per derived state — `inviteStateOf()` answers `unclaimed`,
       * `expired`, `claimed` or `revoked` and this band has exactly those four — plus the address
       * the invitation went to, which is a fact about the row and not a sentence about the state.
       *
       * `none` is the fifth, and it is not derived from a row: `session_invite` holding nothing for
       * the session is a legitimate state (#976), and `SentState` asks for it by name. It says the
       * invitation was never created rather than borrowing `unclaimed`, because "the link has not
       * been claimed" and "there is no link" are different facts.
       */
      id: "status",
      items: [
        { id: "unclaimed", label: "Invited — waiting for {counterparty} to accept" },
        { id: "claimed", label: "Accepted — {counterparty} claimed the invitation" },
        { id: "expired", label: "Expired — the invitation ran out before it was claimed" },
        { id: "revoked", label: "Withdrawn — the invitation was cancelled before it was used" },
        { id: "none", label: "Not sent — no invitation was created for this relationship yet" },
        { id: "email", label: "Sent to {email}" },
      ],
    },
    {
      /**
       * The timeline — the variation this card adds to the template. Three moments, each keyed by
       * the fact that decides its wording, because "waiting", "expired" and "withdrawn" are three
       * different answers to the same question and a screen that showed one label for all of them
       * would be drawing a status word rather than a history.
       *
       * No clock is read here: `sentAt` and `claimedAt` are the row's own instants and
       * `expiresAt` is the deadline the claim compares against — the view dates them with
       * `formatDate()`, which is a pure function of the ISO value.
       */
      id: "timeline",
      heading: "The invitation",
      body: "One link, three moments. The seat is filled the moment it is claimed — nothing on this screen waits on anything else.",
      items: [
        { id: "label", label: "Invitation timeline" },
        { id: "sent", label: "Sent {date}" },
        { id: "sent-undated", label: "Sent" },
        { id: "waiting", label: "Waiting for {counterparty} — the link expires {date}" },
        { id: "waiting-pending", label: "Waiting for the invitation to be claimed" },
        { id: "waiting-claimed", label: "{counterparty} claimed the link" },
        { id: "waiting-expired", label: "The link expired {date} before it was claimed" },
        { id: "waiting-revoked", label: "The link was withdrawn before it was claimed" },
        { id: "accepted", label: "Accepted {date}" },
        { id: "accepted-pending", label: "Acceptance — not yet" },
      ],
    },
    {
      id: "next",
      heading: "What happens next",
      items: [
        { id: "1", label: "They accept, and the seat is filled." },
        { id: "2", label: "You both answer the same {count} Aspects." },
        { id: "3", label: "When both sheets are sealed, the report opens to both of you." },
      ],
    },
    {
      /**
       * The door into stage 6. One primary control, and the sentence under it says what the
       * relationship screen is — the Sent screen is a state, not the place the relationship lives.
       */
      id: "go",
      heading: "Where to go next",
      body: "The relationship is kept at Invited. The report opens to both of you the moment both sheets are sealed.",
      items: [
        { id: "open", label: "Open the relationship" },
        { id: "note", label: "Your dashboard holds this relationship from here on." },
        {
          id: "browser-note",
          label:
            "You are not signed in, so this relationship lives in this browser until you sign in.",
        },
      ],
    },
    inviteBandSection,
  ],
});
