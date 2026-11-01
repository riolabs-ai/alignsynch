"use client";

// template-ancestor: components/quiz/quiz-play.tsx   (variation: progress and N-of-M shell only, no timer, no correctness, no score)

/**
 * The blind opinion-answering sheet — the stepper shell, made honest.
 *
 * The ancestor is a run: one question at a time, with a timer, a correct/incorrect
 * overlay and a final percentage. None of that belongs here. What this sheet copies is
 * only the *shell* — the progress bar and the "Aspect N of M" counter — wrapped around
 * the five-notch band `answer-form.tsx` already owns. There is no timer, no correctness
 * feedback, and no reveal of the other party: the only answers in view are the viewer's
 * own, one Aspect at a time, until both parties have submitted and the report opens.
 *
 * The notch band is copied verbatim from `answer-form.tsx` (the 44px touch targets and
 * the `has-[:checked]` styling), because a segment smaller than 44px is a smaller tap
 * target and the five notches at 390px must stay five usable ones: 5 × 44px + 4 gaps =
 * 236px. The kind labels ("Feel" / "Wish" / "Think" / "Guess") and the submit label are
 * read from the answer copy fixture (`copy`), never re-typed here.
 *
 * The action bar is sticky at the bottom on mobile (`sticky bottom-0`) and static from
 * `sm:` up. No sticky action bar exists anywhere else in this tree — this is the first,
 * and it is stated as one so the next surface reuses it rather than rediscovering it.
 */
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { opinionKindsFor, type AssessmentMode, type OpinionKind } from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { SCORE_MAX, SCORE_MIN, type Score } from "@/content/record";
import type { FlowAspect } from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

/** A segment's target box: 44×44 CSS px, the same constant `answer-form.tsx` uses. */
const TARGET_SIZE = "min-h-[44px] min-w-[44px]";

/** The segment skin, copied verbatim from `answer-form.tsx` so the two bands match. */
const SEGMENT = [
  TARGET_SIZE,
  "relative flex cursor-pointer items-center justify-center gap-1 rounded-md border-2",
  "border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-action/60",
  "has-[:checked]:border-action has-[:checked]:bg-action has-[:checked]:font-semibold",
  "has-[:checked]:text-action-foreground",
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action has-[:focus-visible]:ring-offset-2",
  "has-[:focus-visible]:ring-offset-white",
  "dark:border-gray-600 dark:bg-gray-950 dark:text-gray-200",
  "dark:has-[:checked]:border-action dark:has-[:checked]:bg-action",
  "dark:has-[:checked]:text-action-foreground dark:has-[:focus-visible]:ring-offset-gray-950",
].join(" ");

/** One Aspect's answers, keyed by opinion kind — only the viewer's own, never the other party's. */
type AspectAnswers = Partial<Record<OpinionKind, Score>>;

export interface OpinionSheetProps {
  /** The answer copy fixture: kind labels and the submit label live here. */
  copy: PageCopy;
  /** The Aspects to answer, in order. `own` seeds any answers already given. */
  aspects: readonly FlowAspect[];
  /** The instance's mode — decides which kinds the band asks (Feel/Wish, or all four). */
  mode: AssessmentMode;
  /** Called with every Aspect's answers when the viewer submits on the last Aspect. */
  onSubmit: (answers: Record<string, AspectAnswers>) => void;
}

export function OpinionSheet({ copy, aspects, mode, onSubmit }: OpinionSheetProps) {
  const section = sectionOf(copy, "answer");
  const kinds = opinionKindsFor(mode);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AspectAnswers>>(() => {
    const seed: Record<string, AspectAnswers> = {};
    for (const aspect of aspects) {
      seed[aspect.itemId] = aspect.own ? { ...aspect.own } : {};
    }
    return seed;
  });

  if (aspects.length === 0) return null;

  const aspect = aspects[index];
  const total = aspects.length;
  const progress = ((index + 1) / total) * 100;
  const hasAnswers = aspects.some((candidate) => candidate.own !== null);
  const isLast = index === total - 1;

  const notches: number[] = [];
  for (let notch = SCORE_MIN; notch <= SCORE_MAX; notch += 1) notches.push(notch);

  const setNotch = (kind: OpinionKind, notch: Score) =>
    setAnswers((prev) => ({
      ...prev,
      [aspect.itemId]: { ...prev[aspect.itemId], [kind]: notch },
    }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <div className="text-sm font-medium">
          Aspect {index + 1} of {total}
        </div>
        <Progress value={progress} className="mt-2 h-2" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {aspect.prompt}
        </h2>
        <p className="mb-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span>{aspect.leftValue}</span>
          <span className="mx-2 text-gray-400 dark:text-gray-500">—</span>
          <span>{aspect.rightValue}</span>
        </p>

        {kinds.map((kind) => (
          <fieldset key={kind} data-kind={kind} className="mt-4">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(section, kind)}
            </legend>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {notches.map((notch) => {
                const name =
                  notch === SCORE_MIN
                    ? `${aspect.leftValue} — ${notch}`
                    : notch === SCORE_MAX
                      ? `${aspect.rightValue} — ${notch}`
                      : `${notch}`;
                return (
                  <label key={notch} data-notch={notch} className={SEGMENT}>
                    <input
                      type="radio"
                      name={`${kind}-${aspect.itemId}`}
                      value={notch}
                      checked={answers[aspect.itemId]?.[kind] === notch}
                      onChange={() => setNotch(kind, notch)}
                      aria-label={name}
                      className="peer sr-only"
                    />
                    <span aria-hidden="true" className="hidden peer-checked:inline">
                      ✓
                    </span>
                    <span aria-hidden="true">{notch}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-gray-200 bg-background p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0 dark:border-gray-700">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          variant="action"
          onClick={() => (isLast ? onSubmit(answers) : setIndex((current) => current + 1))}
        >
          {isLast ? itemLabel(section, hasAnswers ? "resubmit" : "submit") : "Next"}
          {isLast ? null : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
