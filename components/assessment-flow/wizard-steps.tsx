/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: the editor's tabs become numbered steps — a rail that says where the person is and a "step N of 3" line above the band; the back/next bar stays on the screen, because a step's next may be a form post rather than a link)
 *
 * The journey rail, shared (#618).
 *
 * `counterparty-wizard.tsx` drew this markup inline for the Counterparty's three onboarding
 * screens. The initiator's journey — products → product → create — is the same shape, so the rail
 * is one component both can draw instead of a second copy of the same `<ol>`, the same three dot
 * styles and the same `aria-current` rule. Nothing here decides anything: the caller passes the
 * step labels (from its own page fixture, E23) and which one is current. The labels arrive
 * resolved, so this file holds no copy of its own and no `sectionOf` call — E23 counts a literal
 * written here as a red build, and an id read here would be an id resolved against the wrong
 * surface.
 *
 * A server component: a rail is a list of words, so it ships no JavaScript.
 */
import Link from "next/link";

export interface WizardStep {
  /** 1-based: the number the dot draws, and what `current` is compared against. */
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
      <nav aria-label={label} data-wizard-rail={current}>
        <ol className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {steps.map((entry) => {
            const isCurrent = entry.step === current;
            const isDone = entry.step < current;
            const isUnavailable = entry.unavailable === true;
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={
                    isUnavailable
                      ? "flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-xs font-bold text-gray-400 dark:border-gray-600 dark:text-gray-500"
                      : isCurrent
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-action text-xs font-bold text-action-foreground"
                        : isDone
                          ? "flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white dark:bg-gray-200 dark:text-gray-900"
                          : "flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs font-bold dark:border-gray-600"
                  }
                >
                  {entry.step}
                </span>
                {entry.label}
                {isUnavailable && entry.note !== undefined ? (
                  <span className="sr-only">{entry.note}</span>
                ) : null}
              </>
            );
            const className = isUnavailable
              ? "flex items-center gap-2 text-gray-400 dark:text-gray-500"
              : isCurrent
                ? "flex items-center gap-2 font-semibold text-action"
                : isDone
                  ? "flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200"
                  : "flex items-center gap-2 text-gray-500 dark:text-gray-400";
            return (
              <li
                key={entry.step}
                aria-current={isCurrent ? "step" : undefined}
                data-step-state={
                  isUnavailable
                    ? "unavailable"
                    : isCurrent
                      ? "current"
                      : isDone
                        ? "done"
                        : "upcoming"
                }
                className={className}
              >
                {/* A live step with a screen opens it; everything else is a word in a list. */}
                {entry.href !== undefined && !isUnavailable && !isCurrent ? (
                  <Link href={entry.href} className={`${className} hover:underline`}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {count}
      </p>
    </>
  );
}
