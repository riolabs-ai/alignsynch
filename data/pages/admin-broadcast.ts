/**
 * `/admin/broadcast` — the console's one-off notice to the news list (#507, epic #500).
 *
 * Every word on the screen is here, and three of the bands are load-bearing rather than decorative:
 *
 *   - **`key-mode` is a banner, not fine print.** The card's hard rule is that a test key can never
 *     broadcast without the test-mode banner, so the banner is the first thing on the screen and it
 *     has four states — `test`, `captured`, `live`, `unset` — one per mode
 *     `lib/email/key-mode.ts` can resolve. The action refuses on the same value, so the banner is
 *     the explanation of a refusal rather than the refusal itself.
 *   - **`counts` is the dry run in words.** `{count}`, `{hours}` and the cap are placeholders filled
 *     from the read, never authored numbers: a sentence that says "12 addresses" while the read says
 *     11 is the drift the shared audience function exists to prevent, and a fixture that hardcoded
 *     either would reintroduce it in the copy.
 *   - **`refusals` has a row per code.** `lib/admin/broadcast.ts::BROADCAST_REFUSALS` and `act()`'s
 *     own `role-too-low` / `signed-out` each need a sentence a person can act
 *     on; `E23` fails the build if the component asks for an id this file does not carry, so a new
 *     refusal cannot ship as a bare code.
 *
 * The one sentence this fixture does **not** contain is a claim about the recipient list. There is
 * no address on this screen, in any state: the words say "addresses" and the numbers count them.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminBroadcastPageCopy: PageCopy = zPageCopy.parse({
  heading: "Broadcast",
  subtitle:
    "A one-off notice to the people who asked to hear from the product. Compose it, read it as they will, see how many addresses it would reach, and send it. Unsubscribed, bounced and complaining addresses are excluded by the query that builds the audience, not by anything this screen draws.",
  sections: [
    {
      id: "key-mode",
      heading: "What this deployment can send with",
      body: "The mail key decides whether a send leaves this machine. This banner is the same answer the send action reads before it opens a transaction, so what you read here is what the server will do.",
      items: [
        {
          id: "banner-test",
          label:
            "Test mode — this deployment's mail key is a test key, so no broadcast can be sent.",
          body: "The send action refuses a test key before it looks at the audience, whatever this screen draws. Swap the key for a live one, or point the endpoint at a capture server if the point is to prove the path.",
        },
        {
          id: "banner-captured",
          label:
            "Capture mode — mail goes to {endpoint} instead of Resend, so no mailbox receives this.",
          body: "The endpoint override is the documented way to drive the flow without a provider. A send is recorded and the transport answers, and the row it writes says the mode was captured.",
        },
        {
          id: "banner-live",
          label: "Live mode — this send reaches real inboxes.",
          body: "The audience below has consented, no address in it has bounced or complained, and none was mailed inside the cooldown window.",
        },
        {
          id: "banner-unset",
          label: "No mail key is configured on this deployment, so nothing would be sent.",
          body: "A broadcast that reports success and mails nobody is worse than one that says why it did not, so the send action refuses this state.",
        },
      ],
    },
    {
      id: "compose",
      heading: "Compose the notice",
      body: "One subject and one text body. There is no HTML: the message the recipient reads is exactly the text below, which is why the preview is not an approximation.",
      items: [
        { id: "subject", label: "Subject" },
        { id: "subject-placeholder", label: "A sentence a person reads in an inbox" },
        { id: "body", label: "Body" },
        { id: "body-placeholder", label: "What the notice says, in plain text." },
        { id: "segment", label: "Segment" },
        { id: "segment-all", label: "Everyone who has consented" },
        { id: "segment-since", label: "Signed up since a date" },
        { id: "since", label: "Since" },
        { id: "dry-run", label: "Dry run" },
        { id: "sending", label: "Sending…" },
        { id: "send", label: "Send the notice" },
        { id: "role", label: "Signed in as {role}; a broadcast needs {floor}." },
      ],
    },
    {
      id: "preview",
      heading: "As the recipient reads it",
      body: "The subject line and the body, in the order a mail client draws them. Nothing is added at send time.",
      items: [
        { id: "from", label: "From {sender}" },
        { id: "subject-prefix", label: "Subject" },
        { id: "empty", label: "Nothing to preview yet." },
      ],
    },
    {
      id: "counts",
      heading: "Who it would reach",
      body: "The dry run and the send call the same function, so these numbers are the send's numbers. Consent, the cooldown and the cap are applied in that query.",
      items: [
        { id: "send-count", label: "Dry run: {count} address(es) would receive this." },
        { id: "consented", label: "Consented in this segment: {count}" },
        { id: "held", label: "Held by the {hours}-hour cooldown: {count}" },
        { id: "cap", label: "Cap: {count} addresses per send." },
        {
          id: "over-cap",
          label: "Over the cap — narrow the segment, because this send would refuse.",
        },
        { id: "none", label: "No consented address matches this segment." },
        { id: "hash", label: "Body hash {hash}" },
        { id: "idle", label: "Run the dry run to see how many addresses this would reach." },
      ],
    },
    {
      id: "list",
      heading: "The list behind this send",
      body: "Read straight from the news list. An address counts as consented only when it has no unsubscribe, bounce or complaint mark.",
      items: [
        { id: "total", label: "Addresses" },
        { id: "consented", label: "Consented" },
        { id: "unsubscribed", label: "Unsubscribed" },
        { id: "bounced", label: "Bounced" },
        { id: "complained", label: "Complained" },
        { id: "cooling", label: "In cooldown" },
      ],
    },
    {
      id: "sends",
      heading: "What has gone out",
      body: "One row per send: when, what it was called, the segment, how many addresses it went to and the body's hash. The body itself is not stored — the hash is what makes a send auditable without a second copy of it.",
      items: [
        { id: "when", label: "When" },
        { id: "subject", label: "Subject" },
        { id: "segment", label: "Segment" },
        { id: "count", label: "Recipients" },
        { id: "hash", label: "Body hash" },
        { id: "mode", label: "Mail key" },
        { id: "actor", label: "Sent by" },
        { id: "segment-all", label: "All" },
        { id: "segment-since", label: "Since {date}" },
        { id: "empty", label: "Nothing has been sent from this console yet." },
      ],
    },
    {
      id: "done",
      heading: "Sent",
      body: "The send is recorded. The count is the number of addresses the transport took, and the hash is the one the audit row carries.",
      items: [
        { id: "sent", label: "{sent} of {count} messages accepted; {failed} refused." },
        { id: "audit", label: "Audit entry" },
      ],
    },
    {
      id: "unreadable",
      heading: "The news list could not be read",
      body: "This screen has nothing to show and claims nothing: the database did not answer, so neither the counts nor the sends are a measurement.",
      items: [{ id: "reason", label: "Reason: {reason}" }],
    },
    {
      id: "refusals",
      heading: "Why a send was refused",
      items: [
        {
          id: "empty-subject",
          label: "The subject is empty — a notice with no subject line is not a notice.",
        },
        {
          id: "empty-body",
          label: "The body is empty — a notice with nothing in it is not a notice.",
        },
        {
          id: "too-long",
          label: "The subject or the body is longer than this screen sends. Shorten it.",
        },
        {
          id: "invalid-segment",
          label: "That is not a segment this screen offers. Choose everyone, or a date.",
        },
        { id: "invalid-date", label: "That date could not be read. Pick a day from the field." },
        {
          id: "no-recipients",
          label: "No address that has consented matches this segment, so nothing was sent.",
        },
        {
          id: "cooldown",
          label:
            "Every consented address in this segment was mailed inside the cooldown window, so nothing was sent.",
        },
        {
          id: "over-cap",
          label:
            "The segment is larger than the cap. Nothing was sent — narrow it rather than send a prefix.",
        },
        {
          id: "test-key",
          label:
            "This deployment's mail key is a test key. The send was refused before anything was written.",
        },
        {
          id: "no-mail-key",
          label: "No mail key is configured, so the send was refused rather than claimed.",
        },
        {
          id: "role-too-low",
          label: "Your role cannot send a broadcast. A send needs an admin or the owner.",
        },
        { id: "signed-out", label: "You are not signed in any more. Sign in and try again." },
        {
          id: "failed",
          label: "The send could not be completed. Nothing was recorded — the error is in the log.",
        },
      ],
    },
  ],
});
