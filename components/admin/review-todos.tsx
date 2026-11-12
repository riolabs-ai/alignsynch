"use client";

/**
 * template-ancestor: components/admin/support-thread.tsx   (variation: one artifact's checklist — the inbox's audited-write form pattern (a server callback handed down from the page, a visible pending state and a refusal drawn as a sentence) with a checkbox per item instead of a reply form, and the row that just changed flashing for a moment)
 *
 * `/admin/review`, the to-do card (#665 follow-up).
 *
 * **The write is the store's; this file only posts it.** `onToggle` is
 * `toggleReviewTodoAction` passed down from the page (`app/(mainlayout)/admin/review/page.tsx`),
 * exactly as the inbox hands `performInboxOperation` to its thread — a client component never
 * imports a `"use server"` module's action itself, so nothing here can reach the pool (E34).
 *
 * **The tick is optimistic for one round trip and the server is always the truth.** A click flips
 * the box immediately and posts `{artifactId, todoId, body, done}`; `body` is the item's own words,
 * because a checkbox has no reason field and the store turns them into the audit sentence
 * (`reviewTodoReasonOf`). On success the path is revalidated server-side and `router.refresh()`
 * re-reads it, which is what makes the count above the panes move; on a refusal the filter is
 * reverted and the sentence is drawn beside the list — a refused write is never a silent no-op.
 * The local override is dropped whenever the record itself arrives, so a stale optimistic value can
 * never outlive the rows it was guessing at.
 *
 * **The flash is 1.5 s and it is decoration.** `border-action bg-action/5` on the row that just
 * changed is the inbox's highlight, moved to the checklist: it says *that one*, and nothing reads
 * it. It is cleared on a timer, never used to decide what is true.
 *
 * Literal-free (E23): every word is `data/pages/admin-review.ts`; the item bodies, authors and
 * instants are rows.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { ReviewArtifactProgress, ReviewTodo } from "@/content/review";
import type { ReviewActionOutcome, ReviewTodoInput } from "@/lib/admin/review-inputs";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

import { refusalSentence } from "./review-refusal";

/** How long a row stays highlighted after its write landed. Decoration, not state. */
const FLASH_MS = 1500;

/** What the last write answered, or nothing yet. */
type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "refused"; readonly code: string }
  | { readonly kind: "failed" };

export function ReviewTodos({
  copy,
  artifactId,
  todos,
  progress,
  onToggle,
}: {
  copy: PageCopy;
  /** The open artifact, so a posted tick names the pair the store checks. */
  artifactId: string;
  todos: readonly ReviewTodo[];
  progress: ReviewArtifactProgress;
  onToggle: (input: ReviewTodoInput) => Promise<ReviewActionOutcome>;
}) {
  const router = useRouter();
  const todosCopy = sectionOf(copy, "todos");
  const refusals = sectionOf(copy, "refusals");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // The record wins. Every server render hands a fresh array, so this clears the optimistic
  // values the moment the re-read lands — including when a write changed nothing. Adjusting state
  // during render (rather than in an effect) is React's own answer to "a prop replaced the state",
  // and it is one render, not two.
  const [seenTodos, setSeenTodos] = useState(todos);
  if (seenTodos !== todos) {
    setSeenTodos(todos);
    setOverrides({});
  }

  useEffect(() => {
    if (flashId === null) return;
    const timer = setTimeout(() => setFlashId(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashId]);

  /** Drop one optimistic value, so a refused or failed write shows the row as the store has it. */
  const revert = (todoId: string): void => {
    setOverrides((current) => {
      const next = { ...current };
      delete next[todoId];
      return next;
    });
  };

  const tick = (todo: ReviewTodo, done: boolean): void => {
    if (busyId !== null) return;
    setBusyId(todo.id);
    setPhase({ kind: "idle" });
    setOverrides((current) => ({ ...current, [todo.id]: done }));
    void onToggle({ artifactId, todoId: todo.id, body: todo.body, done })
      .then((outcome) => {
        if (!outcome.ok) {
          revert(todo.id);
          setPhase({ kind: "refused", code: outcome.code });
          return;
        }
        setFlashId(todo.id);
        router.refresh();
      })
      .catch(() => {
        revert(todo.id);
        setPhase({ kind: "failed" });
      })
      .finally(() => setBusyId(null));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{todosCopy.heading ?? ""}</CardTitle>
        <CardDescription>
          {fillLabel(itemLabel(todosCopy, "progress"), {
            done: progress.todosDone,
            total: progress.todosTotal,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sectionBody(todosCopy) === "" ? null : (
          <p className="text-sm text-muted-foreground">{sectionBody(todosCopy)}</p>
        )}
        {todos.length === 0 ? (
          <p data-empty="true" className="text-sm text-muted-foreground">
            {itemLabel(todosCopy, "empty")}
          </p>
        ) : (
          <ul className="space-y-1">
            {todos.map((todo) => {
              const done = overrides[todo.id] ?? todo.doneAt !== null;
              const busy = busyId === todo.id;
              return (
                <li
                  key={todo.id}
                  data-todo={todo.id}
                  data-done={done ? "true" : "false"}
                  data-busy={busy ? "true" : "false"}
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
                    flashId === todo.id ? "border-action bg-action/5" : "border-transparent",
                  )}
                >
                  <Checkbox
                    id={`review-todo-${todo.id}`}
                    className="mt-0.5"
                    checked={done}
                    disabled={busy}
                    aria-label={fillLabel(itemLabel(todosCopy, done ? "tick-off" : "tick-on"), {
                      todo: todo.body,
                    })}
                    onCheckedChange={(next) => tick(todo, next === true)}
                  />
                  <span className="min-w-0 flex-1">
                    <label
                      htmlFor={`review-todo-${todo.id}`}
                      className={cn(
                        "block cursor-pointer text-sm",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {todo.body}
                    </label>
                    <span className="block text-xs text-muted-foreground">
                      {todo.doneAt === null
                        ? fillLabel(itemLabel(todosCopy, "opened-by"), {
                            author: todo.authorUserId,
                            date: formatDate(todo.createdAt),
                          })
                        : fillLabel(itemLabel(todosCopy, "done-by"), {
                            actor: todo.authorUserId,
                            date: formatDate(todo.doneAt),
                          })}
                    </span>
                  </span>
                  <Badge variant={busy ? "outline" : done ? "muted" : "outline"}>
                    {busy
                      ? itemLabel(todosCopy, "saving")
                      : itemLabel(todosCopy, done ? "state-done" : "state-open")}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        <Refusal phase={phase} refusals={refusals} />
      </CardContent>
    </Card>
  );
}

/** The sentence under the list, when the last write was refused or did not commit. */
function Refusal({ phase, refusals }: { phase: Phase; refusals: PageCopySection }) {
  if (phase.kind === "idle") return null;
  const code = phase.kind === "refused" ? phase.code : "failed";
  return (
    <p data-refusal={code} role="status" className="text-sm font-medium text-amber-700">
      {refusalSentence(refusals, code)}
    </p>
  );
}
