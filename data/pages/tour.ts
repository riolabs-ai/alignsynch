/**
 * The first-run tour's words (#455) — six steps and the chrome they are drawn in.
 *
 * The tour is the one fixture whose surface is **not a route**: it renders over `/dashboard`,
 * highlighting elements `/dashboard` and the shell already own. So it is a declared non-route copy
 * surface (`NON_ROUTE_COPY_SURFACES` in `content/pages.ts`) with its own budget row, which is what
 * keeps a sentence out of `components/tour/**` — every word a reader sees in the callout lives
 * here, including the three button labels, the progress line and the sentence a screen reader
 * hears on each step change.
 *
 * **`sections` *is* the step list, in order.** `lib/tour/steps.ts` maps each section id to the
 * element carrying `data-tour="<id>"`, and a step whose element is absent from the page is
 * skipped rather than pointed at nothing. The ids are the anchors, so renaming one is a two-file
 * change by design: the fixture says what the step is called and the markup says where it points.
 *
 * **No step describes something that is not wired.** Every sentence below is about a surface this
 * build renders: the counts band, the relationships list, the template picker, the two-party
 * answering rule the read itself enforces (`lib/flow/store.ts`), and the Support row. Nothing
 * carries a metric, a rating or a comparison, per #454's "no fabricated claims" constraint.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const tourPageCopy: PageCopy = zPageCopy.parse({
  heading: "A short tour of your console",
  items: [
    /**
     * driver.js interpolates `{{current}}` and `{{total}}` in `progressText`, and the ids below
     * are the only place those words live — the component hands the string straight to the
     * engine, so the reader still never sees a literal written in code.
     */
    { id: "progress", label: "{{current}} of {{total}}" },
    /**
     * The sentence announced politely on every step change. `{current}`, `{total}`, `{heading}`
     * and `{body}` are filled by the component from the step it just moved to, so the live
     * region says the same thing a sighted reader sees in the callout.
     */
    { id: "announce", label: "Step {current} of {total}: {heading}. {body}" },
    { id: "next", label: "Next" },
    { id: "previous", label: "Back" },
    { id: "done", label: "Done" },
    { id: "close", label: "Close the tour" },
  ],
  sections: [
    {
      id: "dashboard",
      heading: "Your console",
      body: "These four numbers are counts of your own relationships, and each card opens the list it counts.",
    },
    {
      id: "relationships",
      heading: "My relationships",
      body: "Every relationship you are part of is in this list. A row that still needs your answers says so before you open it.",
    },
    {
      id: "start",
      heading: "Start from a template",
      body: "A relationship begins with a template — the set of questions you and the other person will both answer.",
    },
    {
      id: "answer",
      heading: "You answer separately",
      body: "You both answer those questions on your own, and the Gap is where your two sets of answers part.",
    },
    {
      id: "blind",
      heading: "Nothing is visible early",
      body: "Neither of you can read the other's answers until you have both submitted. The Gap opens only then.",
    },
    {
      id: "help",
      heading: "A person, when you need one",
      body: "Support is one row away in this rail, and that is where you reach someone about the tour or the product.",
    },
  ],
});
