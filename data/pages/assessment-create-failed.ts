/**
 * `/assessment/new/failed` — the create-failed screen's copy (#1226).
 *
 * The words are `docs/specs/v2-bundles/04-create-failed-screen-1226/create-failed.html`'s, verbatim,
 * and the four of them are the whole screen:
 *
 *   heading   "Couldn't Create This Draft"   — the status card's `<h1>`
 *   subtitle  "Try Again Shortly."           — the one sentence under it
 *   retry     "Try Again"                    — the primary action, back into the create flow
 *   dashboard "Back to Dashboard"            — the secondary action, the way out
 *
 * **No database word is in this file, deliberately.** The screen exists because the write threw, and
 * the route's log line carries `create-failed`, the SQLSTATE and the driver's own sentence
 * (`app/(mainlayout)/assessment/new/route.ts`). None of that reaches a reader: a person cannot fix a
 * column, a migration or a connection, so printing one would be an error message addressed to the
 * wrong audience — the same rule that keeps a broken deployment off the `?problem=` path (#1205).
 *
 * **The copy keeps the artifact's casing even where it reads like a sentence.** "Try Again Shortly."
 * is Title Case with an ending period — the v2 rule asks for Title Case on labels and headings and
 * sentence case on sentences, and this one is drawn as a short line rather than a paragraph. The
 * artifact is the reference; this fixture is not the place to improve it.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentCreateFailedPageCopy: PageCopy = zPageCopy.parse({
  heading: "Couldn't Create This Draft",
  subtitle: "Try Again Shortly.",
  sections: [
    {
      id: "actions",
      items: [
        { id: "retry", label: "Try Again" },
        { id: "dashboard", label: "Back to Dashboard" },
      ],
    },
  ],
});
