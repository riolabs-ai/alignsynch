/**
 * `/support` — the support hub's copy.
 *
 * `SupportPage` is the client shell the five panel components sit in, so the page module
 * hands it one section per panel and it forwards them: the hero (`SupportHeader`) takes
 * the whole `PageCopy` because it renders the route's `h1` and `subtitle`, and each panel
 * gets its own section by id.
 *
 * `help-categories` is deliberately shared. The taxonomy names plus "All Categories" render on
 * this route — the category rail, the contact form's category select, and the `<Category> FAQs` /
 * `<Category> Knowledge Base` headings — and they are one list of words, not four. The rail, the
 * select and both headings read the same `help-categories` section, so the fixture stays the single
 * place a name is edited; the view still owns the icon, the select value and the order.
 *
 * Which of these names a build offers is `data/support-categories.ts` (#313), not this file: the
 * alignment product has no quiz category and neither build answers billing or tournaments, so the
 * rail and the select render a subset of the ids here. The two retired ids left the fixture with
 * their last asker — a name no surface can render is copy waiting to be re-offered by mistake.
 *
 * The FAQ questions and answers are not here: they are an inline record array in
 * `support-faq.tsx` with no schema in P2 (`content/article.ts` has no `Faq`), so only the
 * band's chrome — its heading, the search placeholder, the empty state — is copy.
 *
 * The `contact` band has no success state and no attachment copy (#290): the form is not
 * connected to a mailbox, so the only claim it may make is `not-connected`, whose `{email}`
 * placeholder the view fills from `brand.supportEmail`. The old success heading, its
 * response-time sentence, the made-up reference number and the file-type / upload rows all
 * described a queue and a validation that do not exist, and were deleted rather than left
 * unrendered.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const supportPageCopy: PageCopy = zPageCopy.parse({
  heading: "Support Center",
  subtitle: "Find answers to common questions or get in touch with our support team",
  sections: [
    {
      id: "support-tabs",
      heading: "Frequently Asked Questions",
      items: [
        { id: "tab-faq-short", label: "FAQs" },
        { id: "tab-contact", label: "Contact Support" },
        { id: "tab-contact-short", label: "Contact" },
        { id: "tab-knowledge", label: "Knowledge Base" },
        { id: "tab-knowledge-short", label: "Articles" },
      ],
    },
    {
      id: "help-categories",
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
      id: "faqs",
      heading: "FAQs",
      items: [
        { id: "search-placeholder", label: "Search FAQs..." },
        { id: "empty", label: "No FAQs found matching your search." },
      ],
    },
    {
      id: "contact",
      heading: "Contact Support",
      items: [
        {
          id: "not-connected",
          label: "This form isn't connected yet — email {email} instead.",
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
      ],
    },
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
  ],
});
