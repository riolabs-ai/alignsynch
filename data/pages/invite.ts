/**
 * `/invite/[token]` — the Counterparty's claim page (#146, #202).
 *
 * The page only *shows* the invitation. Claiming is a POST to
 * `/invite/[token]/claim`, and that split is the point: the token is single-use, and a GET
 * that consumed it would be consumed by the first thing that fetches the link — a mail
 * client's link preview, a scanner, a browser prefetch — leaving the person it was sent to
 * holding a dead invitation. So the GET is inert and the button is the one claim.
 *
 * `state` comes from `previewInvite()` and is one of four: `claimable`, `claimed`,
 * `expired`, `unknown`. Each has its own band, so a refusal is a sentence rather than a
 * status code in a tab.
 *
 * Two more bands are about the *request* rather than the token (#202):
 *
 *   viewer      which party this browser already answers as, named on every visit. The
 *               defect this card fixes was silent: an Initiator who opened their own link
 *               spent it and their session became the Counterparty, and nothing on screen
 *               said so. A sentence that is always drawn cannot be missed.
 *   refusals    why a claim was refused for a reason the token's state does not explain —
 *               already-a-party, already-bound, unconfirmed. One item per code in
 *               `CLAIM_REFUSALS` whose meaning is not the token's (`lib/flow/claim.ts`).
 *
 * `claim` carries the confirmation: `join` is the sentence naming the party being joined and
 * `confirm` is the checkbox's own label. The checkbox's *value* is the counterparty's name,
 * which is the string the store compares — so the post says out loud who it is joining.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const invitePageCopy: PageCopy = zPageCopy.parse({
  heading: "You have been invited",
  subtitle: "{initiator} wants to compare notes with you on {template}.",
  sections: [
    {
      id: "viewer",
      heading: "You already have a seat in this instance",
      items: [
        { id: "initiator", label: "You are answering as {name}, the Initiator." },
        { id: "counterparty", label: "You are answering as {name}, the Counterparty." },
      ],
    },
    {
      id: "claim",
      body: "You answer every Aspect first. You will not see their answers, and they will not see yours, until you have both submitted — and after that, the answers are frozen.",
      items: [
        { id: "join", label: "You are joining as {counterparty}, the Counterparty." },
        { id: "confirm", label: "I am {counterparty}, and I am joining as the Counterparty." },
        { id: "claim", label: "Accept and answer" },
      ],
    },
    {
      id: "claimed",
      heading: "This invitation was used already",
      body: "An invitation works once. Ask {initiator} to start a new instance with you.",
    },
    {
      id: "expired",
      heading: "This invitation has expired",
      body: "Invitations last seven days. Ask {initiator} to send you a new one.",
    },
    {
      id: "unknown",
      heading: "No such invitation",
      body: "This link does not name an invitation. Check that it was copied whole.",
    },
    {
      id: "refusals",
      items: [
        {
          id: "already-a-party",
          label:
            "Nothing was claimed: this browser already answers as one of the two parties to this instance, so this invitation is not yours to take. The link is still unused.",
        },
        {
          id: "already-bound",
          label:
            "This instance already has both parties, so there is no seat left to claim. Ask {initiator} to start a new instance with you.",
        },
        {
          id: "unconfirmed",
          label:
            "Nothing was claimed: the claim did not confirm joining as {counterparty}. Tick the box below and send it again.",
        },
      ],
    },
  ],
});
