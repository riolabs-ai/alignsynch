/**
 * `/support` — the support hub's copy.
 *
 * `SupportPage` is the client shell the five panel components sit in, so the page module
 * hands it one section per panel and it forwards them: the hero (`SupportHeader`) takes
 * the whole `PageCopy` because it renders the route's `h1` and `subtitle`, and each panel
 * gets its own section by id.
 *
 * `help-categories` is deliberately shared. The seven taxonomy names plus "All Categories"
 * render in four places on this route — the category rail, the contact form's category
 * select, and the `<Category> FAQs` / `<Category> Knowledge Base` headings — and they are
 * one list of words, not four. The rail, the select and both headings read the same
 * `help-categories` section, so the fixture stays the single place a name is edited; the
 * view still owns the icon, the select value and the order.
 *
 * The FAQ questions and answers are not here: they are an inline record array in
 * `support-faq.tsx` with no schema in P2 (`content/article.ts` has no `Faq`), so only the
 * band's chrome — its heading, the search placeholder, the empty state — is copy.
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
        { id: "billing", label: "Billing" },
        { id: "quiz-creation", label: "Quiz Creation" },
        { id: "tournaments", label: "Tournaments" },
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
        { id: "success-heading", label: "Message Sent!" },
        {
          id: "success-body",
          label: "Thank you for contacting us. We'll get back to you as soon as possible.",
        },
        { id: "reference-number", label: "Your reference number: #" },
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
        { id: "attachment", label: "Attachment (optional)" },
        { id: "upload-file", label: "Upload File" },
        { id: "change-file", label: "Change File" },
        {
          id: "accepted-types",
          label: "Accepted file types: Images, PDF, DOC, DOCX, TXT (Max 5MB)",
        },
        { id: "sending", label: "Sending..." },
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
