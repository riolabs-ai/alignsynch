// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: one Steps list per Aspect with a done toggle, not the Questions accordion — the rows are agreed actions, not the quiz's questions)
"use client";

import { GAP_KIND_LABELS } from "@/content/gaps";
import {
  STEP_STATUS_LABELS,
  stepProgressOf,
  stepsForAspect,
  type Step,
  type StepStatus,
} from "@/content/steps";
import type { V1Relationship } from "@/data/v1/fixtures";
import { sessionCompleteOf } from "@/lib/v1/derive";
import { EmptyState } from "@/components/v1/v1-ui";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * "Steps for Improving the Relationship" — the panel the owner's mockup asks for, rendered from the
 * Steps **stored** on the relationship rather than from a fresh derivation.
 *
 * The distinction is the whole point of the primitive (`content/steps.ts`): the report is a function
 * of the current answers and re-derives on every read, but a Step was agreed at a completion and
 * carries a party's progress. So this panel never computes a Gap — it prints the row it was given,
 * which is why a tick survives a reload and a later session cannot quietly rewrite the plan.
 *
 * **Who may tick.** A party (Initiator or Counterparty) may; a coach and an operator read. That is
 * `canMark`, handed in by the surface, and there is no control to render when it is false — the
 * panel has no disabled-looking buttons pretending to be permissions.
 *
 * The words are never re-authored here: `text` comes from the row, and the Aspect heading is the
 * Aspect's own prompt (looked up on the relationship, falling back to a soft-deleted Aspect's copy,
 * because a Step outlives the Aspect it names — like every other fact the store keeps).
 */
export function StepsPanel({
  rel,
  canMark,
  onToggle,
}: {
  rel: V1Relationship;
  /** A party may mark progress; a coach reads. The surfaces decide, the panel renders. */
  canMark: boolean;
  onToggle?: (stepId: string, status: StepStatus) => void;
}) {
  const progress = stepProgressOf(rel.steps);
  const prompts = new Map<string, string>();
  for (const item of [...rel.items, ...rel.deletedAspects]) prompts.set(item.id, item.prompt);

  // The order a reader walks: the relationship's own Aspects first, then any Aspect a Step names
  // that has since been soft-deleted (or that the blueprint lost), whose prompt still resolves from
  // the soft-deleted copy. Nothing is hidden for being removed — a Step outlives the Aspect it names.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of [
    ...rel.items.map((item) => item.id),
    ...rel.deletedAspects.map((item) => item.id),
    ...rel.steps.map((step) => step.aspectId),
  ]) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (stepsForAspect(rel.steps, id).length > 0) ordered.push(id);
  }

  return (
    <section aria-labelledby="steps-heading" className="space-y-3" data-steps-panel="true">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="steps-heading" className="text-base font-semibold text-foreground">
          Steps for Improving the Relationship
        </h2>
        {rel.steps.length > 0 && (
          <p className="text-xs text-muted-foreground" data-steps-progress>
            {progress.done} of {progress.total} done
          </p>
        )}
      </div>

      {rel.steps.length === 0 ? (
        <EmptyState
          title="No Steps yet"
          body={
            sessionCompleteOf(rel)
              ? "Every Gap on the last session was In Synch, so there is nothing to work on."
              : "Steps appear when you both accept a session — each one is derived from the Gaps you agreed on, and then kept here so you can mark it done."
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Each Step comes from one Gap the last session measured. Tick it off as you work through
            it — the list is kept on this relationship, so it survives a reload and a new session
            only adds to it.
          </p>
          <div className="space-y-3">
            {ordered.map((aspectId) => {
              const rows = stepsForAspect(rel.steps, aspectId);
              return (
                <div
                  key={aspectId}
                  className="rounded-lg border border-border bg-card p-4"
                  data-steps-aspect={aspectId}
                >
                  <p className="text-sm font-medium text-foreground">
                    {prompts.get(aspectId) ?? aspectId}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {rows.map((step) => (
                      <StepRow key={step.id} step={step} canMark={canMark} onToggle={onToggle} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/** One Step: its words, the kind it came from, and the tick a party can set. */
function StepRow({
  step,
  canMark,
  onToggle,
}: {
  step: Step;
  canMark: boolean;
  onToggle?: (stepId: string, status: StepStatus) => void;
}) {
  const done = step.status === "done";
  const next: StepStatus = done ? "open" : "done";
  const kinds = step.derivedFrom.map((kind) => GAP_KIND_LABELS[kind]).join(" · ");

  return (
    <li
      className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2"
      data-step-id={step.id}
      data-step-status={step.status}
    >
      {canMark ? (
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? `Mark open: ${step.text}` : `Mark done: ${step.text}`}
          onClick={() => onToggle?.(step.id, next)}
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border",
            done
              ? "border-action bg-action text-action-foreground"
              : "border-border bg-card text-transparent hover:bg-muted",
          )}
          data-step-toggle={step.id}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border",
            done ? "border-action bg-action text-action-foreground" : "border-border bg-card",
          )}
          aria-hidden="true"
        >
          {done ? <Check className="h-4 w-4" /> : null}
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-foreground")}
        >
          {step.text}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {kinds} · {STEP_STATUS_LABELS[step.status]}
        </p>
      </div>
    </li>
  );
}
