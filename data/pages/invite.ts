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
      body: "You answer every Aspect first. You will not see their answers, and they will not see yours, until you have both accepted the session — and after that, the answers are frozen.",
      items: [
        { id: "join", label: "You are joining as {counterparty}, the Counterparty." },
        { id: "confirm", label: "I am {counterparty}, and I am joining as the Counterparty." },
        { id: "claim", label: "Accept and answer" },
      ],
    },
    /**
     * The onboarding wizard's three steps (#t_0aa81144).
     *
     * Before this, the claim dropped the Counterparty straight into the session: no sentence said
     * who had invited them, what was about to happen, or why they were suddenly being asked for
     * scores. Each step is one screen with one question answered, and the `steps` band is the
     * "where am I" rail above it — the same numbered, one-screen-per-step shape
     * `components/create/quiz-editor.tsx` gives the template author.
     *
     * The copy never says the Counterparty pays, because they never do: `free` says who does.
     */
    {
      id: "steps",
      items: [
        { id: "1", label: "What this is" },
        { id: "2", label: "What happens next" },
        { id: "3", label: "Your account" },
        /** The rail's accessible name — a nav landmark among several on the screen. */
        { id: "label", label: "Onboarding steps" },
        { id: "count", label: "Step {step} of 3" },
        { id: "back", label: "Back" },
        { id: "next", label: "Continue" },
      ],
    },
    {
      id: "step-1",
      heading: "What this is",
      body: "Someone you know wants to compare notes with you. It takes a few minutes, and nothing you write is shown to them until you have both finished.",
      items: [
        { id: "invited-by", label: "{initiator} invited you to answer {template}." },
        {
          id: "they-see",
          label:
            "They answer the same questions from their side. They never see your answers before you submit, and you never see theirs.",
        },
        {
          id: "you-see",
          label:
            "You see the questions and your own answers. When you have both finished, you both see the report.",
        },
      ],
    },
    {
      id: "step-2",
      heading: "What happens next",
      body: "Three things happen in order, and you can stop after any of them.",
      items: [
        {
          id: "you-answer",
          label: "You answer every question: how it feels now, and how you wish it to be.",
        },
        { id: "they-answer", label: "{initiator} answers the same questions from their side." },
        {
          id: "report",
          label:
            "When you have both answered and accepted, the report opens for both of you: every gap, computed from the two answers.",
        },
        {
          id: "editable",
          label:
            "You can change any opinion until you accept the session. After you accept, your answers are sealed.",
        },
      ],
    },
    {
      id: "step-3",
      heading: "Your account",
      body: "The answers are tied to an account so you can come back to them. If you are already signed in, this is the last step.",
      items: [
        { id: "free", label: "Accepting costs you nothing — {initiator} is the one who pays." },
        { id: "signed-in", label: "You are signed in as {name}." },
        { id: "sign-in", label: "Sign in to accept {initiator}'s invitation" },
        { id: "register", label: "Create an account" },
        { id: "accept", label: "Accept the invitation" },
        { id: "confirm", label: "I am {counterparty}, and I am joining as the Counterparty." },
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
