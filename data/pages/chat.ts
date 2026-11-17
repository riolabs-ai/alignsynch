/**
 * `/dashboard/chat` — one thread per relationship (#1131).
 *
 * The visual authority is the v2.0 handoff bundle
 * `docs/specs/v2-bundles/07-spec-design-page-chat-v2/` (`chat.html` + `reference/chat-*`), ported
 * rather than redesigned. Every reader-visible string on the surface lives here — the route's
 * leaf-literal budget is 0 (E23), so the components own no words at all.
 *
 *   list        the conversation list: its heading, its search, and the three preview lines a row
 *               can carry (a last message, a waiting line, a paused chip)
 *   pick        the empty pane beside the list: "Pick a Conversation"
 *   thread      one relationship's thread: the header's chips, the "You" label, the message list's
 *               name, and the empty state a thread with no messages draws
 *   waiting     the state a pre-join thread draws, in the bundle's own words
 *   paused      the read-only band, and the Initiator's one action
 *   chips       the Align status vocabulary a tagged message uses
 *   unreadable  the database did not answer
 *   empty       no relationships yet — a different fact from "the read failed"
 *
 * **The bundle's exact strings are kept verbatim**: "Chat", "Pick a Conversation", "Tag:", "Chat
 * Opens When … Joins", "Read-only while Stage 6 is paused.", "Add a Card". The pause band's sentence
 * is the bundle's fuller one (*"Stage 6 is paused, so chat is read-only. Nothing is lost."*) because
 * the `chat.html` band prints exactly that, and the shorter "Read-only while Stage 6 is paused." is
 * reused as the header chip's tooltip-shaped line on the paused state.
 *
 * **`{name}` is filled from the relationship, never authored.** The bundle writes "Tomás", "Elena"
 * and "Priya" because those are its fixture people; a real screen names the person on the other
 * seat, and `fillLabel` is the one way a `{placeholder}` is replaced (`lib/page-copy.ts`).
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const chatPageCopy: PageCopy = zPageCopy.parse({
  heading: "Chat",
  items: [
    { id: "search", label: "Search" },
    { id: "open", label: "Open" },
    { id: "back", label: "Back to Conversations" },
    { id: "unread", label: "{count} unread" },
    { id: "you", label: "You" },
    { id: "with", label: "With {name}" },
    /**
     * The other seat's name when nobody is on it yet — a relationship whose Counterparty has not
     * claimed their seat has no second name to print, and a heading reading "Chat Opens When  Joins"
     * is worse than the fixture's own phrase. Title Case because it is used as a name.
     */
    { id: "unnamed", label: "The Other Party" },
    { id: "messages", label: "Messages" },
    { id: "message-placeholder", label: "Message {name}" },
    { id: "send", label: "Send" },
    { id: "tag-prefix", label: "Tag:" },
    { id: "tag-group", label: "Tag an Aspect" },
    /** The three statuses a tag can carry — the words, never the colour alone. */
    { id: "chip-synch", label: "In Synch" },
    { id: "chip-small", label: "Small Gap" },
    { id: "chip-not-ok", label: "Small Gap · Not OK Under Full" },
    { id: "chip-gap", label: "Gap" },
    { id: "open-aspect", label: "Open {aspect} on Align" },
    /** The thread header's state chip, one per state. */
    { id: "state-live", label: "Stage 6 Live" },
    { id: "state-paused", label: "Paused · Read-Only" },
    { id: "state-waiting", label: "Waiting on Invite" },
  ],
  sections: [
    {
      id: "list",
      heading: "Conversations",
      items: [
        { id: "search-label", label: "Search conversations" },
        { id: "waiting-line", label: "Chat opens when {name} joins." },
        { id: "no-messages", label: "No messages yet." },
        { id: "no-match", label: "No conversation matches “{query}”." },
      ],
    },
    {
      /** The pane beside the list, and the sentence under its heading — the bundle's own. */
      id: "pick",
      heading: "Pick a Conversation",
      body: "Each relationship has one shared chat. Tag an Aspect to keep it focused.",
    },
    {
      /**
       * The waiting thread. The heading is the bundle's string with its fixture name replaced; the
       * body is the invitation's own expiry, because that is the instant the row carries — the
       * "Invite sent 14 Nov" shape would need a sent-at the invitation does not store.
       */
      id: "waiting",
      heading: "Chat Opens When {name} Joins",
      items: [
        { id: "invited", label: "The invitation is open until {instant}." },
        { id: "not-sent", label: "The invitation has not been sent yet." },
      ],
    },
    {
      id: "paused",
      items: [
        { id: "read-only", label: "Stage 6 is paused, so chat is read-only. Nothing is lost." },
        /** The owner's label, verbatim — the same action the relationship screen draws. */
        { id: "add-card", label: "Add a Card" },
      ],
    },
    {
      id: "thread",
      items: [{ id: "empty", label: "Nothing here yet. Say hello." }],
    },
    {
      id: "unreadable",
      heading: "Chat is unavailable",
      body: "The conversations could not be read: {reason}. Nothing has been changed.",
    },
    {
      id: "empty",
      heading: "No Conversations Yet",
      body: "A conversation opens with each relationship you start or join.",
      cta: { label: "My Relationships", href: "/dashboard/relationships" },
    },
  ],
});
