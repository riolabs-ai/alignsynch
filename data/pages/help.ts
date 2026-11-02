/**
 * `/help` — the public help centre: the FAQ and the knowledge base, and nothing else.
 *
 * **What this page is, and what it is not.** It used to be `/support`: one public page carrying
 * Help Categories, the FAQ, the knowledge base *and* a contact form whose banner apologised that
 * the form was not connected (#290). A public page that offers a form which cannot send is a
 * promise nobody keeps, and the apology is the proof it should not have been there. The owner's
 * split is the fix: answers are public (`/help`, this fixture), and the way to reach a human is
 * the account page inside the app (`/support`, `data/pages/support.ts`), where the reader's own
 * account and records are already in front of them.
 *
 * So the sections here are the two tabs (`help-tabs`), the shared taxonomy (`help-categories`),
 * the FAQ band, the knowledge-base band, and one band about how to reach a person (`human`) that
 * links to the account page rather than pretending to be one.
 *
 * `help-categories` is the same list of words the account page's category select reads: the
 * taxonomy ids are `data/support-categories.ts`'s (#313), which decides what a build *offers*,
 * and this fixture only names the ones a build may offer. Neither file is the other's copy.
 *
 * The FAQ rows are still an inline record array in `components/support/support-faq.tsx` — they
 * are record-shaped blocks with no schema in P2 (`content/article.ts` has no `Faq`) — so only the
 * band's chrome (its heading, the search placeholder, the empty state) is copy here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const helpPageCopy: PageCopy = zPageCopy.parse({
  heading: "Help",
  subtitle: "Answers to what the app does, and articles on the parts people ask about most.",
  sections: [
    {
      id: "help-tabs",
      items: [
        { id: "tab-faq", label: "Frequently Asked Questions" },
        { id: "tab-faq-short", label: "FAQs" },
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
      id: "knowledge-base",
      heading: "Knowledge Base",
      items: [
        { id: "search-placeholder", label: "Search articles..." },
        { id: "min-read", label: "min read" },
        { id: "read-article", label: "Read article" },
        { id: "empty", label: "No articles found matching your search." },
      ],
    },
    /**
     * The one band about a person, and the honest answer is a link rather than a form.
     *
     * `/support` answers two things: a signed-in member gets the account page, and a visitor
     * with no session is redirected back here. The body says that out loud, so the redirect is
     * not a surprise a reader discovers by clicking, and the label is the destination's own word
     * rather than "Contact us" — the page it opens is Support.
     */
    {
      id: "human",
      heading: "Need a person?",
      body: "Account support lives inside the app, on the Support page: it opens for a signed-in account, and a signed-out click comes back to this page. Sign in, then open Support from the menu.",
      cta: { label: "Open Support", href: "/support" },
    },
  ],
});
