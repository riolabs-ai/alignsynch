"use client";

// template-ancestor: components/assessment-flow/answer-form.tsx   (variation: the real sheet under a script — the radios are clicked by a timer instead of a person, the other party's scores are revealed beside them once it finishes, and no submit can leave the page)

/**
 * The tour's example (#457) — the **real answer sheet**, filling itself, writing nothing.
 *
 * **Why the real component and not a picture of one.** `AnswerForm` is what
 * `/assessment/instances/[id]` renders, and it is mounted here unchanged: the same
 * `<fieldset>` per Aspect, the same five-notch radio groups, the same `name="${kind}:${itemId}"`
 * names the submit endpoint parses, the same `required` on notch 1. The script drives those
 * inputs with `HTMLElement.click()` — a real click on the real control — so the DOM's own checked
 * state, the `peer-checked` fill, the check glyph and the form's own validation all run. A
 * `value =` write or a parallel mini-form would be a second sheet that can drift from the first
 * one, which is the defect this component exists to avoid.
 *
 * **Why it cannot write.** The form's only writer is its submit button, and the effect below
 * cancels that event on the form itself before the browser can navigate: `action="#"` plus a
 * captured `submit` that calls `preventDefault()`. A click on Submit therefore still says what a
 * person needs to hear — "nothing was saved" — and the four tables stay at their counts. Nothing
 * here opens a request of any kind: no `fetch`, no server action, no `lib/db/**` import (E34
 * walks this graph and would fail a value import of a server module).
 *
 * **Stops on touch.** Any real keypress, pointer press or focus inside the sheet cancels the
 * remaining ticks and leaves whatever is already answered in place — control is handed over, not
 * taken away. The script's own `.click()` calls are excluded by a flag rather than by
 * `event.isTrusted`, so the rule is testable in jsdom, where a dispatched event is never trusted.
 * After a cancel the sheet stays fillable and a "start the example again" control is offered.
 *
 * **Reduced motion fills instantly.** `prefersReducedMotion()` is read once per run: with the
 * preference set there is no tick per answer, one state change puts every scripted answer in,
 * and the reveal is immediate. There is nothing to animate, so nothing waits.
 *
 * **It starts when the tour arrives.** Step 4 fires `announceTourStep("answer")`
 * (`lib/tour/first-run-tour.tsx`); this component listens (`onTourStep`) and starts its script
 * then — so the example is not already finished by the time the step that describes it opens.
 *
 * **The answers are not written here.** They are `data/pages/tour.ts::tourDemoAnswers`, the same
 * values step 4's sentence quotes, passed in by the page as `answers`. Two places read one
 * export, which is the whole reason the copy and the sheet cannot disagree.
 *
 * **No reader-visible string lives in this file.** The example line, both column labels, the Gap,
 * the cancel and restart sentences and the "nothing was saved" line are page items in
 * `data/pages/tour.ts`; the sheet's own headings and Opinion names are its own fixture, handed in
 * as `sheetCopy`. `components/tour/**` is at a literal budget of 0 (E23).
 */
import { AnswerForm } from "@/components/assessment-flow/answer-form";
import type { AssessmentMode, OpinionKind } from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { gapOf, SCORE_MAX, SCORE_MIN, type Score } from "@/content/record";
import type { FlowAspect } from "@/lib/flow/screen";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import {
  demoAnswerSelector,
  onTourStep,
  prefersReducedMotion,
  TOUR_DEMO_STEP,
} from "@/lib/tour/demo-script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * One scripted answer, structurally. Declared here rather than imported from the fixture so this
 * module reaches no `data/` module at all — `dashboard/page.tsx` hands the typed array down, the
 * same way it hands down copy.
 */
export interface DemoAnswer {
  readonly aspect: number;
  readonly kind: OpinionKind;
  readonly you: Score;
  readonly theirs: Score;
}

/** One answer resolved against the sheet that is actually on the page. */
interface PlannedAnswer {
  readonly aspect: FlowAspect;
  readonly kind: OpinionKind;
  readonly you: Score;
  readonly theirs: Score;
}

/** Which part of its own life the example is in — also the element's `data-demo-phase`. */
type Phase = "idle" | "filling" | "done" | "cancelled";

/**
 * How long each scripted answer waits before it is clicked. Slow enough that a person reads the
 * sheet filling (the point of the example), fast enough that four answers finish in about two
 * seconds; reduced motion skips it entirely.
 */
const TICK_MS = 480;

/** A batch of notches, so a score reads as a position on the 1..5 band without a second scale. */
function Notches({ score }: { score: number }) {
  const notches: number[] = [];
  for (let notch = SCORE_MIN; notch <= SCORE_MAX; notch += 1) notches.push(notch);
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-0.5">
      {notches.map((notch) => (
        <span
          key={notch}
          className={
            notch <= score
              ? "h-2.5 w-3 rounded-sm bg-action"
              : "h-2.5 w-3 rounded-sm bg-muted-foreground/25"
          }
        />
      ))}
    </span>
  );
}

/** The script, resolved against the Aspects this page actually drew. */
function planOf(aspects: readonly FlowAspect[], answers: readonly DemoAnswer[]): PlannedAnswer[] {
  const plan: PlannedAnswer[] = [];
  for (const answer of answers) {
    const aspect = aspects[answer.aspect];
    if (aspect === undefined) continue;
    plan.push({ aspect, kind: answer.kind, you: answer.you, theirs: answer.theirs });
  }
  return plan;
}

/** The reveal's rows, grouped by Aspect, in the order the sheet asks them. */
function revealOf(plan: readonly PlannedAnswer[]) {
  const groups = new Map<string, { aspect: FlowAspect; rows: PlannedAnswer[] }>();
  for (const step of plan) {
    const group = groups.get(step.aspect.itemId) ?? { aspect: step.aspect, rows: [] };
    group.rows.push(step);
    groups.set(step.aspect.itemId, group);
  }
  return [...groups.values()];
}

export function DemoFill({
  copy,
  sheetCopy,
  aspects,
  answers,
  exampleTitle,
  mode,
}: {
  copy: PageCopy;
  /** `data/pages/assessment-instance.ts` — the sheet's own words, never a copy of them. */
  sheetCopy: PageCopy;
  aspects: readonly FlowAspect[];
  answers: readonly DemoAnswer[];
  /** The template the questions come from, so the example can say whose questions they are. */
  exampleTitle: string;
  mode: AssessmentMode;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [submitted, setSubmitted] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  /** `true` while the script's own click is in flight — the only events that cannot cancel it. */
  const scripting = useRef(false);
  /** `true` while ticks are pending — what "cancel" has to cancel. */
  const running = useRef(false);

  const plan = useMemo(() => planOf(aspects, answers), [aspects, answers]);
  const reveal = useMemo(() => revealOf(plan), [plan]);

  const example = pageItemOf(copy, "demo-example").label;
  const exampleNote = pageItemOf(copy, "demo-example-note").label;
  const source = fillLabel(pageItemOf(copy, "demo-source").label, { title: exampleTitle });
  const yoursLabel = pageItemOf(copy, "demo-yours").label;
  const theirsLabel = pageItemOf(copy, "demo-theirs").label;
  const gapHeading = pageItemOf(copy, "demo-gap-heading").label;
  const gapLabel = pageItemOf(copy, "demo-gap").label;
  const noGapLabel = pageItemOf(copy, "demo-no-gap").label;
  const cancelledLabel = pageItemOf(copy, "demo-cancelled").label;
  const againLabel = pageItemOf(copy, "demo-again").label;
  const savedNothing = pageItemOf(copy, "demo-saved-nothing").label;
  const sheetAnswer = sectionOf(sheetCopy, "answer");

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  /** Put one scripted answer into the real control. */
  const apply = useCallback(
    (index: number) => {
      const step = plan[index];
      const root = sheetRef.current;
      if (step === undefined || root === null) return;
      const input = root.querySelector<HTMLInputElement>(
        demoAnswerSelector(step.aspect.itemId, step.kind, step.you),
      );
      if (input === null) return;
      scripting.current = true;
      input.click();
      scripting.current = false;
    },
    [plan],
  );

  const start = useCallback(() => {
    if (plan.length === 0) return;
    clearTimers();
    setSubmitted(false);
    setPhase("filling");
    if (prefersReducedMotion()) {
      for (let index = 0; index < plan.length; index += 1) apply(index);
      setPhase("done");
      return;
    }
    running.current = true;
    plan.forEach((_step, index) => {
      const timer = window.setTimeout(
        () => {
          apply(index);
          if (index + 1 === plan.length) {
            running.current = false;
            setPhase("done");
          }
        },
        TICK_MS * (index + 1),
      );
      timers.current.push(timer);
    });
  }, [apply, clearTimers, plan]);

  /** Hand control back: whatever is answered stays answered, and no later tick overwrites it. */
  const handOver = useCallback(() => {
    if (scripting.current || !running.current) return;
    running.current = false;
    clearTimers();
    setPhase("cancelled");
  }, [clearTimers]);

  // The tour's step 4 is what starts the example.
  useEffect(() => {
    const off = onTourStep((stepId) => {
      if (stepId === TOUR_DEMO_STEP) start();
    });
    return () => {
      off();
      running.current = false;
      clearTimers();
    };
  }, [clearTimers, start]);

  // The one guard that matters: the example's submit can never leave the page.
  useEffect(() => {
    const form = sheetRef.current?.querySelector("form");
    if (form === null || form === undefined) return;
    const block = (event: Event): void => {
      event.preventDefault();
      setSubmitted(true);
    };
    form.addEventListener("submit", block);
    return () => form.removeEventListener("submit", block);
  }, []);

  return (
    <section
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      data-demo=""
      data-demo-phase={phase}
      onKeyDownCapture={handOver}
      onPointerDownCapture={handOver}
      onFocusCapture={handOver}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{example}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300">{exampleNote}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{source}</p>

      {phase === "cancelled" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p data-demo-cancelled="">{cancelledLabel}</p>
          <button
            type="button"
            className="mt-2 rounded-md border border-amber-300 px-3 py-1 text-sm font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
            onClick={start}
          >
            {againLabel}
          </button>
        </div>
      ) : null}

      {submitted ? (
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100" data-demo-submitted="">
          {savedNothing}
        </p>
      ) : null}

      {/* The tour's fourth step aims here: the real sheet, not a picture of one. */}
      <div ref={sheetRef} data-tour="answer">
        <AnswerForm
          copy={sheetCopy}
          aspects={aspects}
          // A demo's action is never taken: the submit listener above prevents the default, and
          // `#` is a document-local fragment, so even an unblocked submit could not reach a route.
          action="#"
          hasAnswers={false}
          mode={mode}
        />
      </div>

      {phase === "done" ? (
        <div className="mt-4 space-y-4" data-demo-gap="">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{gapHeading}</h3>
          {reveal.map((group) => (
            <div key={group.aspect.itemId} data-demo-aspect={group.aspect.itemId}>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {group.aspect.prompt}
              </p>
              <ul className="mt-2 space-y-1">
                {group.rows.map((row) => {
                  const gap = gapOf(row.you, row.theirs);
                  return (
                    <li
                      key={row.kind}
                      className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                      data-demo-kind={row.kind}
                    >
                      <span className="w-12 text-gray-500 dark:text-gray-400">
                        {itemLabel(sheetAnswer, row.kind)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        {fillLabel(yoursLabel, { value: row.you })}
                        <Notches score={row.you} />
                      </span>
                      <span className="inline-flex items-center gap-2">
                        {fillLabel(theirsLabel, { value: row.theirs })}
                        <Notches score={row.theirs} />
                      </span>
                      <span
                        className="font-semibold text-gray-900 dark:text-gray-100"
                        data-demo-gap-value={gap}
                      >
                        {gap === 0 ? noGapLabel : fillLabel(gapLabel, { value: gap })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
