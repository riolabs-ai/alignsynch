/**
 * The first-run tour's step list, and the one decision that makes it honest (#455).
 *
 * The six steps are `data/pages/tour.ts`'s sections, in fixture order. Three things have to meet
 * for a step to exist, and each of them lives somewhere different on purpose:
 *
 *   the words     `data/pages/tour.ts` — `heading` is the callout's title, `body` its paragraph
 *   the target    a real element carrying `data-tour="<id>"`, on the page the tour is mounted on
 *   the join      this module, which is the only place that decides a step *runs*
 *
 * **A step whose target is absent is skipped, never faked.** Absent is two cases and one answer:
 *
 *   - no element carries the anchor at all — the surface is not on this page (`/dashboard` has no
 *     empty-state card for an account that already has relationships, so the three steps that
 *     point into it do not run);
 *   - the element is in the document but not rendered — the rail's Support row is `invisible`
 *     under 768px until the drawer opens, and a tooltip aimed at a hidden row would highlight a
 *     250px panel that is off-canvas. `checkVisibility()` answers this; a rect-size fallback
 *     covers a DOM without it.
 *
 * A step that does not run is not counted either: the progress line the reader sees is
 * `1 of 4`, not `1 of 6` with two phantom stops. That is why the filtering happens here rather
 * than in driver.js's own `skipMissingElement` — the engine would skip the step but still print
 * the full step count.
 *
 * Pure — `ParentNode` in, steps out; no `window`, no React, no driver.js — so
 * `tests/tour-steps.test.ts` can drive every combination in jsdom, including the two cases one
 * page cannot produce at once.
 */
import type { PageCopy } from "@/content/pages";
import { sectionOf } from "@/lib/page-copy";

/** The attribute that joins a fixture step to the element it points at. */
export const TOUR_ANCHOR = "data-tour";

/** One step's words, resolved from the fixture. */
export interface TourStepText {
  readonly id: string;
  readonly heading: string;
  readonly body: string;
}

/** One step that will actually run: its words and the element it highlights. */
export interface TourStep extends TourStepText {
  readonly element: Element;
}

/** The selector one step's anchor answers to. */
export function anchorSelector(id: string): string {
  return `[${TOUR_ANCHOR}="${id}"]`;
}

/**
 * A step's words, with the fixture's own error for a step that has no paragraph.
 *
 * `heading` and `body` are optional on `zPageCopySection` because a nav column is a list of items
 * and nothing else; a *tour step* is the other shape, and a step whose callout renders a title and
 * no sentence is a half-written step, not an empty band. So the reader demands both.
 */
export function stepTextOf(copy: PageCopy, id: string): TourStepText {
  const section = sectionOf(copy, id);
  if (section.heading === undefined || section.body === undefined) {
    throw new Error(
      `PageCopy: tour step "${id}" needs a heading and a body (data/pages/tour.ts) — a step with no sentence is a half-written step`,
    );
  }
  return { id: section.id, heading: section.heading, body: section.body };
}

/**
 * Whether an element is rendered *now* — the second half of "absent".
 *
 * `checkVisibility()` is the DOM's own answer and it is the one that matters here: it reads
 * `display`, `visibility` and (with `checkOpacity`) opacity down the ancestor chain, so the
 * closed mobile rail (`invisible -translate-x-full`) is not visible even though it has a box.
 * jsdom and older engines do not implement it, and the rect fallback is deliberately generous —
 * an element with no box is not renderable in any engine.
 */
export function isRendered(element: Element): boolean {
  const { checkVisibility } = element as Element & {
    checkVisibility?: (options?: {
      checkOpacity?: boolean;
      checkVisibilityCSS?: boolean;
    }) => boolean;
  };
  if (typeof checkVisibility === "function") {
    return checkVisibility.call(element, { checkOpacity: true, checkVisibilityCSS: true });
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

/**
 * The steps that can run in this document, in fixture order.
 *
 * `root` is the document in the app and a parsed fragment in the tests, which is what keeps this
 * function free of the one global it would otherwise need. `visible` is injectable for the same
 * reason `ParentNode` is: jsdom has no layout, so a test that wants to prove the *ordering and
 * skipping* rules passes its own predicate, and the one test about renderedness stubs the DOM
 * method `isRendered` reads.
 */
export function runnableSteps(
  copy: PageCopy,
  root: Pick<ParentNode, "querySelector">,
  visible: (element: Element) => boolean = isRendered,
): TourStep[] {
  const steps: TourStep[] = [];
  for (const section of copy.sections ?? []) {
    const element = root.querySelector(anchorSelector(section.id));
    if (element === null || !visible(element)) continue;
    steps.push({ ...stepTextOf(copy, section.id), element });
  }
  return steps;
}
