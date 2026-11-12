/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: the editor's tabs become a measured cell band — equal cells across the content width, the current one filled, and a "step N of 3" line under the band; the back/next bar stays on the screen, because a step's next may be a form post rather than a link)
 *
 * The journey rail, shared (#618), redrawn as the measured cell rail (#716).
 *
 * `counterparty-wizard.tsx` drew this markup inline for the Counterparty's three onboarding
 * screens. The initiator's journey — products → product → create — is the same shape, so the rail
 * is one component both can draw instead of a second copy. Nothing here decides anything: the
 * caller passes the step labels (from its own page fixture, E23) and which one is current. The
 * labels arrive resolved, so this file holds no copy of its own and no `sectionOf` call — E23
 * counts a literal written here as a red build, and an id read here would be an id resolved
 * against the wrong surface.
 *
 * **Why a band of cells and not numbered circles.** `docs/specs/ux-reference-patterns.md` rule 4
 * measures the pattern off the reference captures and names three variants: the 8px continuous bar
 * for uniform quiz items, the secondary tab rail, and — for a surface whose steps are distinct
 * forms — the **cell rail**: a 39px band across the content width, one equal cell per step, no
 * seams, the current cell the filled one and the rest muted. It says plainly "never numbered
 * circles". The previous revision drew an `<ol>` of 24px numbered dots, which is the stepper that
 * rule forbids, so this is that rail in its measured shape rather than a second rail.
 *
 * The band carries no numeral of its own: the position is said in words by the count line under
 * it (`"Stage 6 of 6"`, filled by the caller), which is also what keeps the position readable at
 * 390 where the cells are narrow. Nothing here counts anything.
 *
 * **Not a list, deliberately.** Rule 4 forbids the numbered `<ol>` of circles this component used
 * to draw, and `lint/a11y/useSemanticElements` (correctly) refuses `role="list"` on a `div` as a
 * way of smuggling it back — so the band is what the reference draws: labelled cells in a `nav`
 * landmark with one `aria-current="step"`. The order and the position are not lost: the cells read
 * left to right in stage order, the current one is marked, and the line under the band says the
 * position in words (`"Stage 6 of 6"`) for anyone who cannot see the fill.
 *
 * A server component: a rail is a list of words, so it ships no JavaScript.
 */
import Link from "next/link";

export interface WizardStep {
  /** 1-based: the step's position, and what `current` is compared against. */
  readonly step: number;
  /** The step's name, already resolved from the caller's fixture. */
  readonly label: string;
  /**
   * Where the step opens, when it opens anywhere (#735). Absent on the rails that are pure
   * orientation (the create flow's first five stages advance through a form post, not a link), and
   * present only where a step has a screen of its own to reach — `Align`, once an assessment is
   * shared on the relationship.
   */
  readonly href?: string;
  /**
   * Drawn, but not live: `Align` before anything is shared. Wins over `href` — a step that is not
   * available is never a link, whatever a caller passed — and it is drawn muted rather than
   * hidden, because the sixth cell is part of the stage count the rail is stating.
   */
  readonly unavailable?: boolean;
  /**
   * The sentence a visually hidden span carries on an unavailable cell, already resolved from the
   * caller's fixture: a muted cell tells the eye and tells a screen reader nothing.
   */
  readonly note?: string;
}

/** The band's own height, from the reference capture (39px, one row of 14px labels). */
const BAND = "flex min-h-[39px] w-full items-stretch overflow-hidden rounded-md border";

/** One cell: equal width, no seam, its label centred inside it. */
const CELL =
  "flex min-w-0 flex-1 items-center justify-center px-1 text-center text-[11px] leading-tight sm:px-3 sm:text-sm";

export function WizardSteps({
  steps,
  current,
  count,
  label,
}: {
  steps: readonly WizardStep[];
  /** The step the person is on. Steps below it draw as done, above it as upcoming. */
  current: number;
  /** The "step N of 3" line, already filled by the caller. */
  count: string;
  /** The nav's accessible name, from the caller's fixture. */
  label: string;
}) {
  return (
    <>
      <nav aria-label={label} data-wizard-rail={current} data-progress="cell-rail">
        <div className={`${BAND} border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900`}>
          {steps.map((entry) => {
            const isCurrent = entry.step === current;
            const isDone = entry.step < current;
            /*
             * The stage a person is on is live by definition, so `current` wins over `unavailable`:
             * the answer sheet mounts this rail at `Align`, which is the stage it is *in*, and a
             * rail that muted its own stage would be describing the relationship's status instead
             * of the journey's position. `unavailable` has no caller since #825 — the sixth cell
             * it existed for (`Align`) is not in the flow — but the state stays supported here
             * because a caller that has one unavailable step of its own is the wizard this
             * component is named for.
             */
            const isUnavailable = entry.unavailable === true && !isCurrent;
            const state = isCurrent
              ? "current"
              : isUnavailable
                ? "unavailable"
                : isDone
                  ? "done"
                  : "upcoming";
            const className = `${CELL} ${
              isUnavailable
                ? "text-gray-400 dark:text-gray-500"
                : isCurrent
                  ? "bg-action font-semibold text-action-foreground"
                  : isDone
                    ? "font-medium text-gray-700 dark:text-gray-200"
                    : "text-gray-500 dark:text-gray-400"
            }`;
            const body = (
              <>
                {entry.label}
                {isUnavailable && entry.note !== undefined ? (
                  <span className="sr-only">{entry.note}</span>
                ) : null}
              </>
            );
            // A live step with a screen opens it; everything else is one cell of the band.
            return entry.href !== undefined && !isUnavailable && !isCurrent ? (
              <Link
                key={entry.step}
                href={entry.href}
                aria-current={isCurrent ? "step" : undefined}
                data-step-cell={entry.step}
                data-step-state={state}
                className={`${className} hover:underline`}
              >
                {body}
              </Link>
            ) : (
              <span
                key={entry.step}
                aria-current={isCurrent ? "step" : undefined}
                data-step-cell={entry.step}
                data-step-state={state}
                className={className}
              >
                {body}
              </span>
            );
          })}
        </div>
      </nav>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {count}
      </p>
    </>
  );
}
