/**
 * `not-found` — the 404 surface's copy (WU-7, issue #54).
 *
 * `app/not-found.tsx` is not a route: Next renders it for any path that matches
 * nothing, so `content/routes.ts` cannot own it and no route budget can cover it.
 * `data/pages/budget.ts` keys it by the declared surface name `not-found`, with the
 * module as its only file — which is why its entry has no `dirs`.
 *
 * The page's randomised background glyphs are a client component of their own
 * (`components/not-found/floating-glyphs.tsx`): the 404 module stays a server module so
 * it can parse this fixture without putting zod in the browser bundle.
 *
 * ## The fact band (issue #291)
 *
 * The band used to read "The HTTP 404 error was named after room 404 at CERN, where the
 * original web servers were located!" — a widely repeated story that CERN and the W3C
 * both contradict. It sat on every 404 of both brands, so every dead link in the demo
 * told the same falsehood.
 *
 * It is replaced by a statement about the code itself, checked against the specification
 * rather than remembered: RFC 9110 §15.5.5 (HTTP Semantics, June 2022) says "The 404 (Not
 * Found) status code indicates that the origin server did not find a current
 * representation for the target resource or is not willing to disclose that one exists"
 * (https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5). The body below is a
 * paraphrase of that sentence and claims nothing beyond it — no origin story, no trivia,
 * nothing a reader would have to take on trust. The heading is no longer "Fun Quiz Fact"
 * for the same reason: the product's name is not what makes an HTTP status true.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const notFoundPageCopy: PageCopy = zPageCopy.parse({
  heading: "Oops! Quiz Not Found",
  sections: [
    {
      id: "message",
      items: [
        { id: "line-1", label: "Looks like this page decided to play hide and seek! 🎯" },
        { id: "line-2", label: "Don't worry, even the best quiz masters get lost sometimes." },
      ],
    },
    {
      id: "fact",
      heading: "About this error",
      body: "404 is the status code the HTTP specification calls Not Found: the server answered, and it found no current representation at the address you asked for.",
    },
    {
      id: "actions",
      items: [
        { id: "home", label: "Back to Home" },
        { id: "back", label: "Go Back" },
        { id: "prompt", label: "Looking for something specific?" },
        { id: "browse", label: "Browse Quizzes" },
        { id: "categories", label: "Categories" },
        { id: "leaderboard", label: "Leaderboard" },
      ],
    },
  ],
});
