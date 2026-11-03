// template-ancestor: components/my-quizzes/quiz-details.tsx (variation: one Steps list per Aspect, a done toggle, a rewordable sentence and a closed badge, not the Questions accordion — the rows are agreed actions, not the quiz's questions)
/**
 * "Steps for Improving the Relationship" — the panel the owner's mockup asks for, drawn from the
 * Steps **stored** on the relationship rather than from a fresh derivation (#478).
 *
 * This is the port of the `/v1` prototype's `steps-panel.tsx` into the screen that already writes the
 * rows: acceptance derives them (`lib/flow/store.ts::acceptSession`), `lib/db/steps.ts` stores them,
 * and until this file existed **no v2 screen read them at all**. The distinction the port keeps is the
 * whole point of the primitive (`content/steps.ts`): the report is a function of the current answers
 * and re-derives on every read, but a Step was agreed at a completion and carries a party's progress.
 * So this panel never computes a Gap — it prints the row it was given, which is why a tick survives a
 * reload and a later session cannot quietly rewrite the plan.
 *
 * **Who may write.** A party (Initiator or Counterparty) may tick a Step and reword it; a coach reads.
 * That is `canMark`, decided by the screen from the role the read resolved, and there is no control to
 * render when it is false — the panel has no disabled-looking buttons pretending to be permissions.
 * The store is still the authority: a hand-written POST is refused `not-a-party` (`writeStep`).
 *
 * **Three states.** `open` and `done` are the party's; `closed` is the model's — the Aspect's Gap has
 * since fallen to 0, so the row is history: badged, still readable, still showing what was agreed, and
 * not in the "N of M done" denominator. A closed row has no tick and no edit, because its words are a
 * record rather than a plan.
 *
 * **No JavaScript.** A tick is a form post and a reword is a `<details>` holding a second form, so the
 * panel works with the same no-JS discipline as the answer sheet and the acceptance screen — and the
 * screen is a server component, with no `"use client"` anywhere beneath it. The two forms are siblings,
 * never nested: a `<form>` inside a `<form>` is invalid markup, and a browser would silently drop the
 * inner one.
 *
 * The words are `data/pages/assessment-instance.ts`'s `steps` section (E23 counts the leaf literals
 * here and holds them at 0), except the three state labels — `STEP_STATUS_LABELS` in
 * `content/steps.ts`, authored once beside the state machine — and the Gap kind labels and the
 * authored-Step label, which are the model's own vocabulary.
 */
import { Check } from "lucide-react";

import { GAP_KIND_LABELS } from "@/content/gaps";
import {
  AUTHORED_STEP_LABEL,
  STEP_STATUS_LABELS,
  stepProgressOf,
  stepsForAspect,
  type Step,
  type StepStatus,
} from "@/content/steps";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/** One Aspect as the panel groups by it: the review screen already holds the prompt. */
export interface StepsAspect {
  readonly itemId: string;
  readonly prompt: string;
}

/**
 * The panel.
 *
 * `action` is the POST endpoint (`stepsPath(instanceRecordId)`); every control on the panel submits
 * to it with the Step's id and nothing else that identifies anybody — the seat comes from the party
 * cookie inside the store's transaction, never from a form field.
 */
export function StepsPanel({
  steps,
  aspects,
  action,
  canMark,
  aligned,
  copy,
}: {
  steps: readonly Step[];
  aspects: readonly StepsAspect[];
  action: string;
  /** A party writes; a coach reads. The screen decides, the panel renders. */
  canMark: boolean;
  /** Both parties' answers were In Synch under the Setting: the empty state says so. */
  aligned: boolean;
  copy: PageCopy;
}) {
  const band = sectionOf(copy, "steps");
  const progress = stepProgressOf(steps);

  // The order a reader walks: the instance's own Aspects first, then any Aspect a Step names that the
  // instance no longer holds. Nothing is hidden for being removed — a Step outlives the Aspect it names.
  const prompts = new Map<string, string>();
  for (const aspect of aspects) prompts.set(aspect.itemId, aspect.prompt);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of [
    ...aspects.map((aspect) => aspect.itemId),
    ...steps.map((step) => step.aspectId),
  ]) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (stepsForAspect(steps, id).length > 0) ordered.push(id);
  }

  return (
    <section aria-labelledby="steps-heading" className="mt-8 space-y-3" data-steps-panel="true">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="steps-heading" className="text-base font-semibold text-foreground">
          {band.heading}
        </h2>
        {steps.length > 0 ? (
          <p className="text-xs text-muted-foreground" data-steps-progress>
            {fillLabel(itemLabel(band, "progress"), {
              done: progress.done,
              active: progress.active,
            })}
            {progress.closed > 0
              ? ` · ${fillLabel(itemLabel(band, "progress-closed"), { closed: progress.closed })}`
              : null}
          </p>
        ) : null}
      </div>

      {steps.length === 0 ? (
        <div
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          data-steps-empty="true"
        >
          <p className="text-sm font-medium text-foreground">{itemLabel(band, "empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {itemLabel(band, aligned ? "empty-body-aligned" : "empty-body")}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{sectionBody(band)}</p>
          {canMark ? null : (
            <p className="text-xs text-muted-foreground" data-steps-read-only="true">
              {itemLabel(band, "read-only")}
            </p>
          )}
          <div className="space-y-3">
            {ordered.map((aspectId) => {
              const rows = stepsForAspect(steps, aspectId);
              return (
                <div
                  key={aspectId}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                  data-steps-aspect={aspectId}
                >
                  <p className="text-sm font-medium text-foreground">
                    {prompts.get(aspectId) ?? aspectId}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {rows.map((step) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        action={action}
                        canMark={canMark}
                        copy={copy}
                      />
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

/** The next status a tick writes: a done Step's tick takes it back to open. */
function nextStatusOf(step: Step): StepStatus {
  return step.status === "done" ? "open" : "done";
}

/** One Step: its words (and the suggestion behind them), where it came from, and its two controls. */
function StepRow({
  step,
  action,
  canMark,
  copy,
}: {
  step: Step;
  action: string;
  canMark: boolean;
  copy: PageCopy;
}) {
  const band = sectionOf(copy, "steps");
  const done = step.status === "done";
  const closed = step.status === "closed";
  const next = nextStatusOf(step);
  const kinds =
    step.derivedFrom.length === 0
      ? AUTHORED_STEP_LABEL
      : step.derivedFrom.map((kind) => GAP_KIND_LABELS[kind]).join(" · ");
  // The suggestion is only worth repeating when somebody has actually reworded the Step.
  const showSuggestion = step.suggestedText !== undefined && step.suggestedText !== step.text;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border bg-background px-3 py-2",
        closed
          ? "border-dashed border-gray-300 dark:border-gray-600"
          : "border-gray-200 dark:border-gray-700",
      )}
      data-step-id={step.id}
      data-step-status={step.status}
    >
      {canMark && !closed ? (
        <form method="post" action={action} className="mt-0.5">
          <input type="hidden" name="stepId" value={step.id} />
          <input type="hidden" name="status" value={next} />
          <button
            type="submit"
            aria-pressed={done}
            aria-label={fillLabel(itemLabel(band, done ? "mark-open" : "mark-done"), {
              text: step.text,
            })}
            data-step-toggle={step.id}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded border",
              done
                ? "border-action bg-action text-action-foreground"
                : "border-gray-300 bg-card text-transparent hover:bg-muted dark:border-gray-600",
            )}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border",
            done
              ? "border-action bg-action text-action-foreground"
              : "border-gray-300 bg-card dark:border-gray-600",
          )}
          aria-hidden="true"
        >
          {done ? <Check className="h-4 w-4" /> : null}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            closed
              ? "text-muted-foreground"
              : done
                ? "text-muted-foreground line-through"
                : "text-foreground",
          )}
        >
          {step.text}
        </p>

        {showSuggestion ? (
          <p className="mt-1 text-xs text-muted-foreground" data-step-suggestion>
            {fillLabel(itemLabel(band, "suggested"), { text: step.suggestedText ?? "" })}
          </p>
        ) : null}

        <p className="mt-0.5 text-xs text-muted-foreground">
          {kinds} · {STEP_STATUS_LABELS[step.status]}
          {closed ? ` — ${itemLabel(band, "closed-note")}` : null}
        </p>

        {/* A closed Step is history: no tick, no edit, no form at all. */}
        {canMark && !closed ? (
          <details className="mt-1" data-step-edit-form={step.id}>
            <summary className="cursor-pointer text-xs underline underline-offset-2 hover:text-foreground">
              {itemLabel(band, "edit")}
            </summary>
            <form method="post" action={action} className="mt-2 space-y-2">
              <input type="hidden" name="stepId" value={step.id} />
              <textarea
                name="text"
                defaultValue={step.text}
                rows={3}
                aria-label={itemLabel(band, "step-text")}
                className="w-full rounded-md border border-gray-300 bg-background px-2 py-1 text-sm text-foreground dark:border-gray-600"
              />
              <button
                type="submit"
                className="inline-flex h-7 items-center rounded-md bg-action px-2 text-xs font-medium text-action-foreground"
              >
                {itemLabel(band, "save")}
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </li>
  );
}
