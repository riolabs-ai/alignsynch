/**
 * `/how-it-works` carries the vocabulary `start/core-concepts.md` defines.
 *
 * **The defect this file pins.** The Core Concepts doc's four concepts are Stage 6, Extra Week,
 * Gap and Aspect. The page carried `Gap` and named none of the others: a reader who came to the
 * public explainer for the product's words got "One relationship, six moves" — a different six from
 * the product's six stages — and never met **Stage 6 / Align** or the **Extra Week**. That is a
 * copy defect the gate could not see, because both halves are honest prose.
 *
 * **Why the assertions are strings and not pixels.** Every word here comes from
 * `data/pages/how-it-works.ts`; the join the test proves is that the fixture's vocabulary reaches
 * the rendered page. `pnpm data:check` E23 owns the other half (a component holds no literal), and
 * `node scripts/design-audit.mjs --capture` owns the pixels.
 *
 * **No flow.** The recording is passed by the route, not by this component, and the vocabulary
 * bands the doc is about are the page's own words — so a render without the recording is the
 * cheaper, narrower fixture. `/dashboard/help` mounts exactly this (the page's second mount).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { HowItWorks } from "@/components/onboarding/how-it-works";
import { howItWorksPageCopy } from "@/data/pages/how-it-works";

/** The page as `/dashboard/help` mounts it: the copy, no recording. */
function render(): string {
  return renderToStaticMarkup(<HowItWorks copy={howItWorksPageCopy} signedIn={false} />);
}

describe("/how-it-works names the product's words, not only the flow", () => {
  const html = render();

  test("Stage 6 is named, and it is named Align", () => {
    expect(html).toContain("Stage 6");
    expect(html).toContain("6 Align");
  });

  test("the six stages are enumerated, so 'six moves' is not the only six on the page", () => {
    // The moves and the stages are different sixes; a reader who sees one and not the other
    // concludes the moves are the stages, which is the confusion the doc's Stage entry exists to end.
    expect(html).toContain("1 Details");
    expect(html).toContain("5 Invite");
  });

  test("the Extra Week is named, with what happens when the trial ends", () => {
    expect(html).toContain("Extra Week");
    expect(html).toContain("pauses");
  });

  test("the three statuses are still the doc's own words", () => {
    expect(html).toContain("In Synch");
    expect(html).toContain("Small Gap");
    expect(html).toContain("Gap");
  });

  test("the vocabulary is the fixture's, so a rename lands in one file", () => {
    // Stated rather than implied: the bands are sections of `howItWorksPageCopy`, and a component
    // that authored these strings would fail E23 before it reached this assertion.
    const ids = (howItWorksPageCopy.sections ?? []).map((section) => section.id);
    expect(ids).toContain("stage-six");
    expect(ids).toContain("extra-week");
  });
});
