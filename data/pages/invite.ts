/**
 * `/invite/[token]` — the Counterparty's join (#146, #202, #1125).
 *
 * The page only *shows* the invitation. Claiming is a POST to `/invite/[token]/claim`, and that
 * split is the point: the token is single-use, and a GET that consumed it would be consumed by the
 * first thing that fetches the link — a mail client's link preview, a scanner, a browser prefetch —
 * leaving the person it was sent to holding a dead invitation. So the GET is inert and the claim is
 * the one acceptance.
 *
 * **Three steps, and this fixture is all of their words** (#1125). The surface ports
 * `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/counterparty-join.html`: a three-dot
 * stepper over `Invite` · `Join` · `Accept`, exactly one primary action per step, and no plan, price,
 * trial, card or extension anywhere on the way (spec US-2). The sections below are those steps, in
 * order, plus the bands a visitor sees when the invitation is not theirs to take:
 *
 *   `steps`        the stepper's three words and its count ("Step {step} of 3")
 *   `invitation`   step 1 — who invited them, the goal, both party cards, the Aspects, How It Works,
 *                  the two reassurances, `Join {initiator}`, and the quiet decline
 *   `account`      step 2 — the two fields, and the sentences that say what they are for
 *   `accept`       step 3 — one acceptance, and the optional suggestion that rides with it
 *   `declined`     the screen after "Decline the invitation"
 *
 * `state` comes from `previewInvite()` and is one of `claimable`, `claimed`, `expired`, `unknown`,
 * `revoked`, `declined`, `lapsed`. Each has its own band, so a refusal is a sentence rather than a
 * status code in a tab.
 *
 * Two more bands are about the *request* rather than the token (#202):
 *
 *   viewer      which party this browser already answers as, named on every visit. The defect that
 *               card fixed was silent: an Initiator who opened their own link spent it and their
 *               session silently became the Counterparty, and nothing on screen said so. A sentence
 *               that is always drawn cannot be missed.
 *   refusals    why a claim was refused for a reason the token's state does not explain —
 *               already-a-party, already-bound, unconfirmed, email-mismatch. One item per code in
 *               `CLAIM_REFUSALS` whose meaning is not the token's (`lib/flow/claim.ts`).
 *
 * `{initiator}`, `{counterparty}`, `{template}`, `{title}`, `{count}` and `{step}` are the record's
 * own facts, so the same page reads correctly for any pair. Label rules: Title Case, no ending period
 * on a heading, a period on a sentence.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const invitePageCopy: PageCopy = zPageCopy.parse({
  heading: "You have been invited",
  subtitle: "{initiator} wants to compare notes with you on {template}.",
  sections: [
    {
      /**
       * The stepper (#1125). Three words and a count, and nothing else: the join has no stage rail and
       * no `Stage n of 5` — that is the Initiator's wizard, and the Counterparty's path is its own
       * shape (bundle 02). `{step}` is the position the reader is on, printed as "Step 2 of 3".
       */
      id: "steps",
      body: "Step {step} of 3",
      items: [
        { id: "1", label: "Invite" },
        { id: "2", label: "Join" },
        { id: "3", label: "Accept" },
        // The one word both back controls share; the bundle draws "Back" on steps 2 and 3.
        { id: "back", label: "Back" },
        // The stepper's accessible name. A screen reader reads it, so it is copy and it lives here
        // rather than in the component (E23 counts a literal there, `aria-*` or not).
        { id: "aria", label: "Join steps" },
      ],
    },
    {
      /**
       * Step 1 — the invitation itself. Every line here answers a question the invitee actually asks:
       * who is this from, what is it about, what will I be asked, and what does it cost me. The last
       * one is answered by `coverage` and has to be, because the honest answer is "nothing" and the
       * bundle draws the Counterparty's freedom from price as a design rule (spec US-2).
       */
      id: "invitation",
      heading: "{initiator} invited you to align on {title}",
      items: [
        { id: "eyebrow", label: "Invitation" },
        {
          id: "how",
          label:
            "You each answer the same {count} Aspects on your own, then see where you agree and where you differ.",
        },
        // The figure's caption. The band quotes the template's own summary, so the caption names the
        // template — never the Initiator, whose words this is not (see `InvitePreview`).
        { id: "goal-caption", label: "{template}" },
        { id: "role-initiator", label: "Initiator" },
        { id: "role-counterparty", label: "Counterparty" },
        { id: "you", label: "(You)" },
        { id: "aspects-heading", label: "The {count} Aspects" },
        { id: "aspects-badge", label: "Preview" },
        { id: "how-heading", label: "How It Works" },
        { id: "mode", label: "Mode" },
        {
          id: "mode-basic",
          label:
            "Basic. You each answer twice per Aspect: how it is now (Feel) and how you’d like it (Wish). About 3 minutes.",
        },
        {
          id: "mode-advanced",
          label:
            "Advanced. You each answer four times per Aspect: how it is now (Feel), how you’d like it (Wish), and how you guess the other feels and wishes. About 6 minutes.",
        },
        { id: "setting", label: "Alignment Tolerance" },
        { id: "setting-soft", label: "Soft. Answers one step apart still count as aligned." },
        { id: "setting-full", label: "Full. Only identical answers count as aligned." },
        { id: "coverage-strong", label: "You’re never charged." },
        { id: "coverage", label: "{initiator} covers this relationship." },
        { id: "privacy-strong", label: "Your answers stay private" },
        { id: "privacy", label: "until you both share." },
        { id: "join", label: "Join {initiator}" },
        { id: "decline", label: "Not for you? Decline the invitation" },
      ],
    },
    {
      /**
       * Step 2 — the account, in **two fields** (#1115 US-2, #1125). The name is prefilled from the
       * invitation; the address is the one the invitation was sent to, and it is what the seat binds
       * to. No password is asked for: the invitation's own address is the credential, and a third
       * field is the friction this whole path exists to remove.
       */
      id: "account",
      heading: "Create Your Account",
      body: "Use the email {initiator} invited, so they know it’s you.",
      items: [
        { id: "name", label: "Name" },
        { id: "email", label: "Email" },
        { id: "email-hint", label: "From {initiator}’s invite." },
        { id: "create", label: "Create Account" },
        // The two ways a step-2 submit is not carried (`lib/flow/join-details.ts`). Two sentences,
        // because "you have not filled this in" and "that is not an address" are different fixes.
        {
          id: "problem-incomplete",
          label: "Add your name and the email this invitation was sent to.",
        },
        {
          id: "problem-email",
          label: "That email address is missing something — check it and try again.",
        },
      ],
    },
    {
      /**
       * Step 3 — the acceptance, and the one optional thing on the whole path: a suggestion about the
       * Aspects. It **sends a suggestion only** — the sentence beside the button says so, and nothing
       * on this path can edit an Aspect (`lib/flow/store.ts::claimInvite` writes no item).
       */
      id: "accept",
      heading: "Accept the Invitation",
      body: "You join {title} as the Counterparty. When you accept, Stage 6 goes live for both of you and your first Assessment opens.",
      items: [
        { id: "accept", label: "Accept Invitation" },
        { id: "suggest", label: "Suggest a Change to the Aspects" },
        { id: "optional", label: "(optional)" },
        { id: "aspect", label: "Aspect" },
        { id: "aspect-all", label: "All Aspects" },
        { id: "suggestion", label: "Your Suggestion" },
        { id: "suggestion-placeholder", label: "For example: add one about holidays" },
        {
          id: "suggest-note",
          label:
            "Sent to {initiator} with your acceptance. The Aspects stay as they are unless they change them.",
        },
      ],
    },
    {
      /**
       * After "Decline the invitation" (#1125). Reason capture is deliberately absent: the issue sends
       * it to DESIGN-NOTES §12 Q3, which is open, and the bundle's reason field is the part of that
       * screen the issue excludes. So the screen states the fact and offers the door.
       */
      id: "declined",
      heading: "Invitation Declined",
      body: "{initiator} will see that you said no thanks. The link no longer works.",
      items: [{ id: "done", label: "Done" }],
    },
    {
      id: "viewer",
      heading: "You already have a seat in this relationship",
      items: [
        { id: "initiator", label: "You are answering as {name}, the Initiator." },
        { id: "counterparty", label: "You are answering as {name}, the Counterparty." },
      ],
    },
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
       * #533 phase 3 — the membership ended. A fourth fact, and a different sentence from `expired`
       * (the link's own seven days) and `revoked` (an operator's decision): the link is fine, the
       * *product* is not being paid for, and a new link would not help. The last sentence is
       * load-bearing — the person reading this was invited, they bought nothing, and the card says
       * they must not read the lapse as their own failure.
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
