/**
 * The tour's example's plumbing (#457) — which answers get clicked, when a step opens the demo,
 * and the one projection that turns a template's Aspects into what the real sheet asks.
 *
 * Three pure things and no React, so `demo-fill.tsx` stays a view and this file can be reasoned
 * about (and tested) without a renderer:
 *
 *   `demoAspectsOf`      a template → the `FlowAspect[]` `AnswerForm` takes. The example is two
 *                        Aspects of a published template, not invented questions: the same rows
 *                        `data/assessments.ts` ships and `pnpm db:seed` mirrors into the database.
 *   the step event       driver.js owns the tour's own timeline, so "the tour has arrived at step
 *                        4" is announced as a DOM event and the demo listens. Both ends are
 *                        client components mounted by one page; a CustomEvent is the smallest
 *                        channel that does not make one of them own the other.
 *   `prefersReducedMotion` the media query, read once per run, with a jsdom-safe absence.
 *
 * **The answers themselves are not here** — they are `data/pages/tour.ts::tourDemoAnswers`,
 * because they are also quoted in step 4's sentence, and that fixture is the one module both the
 * copy and the demo read. This file decides *how* a scripted answer becomes a click; the fixture
 * decides *what* the answer is.
 *
 * Nothing here touches the network, the database or the session: the demo writes nothing, and the
 * only thing that can write is the submit button, which the component blocks.
 */
import type { Assessment, AssessmentMode } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { FlowAspect } from "@/lib/flow/screen";

/**
 * The step whose arrival starts the example — `data/pages/tour.ts`'s section id, and the anchor
 * `data-tour="answer"` on the demo's own wrapper. Renaming the step is a three-file change by
 * design (fixture, markup, this constant), exactly as `lib/tour/steps.ts` argues for.
 */
export const TOUR_DEMO_STEP = "answer";

/**
 * The template the example's questions come from — a published record in `data/assessments.ts`,
 * so the two Aspects the sheet asks are real questions a person can open after the tour.
 */
export const TOUR_DEMO_TEMPLATE_ID = "assessment-relationship-basics";

/**
 * How many Aspects the example asks — `demoAspectsOf`'s default. A constant, not a prop, because
 * the sheet's length is a design decision the fixture's answers are written against.
 */
export const TOUR_DEMO_ASPECT_COUNT = 2;

/**
 * The mode the example is played in. Templates carry no mode (an **instance** records one), and
 * Basic is the shortest honest sheet: two Opinions per Aspect, which is what the script's answers
 * are written for (`data/pages/tour.ts::tourDemoAnswers`).
 */
export const TOUR_DEMO_MODE: AssessmentMode = "basic";

/** The event a tour step change fires on `document`, and the id it carries in `detail`. */
export const TOUR_STEP_EVENT = "tour:step";

/**
 * A template's first Aspects as the sheet asks them — the projection `AnswerForm` takes.
 *
 * `own` is `null` on purpose: the example starts blank, and a pre-selected answer is an answer
 * the person did not give (the same rule `components/assessment-flow/answer-form.tsx` states).
 * `min`/`max` are the model's scale constants rather than a number typed twice, and the template's
 * items are taken in authored order — the fixture's order *is* the sheet's order.
 */
export function demoAspectsOf(
  template: Assessment,
  count: number = TOUR_DEMO_ASPECT_COUNT,
): FlowAspect[] {
  return template.items.slice(0, count).map((item) => ({
    itemId: item.id,
    prompt: item.prompt,
    leftValue: item.leftValue,
    rightValue: item.rightValue,
    min: SCORE_MIN,
    max: SCORE_MAX,
    own: null,
  }));
}

/**
 * The selector one scripted answer clicks — the real control, by the same `name` the submit
 * endpoint parses (`${kind}:${itemId}`) and the same 1..5 `value` the radio carries.
 *
 * A selector rather than a direct element reference because the script resolves its target at
 * click time: the demo must act on the document it is in now, not on a node captured before a
 * re-render replaced it.
 */
export function demoAnswerSelector(itemId: string, kind: string, score: number): string {
  return `input[name="${kind}:${itemId}"][value="${score}"]`;
}

/**
 * Tell the page which step the tour just highlighted. Guarded on `document` so the module can be
 * imported on the server (the fixture imports nothing from here, but the gate compiles every
 * module) without a `window is not defined`.
 */
export function announceTourStep(stepId: string): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(TOUR_STEP_EVENT, { detail: stepId }));
}

/**
 * Listen for a step change, and hand back the unsubscribe a `useEffect` returns.
 *
 * The listener reads `event.detail` as a string and ignores anything else: a CustomEvent's detail
 * is `any`, and a demo that trusted it would throw on a malformed dispatch from a sibling.
 */
export function onTourStep(listener: (stepId: string) => void): () => void {
  if (typeof document === "undefined") return () => {};
  const handler = (event: Event): void => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (typeof detail === "string") listener(detail);
  };
  document.addEventListener(TOUR_STEP_EVENT, handler);
  return () => document.removeEventListener(TOUR_STEP_EVENT, handler);
}

/**
 * Whether the reader asked for less motion. The demo then fills in one pass instead of one answer
 * per tick: there is nothing to animate, and a person who set the preference should not wait out
 * an animation they cannot see.
 *
 * `matchMedia` is absent in jsdom and in an older engine, and the honest answer there is "no
 * preference expressed" — never a throw inside an effect.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
