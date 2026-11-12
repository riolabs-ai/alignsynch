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
  ],
});
