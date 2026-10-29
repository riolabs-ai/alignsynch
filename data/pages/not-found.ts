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
      heading: "Fun Quiz Fact",
      body: "The HTTP 404 error was named after room 404 at CERN, where the original web servers were located!",
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
