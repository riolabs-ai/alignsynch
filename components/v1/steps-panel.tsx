// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: one Steps list per Aspect with a done toggle, a rewordable sentence and a closed badge, not the Questions accordion — the rows are agreed actions, not the quiz's questions)
"use client";

import { useState } from "react";
import { GAP_KIND_LABELS } from "@/content/gaps";
import {
  AUTHORED_STEP_LABEL,
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
 * **Who may write.** A party (Initiator or Counterparty) may tick a Step, reword it, and add one of
 * their own; a coach and an operator read. That is `canMark`, handed in by the surface, and there is
 * no control to render when it is false — the panel has no disabled-looking buttons pretending to
 * be permissions.
 *
 * **Three states.** `open` and `done` are the party's; `closed` is the model's — the Aspect's Gap has
 * since fallen to 0, so the row is history: badged, still readable, still showing what was agreed,
 * and not in the "N of M done" denominator. A closed row has no tick and no edit, because its words
 * are a record rather than a plan.
 *
 * The words are never re-authored here: `text` comes from the row, `suggestedText` (when there is
 * one) is shown beneath it as the sentence the product proposed, and the Aspect heading is the
 * Aspect's own prompt (looked up on the relationship, falling back to a soft-deleted Aspect's copy,
 * because a Step outlives the Aspect it names — like every other fact the store keeps).
 */
export function StepsPanel({
  rel,
  canMark,
  onToggle,
  onEditText,
  onAddStep,
}: {
  rel: V1Relationship;
  /** A party writes; a coach reads. The surfaces decide, the panel renders. */
  canMark: boolean;
  onToggle?: (stepId: string, status: StepStatus) => void;
  /** Reword one Step. The suggestion stays behind it; `content/steps.ts` keeps both. */
  onEditText?: (stepId: string, text: string) => void;
  /** Add a Step a party wrote from nothing, on one of the relationship's Aspects. */
  onAddStep?: (aspectId: string, text: string) => string | null;
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
            {progress.done} of {progress.active} done
            {progress.closed > 0 && ` · ${progress.closed} closed`}
          </p>
        )}
      </div>

      {rel.steps.length === 0 ? (
        <EmptyState
          title="No Steps yet"
          body={
            sessionCompleteOf(rel)
              ? "Every Gap on the last session was In Synch, so there is nothing to work on — unless you want to add a Step of your own."
              : "Steps appear when you both accept a session — each one is derived from the widest Gap on its Aspect, and then kept here so you can mark it done."
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Each Step comes from the widest Gap on its Aspect in the last session. Tick it off, or
            reword it into something you will actually do — the suggestion stays beside your words,
            and the list is kept on this relationship, so it survives a reload and a new session
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
                      <StepRow
                        key={step.id}
                        step={step}
                        canMark={canMark}
                        onToggle={onToggle}
                        onEditText={onEditText}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {canMark && rel.items.length > 0 && (
        <AddStepForm aspects={rel.items} onAdd={onAddStep} closedCount={progress.closed} />
      )}
    </section>
  );
}

/** One Step: its words (and the suggestion behind them), where it came from, and its controls. */
function StepRow({
  step,
  canMark,
  onToggle,
  onEditText,
}: {
  step: Step;
  canMark: boolean;
  onToggle?: (stepId: string, status: StepStatus) => void;
  onEditText?: (stepId: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.text);

  const done = step.status === "done";
  const closed = step.status === "closed";
  const next: StepStatus = done ? "open" : "done";
  const kinds =
    step.derivedFrom.length === 0
      ? AUTHORED_STEP_LABEL
      : step.derivedFrom.map((kind) => GAP_KIND_LABELS[kind]).join(" · ");
  // The suggestion is only worth repeating when somebody has actually reworded the Step.
  const showSuggestion =
    step.suggestedText !== undefined && step.suggestedText !== step.text && !editing;

  function save() {
    if (draft.trim().length === 0) return;
    onEditText?.(step.id, draft);
    setEditing(false);
  }

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border bg-background px-3 py-2",
        closed ? "border-dashed border-border" : "border-border",
      )}
      data-step-id={step.id}
      data-step-status={step.status}
    >
      {canMark && !closed ? (
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

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              aria-label="Step text"
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={draft.trim().length === 0}
                className="inline-flex h-7 items-center rounded-md bg-action px-2 text-xs font-medium text-action-foreground disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(step.text);
                  setEditing(false);
                }}
                className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
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
        )}

        {showSuggestion && (
          <p className="mt-1 text-xs text-muted-foreground" data-step-suggestion>
            Suggested: {step.suggestedText}
          </p>
        )}

        <p className="mt-0.5 text-xs text-muted-foreground">
          {kinds} · {STEP_STATUS_LABELS[step.status]}
          {closed && " — no Gap left on this Aspect; kept as history"}
          {canMark && !closed && !editing && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => {
                  setDraft(step.text);
                  setEditing(true);
                }}
                className="underline underline-offset-2 hover:text-foreground"
                data-step-edit={step.id}
              >
                Edit
              </button>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

/**
 * "Add your own Step" — the one action that writes a Step no Gap produced.
 *
 * It asks for an Aspect because a Step is always about one: the report groups by Aspect, and a row
 * that named none would have nowhere to sit. The refusal is a sentence rather than a disabled
 * button, because the store is the thing that knows whether the Aspect is on this relationship.
 */
function AddStepForm({
  aspects,
  onAdd,
  closedCount,
}: {
  aspects: readonly { readonly id: string; readonly prompt: string }[];
  onAdd?: (aspectId: string, text: string) => string | null;
  closedCount: number;
}) {
  const [aspectId, setAspectId] = useState(aspects[0]?.id ?? "");
  const [text, setText] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  function submit() {
    const answered = onAdd?.(aspectId, text) ?? null;
    setRefusal(answered);
    if (answered === null) setText("");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-add-step="true">
      <p className="text-sm font-medium text-foreground">Add your own Step</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A Step of your own is kept beside the derived ones and can be ticked the same way. It came
        from no Gap, so nothing can close it.
        {closedCount > 0 &&
          ` ${closedCount === 1 ? "One Step has" : `${closedCount} Steps have`} closed since it was agreed.`}
      </p>
      <div className="mt-2 space-y-2">
        <select
          value={aspectId}
          onChange={(event) => setAspectId(event.target.value)}
          aria-label="Aspect for your Step"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          data-add-step-aspect
        >
          {aspects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.prompt}
            </option>
          ))}
        </select>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="What will you do about this?"
          aria-label="Your Step"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          data-add-step-text
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={text.trim().length === 0}
            className="inline-flex h-8 items-center rounded-md bg-action px-3 text-xs font-medium text-action-foreground disabled:opacity-50"
            data-add-step-submit
          >
            Add Step
          </button>
          {refusal !== null && <p className="text-xs text-destructive">{refusal}</p>}
        </div>
      </div>
    </div>
  );
}
