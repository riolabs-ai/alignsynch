/**
 * `/dashboard/relationships/[id]` — one relationship the member started (#533 phase 2).
 *
 * The screen has four bands, and which of them renders is `publishViewOf()`'s answer — one value
 * derived from the stored status, the invitation row and the instant the page rendered, never four
 * conditionals that could disagree:
 *
 *   status     what the relationship is (`draft`, `pending`, `published`, …) and what the
 *              invitation is doing (`live`, `expired`, `claimed`, `revoked`, `missing`)
 *   aspects    the Aspect editor, while the relationship is `draft`/`pending` — the initiator's
 *              alone, and refused by the server action rather than hidden from the counterparty
 *   publish    the counterparty's name and address, the reason, and the one button that starts the
 *              trial (or opens a checkout), publishes the relationship and mints the invitation
 *   republish  the one-click reissue a lapsed or revoked link gets — no Aspects re-entered
 *
 * **The trial sentence.** #533 requires the screen to say plainly when a trial is running and no
 * invitation is live (`trial-running-no-invite`). That is a real state — the member paid for a
 * link that lapsed — and leaving it to be inferred from two columns is how a person concludes the
 * product took their money and stopped.
 *
 * **No configuration is shown to a counterparty, and no button is the enforcement.** The editor is
 * not rendered unless `aspectsEditable(status)`; the server action checks ownership inside its
 * transaction and answers `not-yours` to anyone else. Hiding the form is a courtesy, not a rule.
 *
 *   link       the invitation link, shown **once** after it is minted (a token is never stored, so
 *              a reload cannot reproduce it — the copy says so)
 *   closed     a terminal relationship: nothing more happens to it here
 *   unreadable the database did not answer
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardRelationshipDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "Relationship",
  subtitle:
    "Its Aspects are yours to change until you publish. Publishing starts your fourteen-day trial (or a checkout), opens the session and mints an invitation good for seven days.",
  items: [
    { id: "status", label: "State" },
    { id: "aspects", label: "Aspects" },
    { id: "started", label: "Started" },
    { id: "published", label: "Published" },
    { id: "invited", label: "Invited" },
    { id: "trial", label: "Trial ends" },
    { id: "none", label: "—" },
  ],
  sections: [
    {
      id: "status",
      heading: "State",
      items: [
        { id: "draft", label: "Draft" },
        { id: "pending", label: "Ready to publish" },
        { id: "published", label: "Published" },
        { id: "active", label: "Running" },
        { id: "complete", label: "Complete" },
        { id: "void", label: "Void" },
        { id: "expired", label: "Expired" },
      ],
    },
    {
      id: "view",
      heading: "Where this stands",
      body: "A draft is yours alone. A published relationship has an invitation out; the pair is working on it once the other person joins.",
      items: [
        { id: "not-published", label: "Not sent yet — nothing has been invited or charged." },
        { id: "invite-live", label: "Published. The invitation link is live." },
        { id: "invite-expired", label: "Published. The invitation link has expired." },
        { id: "invite-claimed", label: "Published. The other person has joined." },
        { id: "invite-revoked", label: "Published. An operator revoked the invitation link." },
        {
          id: "invite-missing",
          label: "Published with no invitation row — that is a defect; support can repair it.",
        },
        {
          id: "trial-running-no-invite",
          label:
            "Your trial is running and no invitation is live. Reissue the link below — publishing again is one click and does not re-enter the Aspects.",
        },
      ],
    },
    {
      id: "aspects",
      heading: "Aspects",
      body: "One question per row, answered by both of you on the 1..5 band. They are editable until the relationship is published, and only by the person who started it — the other side never sees this screen's configuration.",
      items: [
        { id: "prompt", label: "What is asked" },
        { id: "left", label: "Left Value (1)" },
        { id: "right", label: "Right Value (5)" },
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove" },
        { id: "up", label: "Move up" },
        { id: "down", label: "Move down" },
        { id: "reason", label: "Reason" },
        { id: "save-draft", label: "Save the draft" },
        { id: "save-pending", label: "Save and mark ready" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Saved at status {status}. Audit action {actionId}." },
      ],
    },
    {
      id: "publish",
      heading: "Publish",
      body: "The invitation needs the other person's name — it is what they are asked to confirm — and an address to send it to. Publishing starts your fourteen-day trial if you have none, or opens a checkout if your trial has already been used; either way the relationship is published and the link minted in one action.",
      items: [
        { id: "name", label: "Their name" },
        { id: "email", label: "Their email" },
        { id: "reason", label: "Reason" },
        { id: "submit", label: "Publish and invite" },
        { id: "publishing", label: "Publishing…" },
        { id: "expiry", label: "The invitation expires {instant}." },
        { id: "checkout", label: "A checkout has to complete first." },
      ],
    },
    {
      id: "republish",
      heading: "Reissue the invitation",
      body: "One click: a new token on the same invitation row, a new seven-day window, and the old link stops working. Nothing about the Aspects changes, and the relationship stays published.",
      items: [
        { id: "reason", label: "Reason" },
        { id: "submit", label: "Reissue the link" },
        { id: "working", label: "Reissuing…" },
        { id: "reissued", label: "Reissued. The new link expires {instant}." },
      ],
    },
    {
      id: "link",
      heading: "The invitation link",
      body: "Shown once, when it is minted: only a hash of the token is stored, so this page cannot reprint it. Copy it now, or reissue the invitation for a new one.",
      items: [{ id: "copy", label: "Copy the link" }],
    },
    {
      id: "closed",
      heading: "This relationship is closed",
      body: "Nothing more happens to a relationship in this state. Starting a new one is a new relationship with its own invitation.",
    },
    {
      id: "refusals",
      items: [
        { id: "not-yours", label: "This relationship belongs to another account." },
        { id: "no-such-relationship", label: "That relationship is not in this database." },
        { id: "not-editable", label: "Its Aspects are fixed once it has been published." },
        { id: "not-publishable", label: "It cannot be published from its current state." },
        {
          id: "trial-already-running",
          label:
            "A trial is already running on this account. It has to end before another one starts.",
        },
        { id: "invalid-counterparty", label: "The invitation needs a name and a real address." },
        { id: "invalid-draft", label: "The model refused these Aspects — check each field." },
        { id: "no-invite", label: "There is no invitation on this relationship to reissue." },
        {
          id: "invite-live",
          label: "The invitation link is still live — there is nothing to reissue.",
        },
        { id: "checkout-required", label: "A checkout has to complete first." },
        { id: "reason-too-short", label: "A reason of at least eight characters is required." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The change did not go through." },
      ],
    },
    {
      id: "unreadable",
      heading: "This relationship could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
