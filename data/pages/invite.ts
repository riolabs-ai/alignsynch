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
import { lifecycleStageSection } from "./lifecycle";

export const invitePageCopy: PageCopy = zPageCopy.parse({
  heading: "You have been invited",
  subtitle: "{initiator} wants to compare notes with you on {template}.",
  sections: [
    /**
     * The six stage names, **referenced, never re-typed** (#710). The response path renders inside
     * the flow's modal under the same rail every other stage draws, and `StageRail` asks for this
     * section — so the invitation's fixture carries the one shared home rather than a second copy
     * of `Details · Settings · Aspects · Invite · Connect · Align`.
     */
    lifecycleStageSection,
    {
      id: "viewer",
      heading: "You already have a seat in this relationship",
      items: [
        { id: "initiator", label: "You are answering as {name}, the Initiator." },
        { id: "counterparty", label: "You are answering as {name}, the Counterparty." },
      ],
    },
    {
      id: "claim",
      body: "You answer every Aspect first. You will not see their answers, and they will not see yours, until you have both accepted the session — and after that, the answers are frozen.",
      items: [
        { id: "join", label: "You are joining as {counterparty}, the Counterparty." },
        { id: "free", label: "Accepting costs you nothing — {initiator} is the one who pays." },
        { id: "name", label: "Your name" },
        { id: "email", label: "Your email" },
        // The field's example lives in the fixture like every other string the screen prints:
        // a literal placeholder in a component is copy that cannot be reviewed with the rest (E23).
        { id: "email-placeholder", label: "name@example.com" },
        { id: "claim", label: "Accept and answer" },
      ],
    },
    /**
     * The three onboarding screens are **retired** (#1115 task 4). `step-1` / `step-2` / `step-3`
     * said what the product was, what would happen next, and which account to create; the owner's
     * rule for this side of the flow is two fields and one screen, so the `claim` section above is
     * the whole surface. The copy is deleted rather than kept "for reference": a fixture row no
     * surface reads is a second, drifting description of a screen that does not exist. The one
     * sentence worth keeping — "your answers are yours alone until you have both submitted" —
     * already lives on `data/pages/assessment-instance.ts`, where the answers are given.
     */
    {
      id: "claimed",
      heading: "This invitation was used already",
      body: "An invitation works once. Ask {initiator} to start a new relationship with you.",
    },
    {
      id: "expired",
      heading: "This invitation has expired",
      body: "Invitations last seven days. Ask {initiator} to send you a new one.",
    },
    {
      /**
       * #533 phase 3 — the membership ended. A fourth fact, and a different sentence from
       * `expired` (the link's own seven days) and `revoked` (an operator's decision): the link is
       * fine, the *product* is not being paid for, and a new link would not help. The last sentence
       * is load-bearing — the person reading this was invited, they bought nothing, and the card
       * says they must not read the lapse as their own failure.
       */
      id: "lapsed",
      heading: "This invitation is no longer active",
      body: "It was sent by {initiator} for {template}. That membership has ended, so the relationship is read-only for both of them and this invitation cannot be accepted. Nothing you did ended it.",
      items: [
        /**
         * The instant, from the row (`relationship.expired_at` or the subscription's period end).
         * Its own item rather than a clause in the body because a relationship whose lapse no row
         * dates still has to read as a sentence — the band is drawn either way.
         */
        { id: "ended", label: "The membership ended on {endedAt}." },
      ],
    },
    {
      /**
       * #503 — an operator withdrew the link. A different sentence from `expired` because it is a
       * different fact: nothing ran out, somebody decided, and "ask for a new one" is a request to
       * the team rather than to the other party.
       */
      id: "revoked",
      heading: "This invitation was withdrawn",
      body: "The link was cancelled before it was used. If you were expecting it, reply to whoever sent it to you.",
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
            "Nothing was claimed: this browser already answers as one of the two parties to this relationship, so this invitation is not yours to take. The link is still unused.",
        },
        {
          id: "already-bound",
          label:
            "This relationship already has both parties, so there is no seat left to claim. Ask {initiator} to start a new relationship with you.",
        },
        {
          id: "unconfirmed",
          label:
            "Nothing was claimed: the claim did not confirm joining as {counterparty}. Send it again with the name the invitation carries.",
        },
        /**
         * #1115 task 4 — the two-field claim's own refusal. The link is fine and the seat is free;
         * the address is not the one the invitation was sent to, which is the one fact that ties
         * the seat to a person now that no password is asked for.
         */
        {
          id: "email-mismatch",
          label:
            "Nothing was claimed: this invitation was sent to a different address. Ask {initiator} to resend it to yours.",
        },
        /**
         * #533 phase 3 — the link is fine, the membership is not. Its own sentence because the
         * advice differs: a new link cannot help, and the person who can fix it is the initiator.
         */
        {
          id: "lapsed",
          label:
            "Nothing was claimed: the initiator's membership ended, so this relationship is read-only for both of them and the invitation cannot be accepted. Ask {initiator} to get in touch once their subscription is running again.",
        },
      ],
    },
  ],
});
