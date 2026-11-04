/**
 * `/dashboard/support` — the in-app support surface (#542 phase 1).
 *
 * **Why it exists.** The rail's Support row used to open the account page at `/support`, which
 * carries one sentence and a pointer at the public help centre: a signed-in member who needed an
 * answer was sent out of the workspace to read conversion copy. This route is that work, inside
 * the dashboard's own layout — the knowledge base list, one article, and a contact form whose
 * submission is stored before anything is mailed.
 *
 * **The words are the dashboard's, not the marketing site's.** `/help` explains the product to
 * someone deciding whether to use it; this fixture explains it to someone who already has an
 * account and is mid-task. So no sentence here sells anything, and none of them promise a
 * capability the build does not have (`#542`: "no marketing copy inside the dashboard").
 *
 * **`states` mirrors `lib/contact/validation.ts`'s `CONTACT_STATES`, in the same order.** The
 * form's server action redirects with one of those five codes and the page renders the matching
 * sentence from this band — the same contract `/help` has, with a different audience and a
 * different destination.
 *
 * **`thread` is a sentence with placeholders, and every number in it comes from a row.**
 * `{id}` and `{status}` are filled from the `contact_message` row the action's store returned and
 * this page re-read by id, so the confirmation is a fact about Postgres rather than a string the
 * page always prints. A submission that produced no id (spam is answered silently, by design)
 * renders the plain `sent` sentence instead — see `app/(mainlayout)/dashboard/support/page.tsx`.
 *
 * The category ids are `data/support-categories.ts`'s (#313); this page renders the "all" view of
 * the knowledge base, so only the words for that one are resolved by a literal.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardSupportPageCopy: PageCopy = zPageCopy.parse({
  heading: "Support",
  subtitle:
    "The answers we keep, and a way to reach a person — all of it inside your workspace, without leaving the console.",
  sections: [
    {
      id: "knowledge-base",
      heading: "Knowledge Base",
      items: [
        { id: "search-placeholder", label: "Search articles..." },
        { id: "min-read", label: "min read" },
        { id: "read-article", label: "Read article" },
        { id: "empty", label: "No articles found matching your search." },
      ],
    },
    {
      id: "help-categories",
      heading: "Help Categories",
      items: [
        { id: "all", label: "All Categories" },
        { id: "account", label: "Account" },
        { id: "privacy", label: "Privacy" },
        { id: "technical", label: "Technical Issues" },
        { id: "general", label: "General" },
      ],
    },
    {
      id: "request",
      heading: "Message support",
      body: "Write once, and we answer the address on this account. The message is stored before it is mailed, so a mail failure is a delayed notification rather than a lost message.",
    },
    {
      id: "form",
      heading: "Send us a message",
      items: [
        { id: "name", label: "Your name" },
        { id: "email", label: "Reply address" },
        { id: "email-note", label: "The address on this account. We reply here." },
        { id: "message", label: "Message" },
        { id: "message-placeholder", label: "What happened, and what did you expect?" },
        { id: "honeypot", label: "Leave this field empty" },
        { id: "submit", label: "Send message" },
        { id: "note", label: "A person reads every message. There is no ticket bot." },
      ],
    },
    {
      id: "states",
      heading: "What happened",
      items: [
        {
          id: "sent",
          label: "Message sent",
          body: "We have your message and we will reply to the address on this account.",
        },
        {
          id: "received",
          label: "Message received",
          body: "Your message is saved and we will reply to the address on this account. Our own notification did not go out, so nothing you wrote was lost.",
        },
        {
          id: "failed",
          label: "Not saved",
          body: "Your message was not saved, so nothing has reached us. Please send it again in a moment.",
        },
        {
          id: "invalid",
          label: "Check the message",
          body: "A message is required. The name and address come from your account and are not editable here.",
        },
        {
          id: "throttled",
          label: "Too many messages",
          body: "We have had several messages from this account in the last few minutes. Please try again shortly.",
        },
      ],
    },
    {
      id: "thread",
      heading: "Your message",
      items: [
        {
          id: "reference",
          label: "Message {id}",
          body: "It is in our queue with status {status}, and a reply goes to the address on this account.",
        },
        { id: "back", label: "Send another message" },
      ],
    },
    {
      id: "what-happens",
      heading: "What happens next",
      body: "Three facts about this form, so nothing about it is a surprise.",
      items: [
        {
          id: "stored",
          label: "Stored first",
          body: "The message is written to our database before the notification is sent.",
        },
        {
          id: "read",
          label: "Read by a person",
          body: "It lands in our support queue, where a person reads it and replies.",
        },
        {
          id: "reply",
          label: "One reply, by email",
          body: "The reply arrives at the address on this account, not in the app.",
        },
      ],
    },
  ],
});
