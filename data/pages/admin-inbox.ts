/**
 * `/admin/inbox` — the support inbox (#506), as words.
 *
 * The fixture is the shape of the screen, band for band:
 *
 *   list        the queue's column labels, its five status words, its filter tabs, its empty
 *               states and the sentence that says the list is truncated
 *   message     one message's facts — who, when, which status, which seat, when it was answered
 *   delivery    what the mail provider says about the address, and **why it matters**: `bounced`
 *               and `complained` are the two states a send is refused in
 *   throttle    the public form's per-address budget, seen from the inbox — the card's fourth
 *               acceptance item, and the one an operator would otherwise have to guess at
 *   thread      the conversation: the person's message, every reply, and the state each reply is
 *               in (`sending`, `sent`, `failed` with the provider's own words)
 *   reply       the reply form: the body, the reason, the button and the two outcomes
 *   triage      the status form
 *   assign      the seat form
 *   refusals    one sentence per refusal code, so a refusal is a sentence and never the server's
 *               diagnostic text
 *   reply-email the words the *person* receives — the one band in this file whose reader is not an
 *               operator. `lib/contact/reply.ts` fills it, like the invitation email fills its own
 *   unreadable  the database did not answer
 *
 * **The status words are the schema's.** `0028`'s CHECK lists `new | open | waiting | closed`, and
 * the ids here are those literals: the screen maps a status onto its sentence by the same word the
 * column stores, so a fifth status cannot be rendered in a fourth style. `waiting` says what the
 * card means by it — a reply the provider did not accept — rather than "waiting for the customer",
 * which is what the word would mean in a mailbox and is not what the column records.
 *
 * **No address is authored here.** Every sentence in this fixture is a label; the addresses,
 * names and message bodies on the screen are rows read from `contact_message`, under a gate that
 * answers a `member` with the 404 a URL that never existed returns. The owner rule is "no email
 * address on any public page, ever" — this fixture is never rendered on one, and the surface's
 * `requireRole("support")` is what makes that checkable rather than promised.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminInboxPageCopy: PageCopy = zPageCopy.parse({
  heading: "Support inbox",
  subtitle:
    "Every message a visitor sent from the contact form, the provider's verdict on their address, and the throttle they may have hit. Answering one sends it through the site's own mail identity and records the attempt — a refusal stays on the message rather than disappearing.",
  sections: [
    {
      id: "list",
      heading: "The queue",
      body: "Newest first. Selecting a message opens its thread below the list; the status is the queue's own word, and every change to it is written to the audit log with your reason.",
      items: [
        { id: "column-message", label: "Message" },
        { id: "column-status", label: "Status" },
        { id: "column-replies", label: "Replies" },
        { id: "column-seat", label: "Seat" },
        { id: "column-received", label: "Received" },
        { id: "status-new", label: "New" },
        { id: "status-open", label: "Open" },
        { id: "status-waiting", label: "Waiting" },
        { id: "status-closed", label: "Closed" },
        { id: "throttled", label: "Throttled" },
        { id: "chip-bounced", label: "Bounced" },
        { id: "chip-complained", label: "Complained" },
        { id: "empty", label: "No message has been sent from the contact form yet." },
        { id: "unassigned", label: "Unassigned" },
        { id: "replies-count", label: "{count} reply" },
        { id: "replies-count-plural", label: "{count} replies" },
        { id: "hidden", label: "{count} older message(s) are not listed. Work the queue down." },
      ],
    },
    {
      id: "message",
      heading: "Message",
      body: "What the person wrote, and what this console knows about it. The address is the reply address they typed; nothing here is rendered anywhere a visitor can reach.",
      items: [
        { id: "from", label: "From" },
        { id: "received", label: "Received" },
        { id: "status", label: "Status" },
        { id: "seat", label: "Seat" },
        { id: "sent-at", label: "Last reply accepted {at}" },
        { id: "not-sent", label: "No reply has been accepted yet." },
        { id: "replies", label: "Replies" },
        { id: "notice-outcome-sent", label: "The form's own notification reached the mailbox." },
        {
          id: "notice-outcome-unset",
          label: "No mail sender is configured, so the notification was not attempted.",
        },
        {
          id: "notice-outcome-failed",
          label: "The notification to the internal mailbox was refused, not sent.",
        },
        { id: "notice-outcome-unknown", label: "The notification's outcome is unknown." },
        { id: "back", label: "Back to the queue" },
      ],
    },
    {
      id: "delivery",
      heading: "Deliverability",
      body: "Read from the mail provider's own deliveries for this address. A hard bounce or a spam complaint refuses any further reply from this console; a soft bounce does not, because the next attempt often lands.",
      items: [
        {
          id: "unknown",
          label: "The provider has reported nothing for this address.",
        },
        { id: "delivered", label: "The provider delivered a message to this address." },
        {
          id: "bounced",
          label:
            "The provider reported a hard bounce for this address, so a reply is refused until the address is fixed.",
        },
        {
          id: "complained",
          label:
            "The person marked our mail as spam, so a reply is refused — they have said they do not want it.",
        },
        { id: "source", label: "Joined from email_event by recipient." },
      ],
    },
    {
      id: "throttle",
      heading: "The form's throttle",
      body: "The contact form keeps five messages per address per ten minutes and answers 429 after that. The refusal writes no row, so this is derived from the messages the form did keep.",
      items: [
        {
          id: "quiet",
          label: "{recent} of {limit} messages from this address in the last {minutes} minutes.",
        },
        {
          id: "reached",
          label:
            "This address reached the limit — {recent} of {limit} in the last {minutes} minutes — so a further submit answered 429 and wrote nothing.",
        },
        { id: "total", label: "{count} message(s) from this address in total." },
      ],
    },
    {
      id: "thread",
      heading: "The thread",
      body: "The message, then every reply this console has sent or attempted. A reply is stored before it is sent, so a failure leaves the words here with the provider's refusal under them.",
      items: [
        { id: "them", label: "{name}, {at}" },
        { id: "you", label: "{name}, {at}" },
        { id: "empty", label: "Nobody has replied yet." },
        { id: "state-sending", label: "Sending — the provider has not answered yet." },
        { id: "state-sent", label: "Accepted {at}" },
        { id: "state-failed", label: "Not accepted. The message is waiting." },
        { id: "error", label: "Provider said: {error}" },
        { id: "provider-id", label: "Provider id {id}" },
      ],
    },
    {
      id: "reply",
      heading: "Reply",
      body: "The reply goes out under the site's own sending identity, with the original message quoted under it. The send is attempted after the reply is stored; a refusal is shown here and on the row, never swallowed.",
      items: [
        { id: "body", label: "Your reply" },
        { id: "reason", label: "Why (recorded in the audit log)" },
        { id: "button", label: "Send reply" },
        { id: "sending", label: "Sending…" },
        { id: "accepted", label: "Accepted by the provider — recorded as sent at {at}." },
        {
          id: "refused",
          label:
            "The provider did not accept it. The message is waiting and the error is stored: {error}",
        },
      ],
    },
    {
      id: "triage",
      heading: "Triage",
      body: "Move the message between the four statuses. The change and your reason are one audit row; a same-status change is refused rather than logged.",
      items: [
        { id: "status", label: "Status" },
        { id: "reason", label: "Why (recorded in the audit log)" },
        { id: "button", label: "Save status" },
        { id: "saving", label: "Saving…" },
        { id: "done", label: "Saved. The audit row is {id}." },
      ],
    },
    {
      id: "assign",
      heading: "Assignment",
      body: "Take the message, hand it to another support seat, or clear the assignment. Claiming a new message also moves it to open.",
      items: [
        { id: "seat", label: "Seat" },
        { id: "none", label: "Nobody" },
        { id: "reason", label: "Why (recorded in the audit log)" },
        { id: "button", label: "Save seat" },
        { id: "saving", label: "Saving…" },
        { id: "done", label: "Saved. The audit row is {id}." },
        { id: "self", label: "Take it myself" },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "no-such-message", label: "That message no longer exists." },
        { id: "no-change", label: "Nothing changed — the row already says that." },
        { id: "empty-body", label: "The reply needs at least {min} character(s)." },
        { id: "no-such-seat", label: "That account is not a support seat." },
        {
          id: "bounced",
          label:
            "This address hard-bounced, so the console will not send to it. Fix the address first.",
        },
        {
          id: "complained",
          label: "This person marked our mail as spam, so the console will not send again.",
        },
        {
          id: "reason-too-short",
          label: "The reason is too short. At least {min} characters, please.",
        },
        { id: "role-too-low", label: "That action needs a higher role than yours." },
        { id: "signed-out", label: "The sign-in expired while this form was open." },
        { id: "failed", label: "The operation did not commit. Nothing was changed." },
      ],
    },
    {
      id: "reply-email",
      heading: "Reply email",
      items: [
        { id: "subject", label: "Re: your message to {name}" },
        { id: "greeting", label: "Hello {name}," },
        {
          id: "quote",
          label: "On {received}, you wrote to {brand}:",
        },
        { id: "quote-line", label: "> {line}" },
      ],
    },
    {
      id: "unreadable",
      heading: "The inbox could not be read",
      body: "The console reads the queue from the database on every visit, and this visit did not get an answer. Nothing here came from a cache.",
    },
  ],
});
