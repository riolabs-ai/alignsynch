/**
 * `/support` — the account support page's copy, inside the app shell.
 *
 * **This fixture is the in-app half of the split.** `/help` (public, `data/pages/help.ts`) is the
 * FAQ and the knowledge base; this route is the account page a signed-in member reaches, and the
 * only place a contact form is drawn. The route module (`app/(mainlayout)/support/page.tsx`)
 * resolves the session first and redirects a visitor with none to `/help` — not to `/login`, and
 * not to a 404 — because the same URL has two correct answers and this page is only one of them.
 *
 * **The form is still not connected, and the page says so where the reader is looking.** #290
 * deleted the fake success screen (a 1.5 s timeout, a green tick and a random reference number)
 * and left a disclaiming banner, because the honest shape is the form's markup plus a visible
 * line. `submit-note` sits directly above the submit control and the control is disabled with
 * `aria-describedby` pointing at it, so the reason is announced and not merely printed;
 * `not-connected` is the same sentence with the mailbox in it, at the top of the card, because
 * the useful thing to do next is write to a person.
 *
 * Every claim here is about this tree: no queue, no ticket table, no sender. The page promises no
 * response time, because there is nothing that could keep that promise yet.
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
    "Account support, inside the app: what to send, what this form does today, and where the answers are.",
  sections: [
    {
      id: "contact",
      heading: "Contact support",
      body: "One message about your account, or about a relationship you are working on. Nothing here is delivered yet, so the mailbox in the banner is still the fastest route to a person.",
      items: [
        {
          id: "not-connected",
          label:
            "This form has no sender yet — nothing you type is sent or stored. Write to {email} instead, and it reaches a person today.",
        },
        { id: "name", label: "Name" },
        { id: "name-placeholder", label: "Your name" },
        { id: "email", label: "Email" },
        { id: "email-placeholder", label: "your.email@example.com" },
        { id: "subject", label: "Subject" },
        { id: "subject-placeholder", label: "Brief description of your issue" },
        { id: "category", label: "Category" },
        { id: "category-placeholder", label: "Select a category" },
        { id: "message", label: "Message" },
        { id: "message-placeholder", label: "Please describe your issue in detail" },
        { id: "submit", label: "Submit Request" },
        {
          id: "submit-note",
          label:
            "Send is disabled until this form is connected to a sender: nothing you type would leave this page today.",
        },
      ],
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
      heading: "What this form does today",
      body: "It is the markup for contact support with nothing behind it — a stated state, not a silent no-op. The sender this deployment would need is not configured, so there is no address a message could be delivered to.",
      items: [
        {
          id: "not-sent",
          label: "Nothing is sent",
          body: "The submit control is disabled and the line above it says why, so no message is lost without the reader being told.",
        },
        {
          id: "not-stored",
          label: "Nothing is stored",
          body: "There is no table, queue or ticket behind these fields: they live in this page and go no further.",
        },
        {
          id: "write-instead",
          label: "Write instead",
          body: "The mailbox in the banner reaches a person today, and it is the same address in the footer of every page.",
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
