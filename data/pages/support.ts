/**
 * `/support` — the account support page's copy, inside the app shell.
 *
 * **This fixture is the in-app half of the split.** `/help` (public, `data/pages/help.ts`) is the
 * FAQ, the knowledge base and the one contact form; this route is the account page a signed-in
 * member reaches. The route module (`app/(mainlayout)/support/page.tsx`) resolves the session
 * first and redirects a visitor with none to `/help` — not to `/login`, and not to a 404 —
 * because the same URL has two correct answers and this page is only one of them.
 *
 * **No form and no address here** (owner, 2026-11-02). This page used to mount a second contact
 * form whose submit was permanently disabled and whose banner apologised that nothing typed
 * there would leave the page (#290) — plus an address-shaped example placeholder in a public
 * field. There is exactly one contact path now, the form on `/help`, which stores the message in
 * Postgres before mailing it; this page prints a sentence and a link to it, and its banner names
 * no mailbox because the fixture carries none.
 *
 * `what-to-include` is the card's own suggestion made concrete — a relationship (by name, or the
 * id in its page address), the page and browser, and what was expected against what happened.
 * `where-else` names the two in-app places that answer most of what reaches support, and carries
 * their labels so the view writes no words of its own.
 *
 * The taxonomy ids are `data/support-categories.ts`'s (#313): that file decides what a build
 * offers, and a category the build does not offer cannot be selected here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const supportPageCopy: PageCopy = zPageCopy.parse({
  heading: "Support",
  subtitle:
    "Account support, inside the app: where to send a message, what happens to it, and where the answers are.",
  sections: [
    {
      id: "contact",
      heading: "Contact support",
      /**
       * A pointer, not a form (owner, 2026-11-02). The form lives on `/help`, in the marketing
       * chrome, where a signed-out visitor can reach it too; this page links there rather than
       * growing a second, weaker copy that cannot send. `cta.href` is checked against
       * `content/routes.ts` by E23, so the link cannot outlive the page it names.
       */
      body: "Send us a message from the contact form on the Help page. It is the one place a message to us is stored, and it takes a name, a reply address and the message itself.",
      cta: { label: "Open the contact form", href: "/help" },
    },
    {
      id: "help-categories",
      /**
       * The taxonomy names, mirrored from `data/pages/help.ts` on purpose: copy is keyed by the
       * route that renders it (E23), and this page's category select must name an id the way the
       * public rail does. The ids are `data/support-categories.ts`'s; a test asserts the two
       * fixtures agree on every id they share, so a rename in one is a red build rather than two
       * spellings of Account.
       */
      heading: "Help Categories",
      items: [
        { id: "all", label: "All Categories" },
        { id: "account", label: "Account" },
        { id: "quiz-creation", label: "Quiz Creation" },
        { id: "privacy", label: "Privacy" },
        { id: "technical", label: "Technical Issues" },
        { id: "general", label: "General" },
      ],
    },
    {
      id: "what-this-form-does",
      heading: "What happens to your message",
      body: "The form on the Help page is connected: it stores the message first and mails it second, so a mail failure is a delayed notification rather than a lost message.",
      items: [
        {
          id: "stored",
          label: "Stored first",
          body: "The message is written to our database before anything is sent, so it exists even if the mailer is down.",
        },
        {
          id: "mailed",
          label: "Mailed second",
          body: "We are notified of the message, and replying in a mail client answers you at the address you left.",
        },
        {
          id: "reply",
          label: "Read by a person",
          body: "There is no ticket bot behind it: a person reads the message and replies by email.",
        },
      ],
    },
    {
      id: "what-to-include",
      heading: "What to include",
      body: "A message that names these three things is answered in one reply instead of three.",
      items: [
        {
          id: "relationship",
          label: "The relationship",
          body: "Its name, or the id from the address of its page in My Relationships.",
        },
        {
          id: "browser",
          label: "The page and the browser",
          body: "Where you were and which browser you were in, so the screen can be reproduced.",
        },
        {
          id: "expected",
          label: "What you expected",
          body: "What you expected to happen and what happened instead — the difference is the report.",
        },
      ],
    },
    {
      id: "where-else",
      heading: "Faster than waiting on a reply",
      body: "Two places inside the app that answer most of what reaches support.",
      items: [
        {
          id: "help",
          label: "Help centre",
          body: "The FAQ and the knowledge base, in public: every answer that does not need your account.",
        },
        {
          id: "settings",
          label: "Account settings",
          body: "Your display name, handle, bio and country, and the password on this account.",
        },
      ],
    },
  ],
});
