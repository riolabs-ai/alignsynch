/**
 * `/admin/docs/[...slug]` — one document's words (#892).
 *
 * The smallest fixture in the tree, and that is the shape of the surface: a document's title, its
 * question and its body are the manifest's and the file's — this screen prints "Previous" under a
 * link, not a page about itself. What is here is the chrome around the body: the way back to the hub,
 * the sibling heading, the two step labels, and the panels for the two failures a reader can meet.
 *
 * The body is markdown rendered by `components/admin/docs/doc-article.tsx`; nothing in the file is
 * copied, rewritten or moved, so `pnpm docs:check` still counts 117 documents and 1,281 links.
 *
 * The `feedback` band is #894's: a reader who finds a page wrong files a note that becomes a
 * GitHub issue on this repository, and every word of that panel — the two kinds, the hint, the four
 * answers — is here, because the component that draws it has a budget of 0 literals. The `{min}`
 * and `{max}` in the hint are filled from the module's own bounds rather than baked in, so the
 * sentence cannot disagree with the validation that refuses a six-character note.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminDocPageCopy: PageCopy = zPageCopy.parse({
  heading: "Documentation",
  subtitle: "One page of the tree under docs/, rendered where it is written.",
  // The way back, and the only link this fixture carries — E23 holds it to `content/routes.ts`.
  cta: { label: "All documentation", href: "/admin/docs" },
  sections: [
    {
      id: "document",
      heading: "In this section",
      body: "The pages beside this one, in the order docs/docs.json lists them.",
      items: [
        { id: "section", label: "Section" },
        { id: "contents", label: "In this section" },
        { id: "previous", label: "Previous" },
        { id: "next", label: "Next" },
        { id: "back", label: "All documentation" },
        { id: "empty-body", label: "This document has no body yet." },
        { id: "missing", label: "There is no document at that address." },
        {
          id: "unreadable",
          label:
            "The documentation manifest could not be built: {reason}. The page cannot say which documents exist.",
        },
      ],
    },
    {
      id: "feedback",
      heading: "Report a problem",
      body: "A note filed here opens an issue on this repository carrying the page's path, the heading you were reading and the build that served it. Nothing else about you is sent, and the issue is the record — this screen keeps no copy.",
      items: [
        { id: "open", label: "Report a problem" },
        { id: "close", label: "Cancel" },
        { id: "kind-label", label: "What kind of problem is it?" },
        { id: "kind-correction", label: "Something here is wrong" },
        { id: "kind-missing", label: "Something is missing" },
        { id: "message-label", label: "What should change?" },
        { id: "message-hint", label: "Between {min} and {max} characters." },
        { id: "submit", label: "Send the note" },
        { id: "sending", label: "Sending…" },
        {
          id: "filed",
          label: "Filed as issue #{number}. Closing it is a decision for the release it lands in.",
        },
        {
          id: "not-configured",
          label:
            "Nothing was sent: this build carries no feedback token, so there is no issue to point at. The page is unchanged.",
        },
        {
          id: "failed",
          label:
            "Nothing was recorded — the note did not reach the repository. Nothing is lost that cannot be retyped; try again.",
        },
        {
          id: "too-many",
          label:
            "Several notes were filed in the last few minutes, so this one was not sent. Try again shortly.",
        },
        {
          id: "invalid",
          label:
            "That note could not be accepted — it is not about a page the documentation manifest carries.",
        },
        {
          id: "invalid-message",
          label: "A note needs between {min} and {max} characters, so nothing was sent.",
        },
      ],
    },
  ],
});
