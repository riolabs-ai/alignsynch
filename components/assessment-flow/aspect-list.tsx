"use client";

// template-ancestor: components/create/quiz-editor.tsx   (variation: each row carries a question and two opinion labels instead of one prompt, collapses to a single line once saved, and gains a drag handle instead of up/down buttons)

/**
 * `AspectList` — stage 3's list, the one interactive part of the create flow (#689).
 *
 * **Why this one is a client component.** Every other stage is a form that posts and comes back;
 * an Aspect is a row that opens *in place*, saves itself and collapses again, and the list is
 * reordered by dragging it. None of those are things a server render can do — a page navigation
 * per keystroke would be a form, not an editor — so the row state (which row is open, which row
 * is under the pointer) lives here and only the *committed* list travels.
 *
 * **Saving is a POST, not local state.** `SAVE_ASPECTS_PATH` writes the list into the flow's one
 * draft cookie (`lib/flow/create-draft.ts`), which is what makes "persists across a reload"
 * true rather than plausible: the page reads that cookie on the server, so a reload renders the
 * order and the words the person left. A save that fails does **not** collapse the row — a
 * control that reports success it did not have is worse than one that stays open.
 *
 * **The drag is pointer events, not HTML5 drag-and-drop.** `draggable` does not fire on a touch
 * screen, and the acceptance says laptop *and* phone. A `pointerdown` on the handle captures the
 * gesture, `pointermove` hit-tests the row under the finger, and `pointerup` commits the order.
 * `touch-none` on the handle is what stops the page scrolling under the drag — without it the
 * browser takes the gesture back the moment the finger moves vertically.
 *
 * **The keyboard gets the same move.** Arrow Up / Arrow Down on the handle moves the row and
 * saves, so the reorder is not a gesture only a pointer can perform — the drag is the fast path,
 * not the only path.
 *
 * Literal-free: every word is `data/pages/assessment-create.ts` (§ `aspects`), read through the
 * same `itemLabel`/`fillLabel` helpers the server components use. The rows' own words — a
 * question, two labels — are record data from the template, which is why they read as data here
 * and never as copy (E23 counts what a component *writes*).
 */
import { GripVertical } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { PageCopy } from "@/content/pages";
import {
  aspectProblem,
  type AspectDraft,
  type AspectField,
  moveAspect,
  normalizeAspect,
} from "@/lib/flow/aspects";
import { SAVE_ASPECTS_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** The field label a refusal names, by the id the fixture declares it under. */
const FIELD_ITEM: Readonly<Record<AspectField, string>> = {
  prompt: "prompt-label",
  left: "left-label",
  right: "right-label",
};

export interface AspectListProps {
  copy: PageCopy;
  /** The template being copied — the list is saved against it, one draft per template. */
  readonly templateRecordId: string;
  /** The list the page read: the draft's own when it has one, the template's on a first visit. */
  readonly aspects: readonly AspectDraft[];
}

interface SaveReply {
  readonly ok?: boolean;
  readonly problem?: string;
}

export function AspectList({ copy, templateRecordId, aspects: initial }: AspectListProps) {
  const [rows, setRows] = useState<AspectDraft[]>(() => [...initial]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const rowsRef = useRef<AspectDraft[]>(rows);
  const dragRef = useRef<string | null>(null);

  const words = sectionOf(copy, "aspects");
  const validation = sectionOf(copy, "validation");

  /** The one place the list moves, so the ref the drag reads can never lag the state. */
  function applyRows(next: AspectDraft[]) {
    rowsRef.current = next;
    setRows(next);
  }

  /** The fixture's sentence for a refused field — never a column name, never a new sentence. */
  function refusalSentence(problem: AspectField | string): string {
    const field =
      problem === "prompt" || problem === "left" || problem === "right" ? problem : null;
    if (field === null) return itemLabel(words, "refused");
    return fillLabel(itemLabel(validation, "required"), {
      field: itemLabel(words, FIELD_ITEM[field]),
    });
  }

  /**
   * Write the list into the draft. `true` when the server took it.
   *
   * The reply is read rather than assumed: a 400 carries the field that was refused, and a
   * network failure is not a save. Both leave the row where it was and say so.
   */
  async function persist(next: readonly AspectDraft[]): Promise<boolean> {
    try {
      const response = await fetch(SAVE_ASPECTS_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateRecordId, aspects: next }),
      });
      if (response.ok) return true;
      const reply = (await response.json().catch(() => ({}))) as SaveReply;
      toast(refusalSentence(reply.problem ?? ""));
      return false;
    } catch {
      toast(itemLabel(words, "refused"));
      return false;
    }
  }

  /** Save one Aspect: commit the list first, and collapse only if the draft took it. */
  async function saveAspect(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const edited = normalizeAspect({
      id,
      prompt: String(data.get("prompt") ?? ""),
      leftValue: String(data.get("left") ?? ""),
      rightValue: String(data.get("right") ?? ""),
    });

    const problem = aspectProblem(edited);
    if (problem !== null) {
      toast(refusalSentence(problem));
      return;
    }

    const next = rowsRef.current.map((row) => (row.id === id ? edited : row));
    if (!(await persist(next))) return;
    applyRows(next);
    setOpenId(null);
    toast(itemLabel(words, "saved"));
  }

  async function commitOrder(next: AspectDraft[]) {
    applyRows(next);
    if (await persist(next)) toast(itemLabel(words, "reordered"));
  }

  /**
   * The pointer drag: capture on the handle, hit-test on the move, commit on the release.
   *
   * Listeners live on `window` for the length of the gesture rather than on the handle, because
   * the handle is re-parented as rows reorder — a captured pointer follows the DOM node in some
   * browsers and not in others, and a drag that dies halfway through is worse than no drag.
   */
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = id;
    setDraggingId(id);

    const move = (pointer: PointerEvent) => {
      const dragged = dragRef.current;
      if (dragged === null) return;
      const under = document
        .elementFromPoint(pointer.clientX, pointer.clientY)
        ?.closest<HTMLElement>("[data-aspect-row]");
      const overId = under?.dataset.aspectRow;
      if (overId === undefined || overId === dragged) return;
      const index = rowsRef.current.findIndex((row) => row.id === overId);
      if (index === -1) return;
      const next = moveAspect(rowsRef.current, dragged, index);
      if (next.every((row, at) => row.id === rowsRef.current[at]?.id)) return;
      applyRows(next);
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const dragged = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      if (dragged !== null) void commitOrder(rowsRef.current);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  /** The same move from the keyboard — one row per press, saved the same way. */
  function step(event: KeyboardEvent<HTMLButtonElement>, id: string, delta: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = rowsRef.current.findIndex((row) => row.id === id);
    if (index === -1) return;
    const next = moveAspect(rowsRef.current, id, index + delta);
    if (next.every((row, at) => row.id === rowsRef.current[at]?.id)) return;
    void commitOrder(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {itemLabel(words, "tap-to-edit")}
        </p>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {fillLabel(itemLabel(words, "count"), { count: rows.length })}
        </span>
      </div>

      <ol className="space-y-2" data-aspect-list="true">
        {rows.map((row, index) => {
          const open = openId === row.id;
          return (
            <li
              key={row.id}
              data-aspect-row={row.id}
              data-aspect-open={open ? "true" : "false"}
              data-aspect-position={index}
              className={[
                "rounded-lg border bg-white dark:bg-gray-900",
                open ? "border-action" : "border-gray-200 dark:border-gray-700",
                draggingId === row.id ? "opacity-60" : "",
              ].join(" ")}
            >
              {open ? (
                <form
                  data-aspect-form={row.id}
                  onSubmit={(event) => void saveAspect(event, row.id)}
                  className="space-y-3 p-3"
                >
                  <label className="grid gap-1 text-sm" htmlFor={`aspect-prompt-${row.id}`}>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {itemLabel(words, "prompt-label")}
                    </span>
                    <input
                      id={`aspect-prompt-${row.id}`}
                      name="prompt"
                      defaultValue={row.prompt}
                      maxLength={240}
                      className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm" htmlFor={`aspect-left-${row.id}`}>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {itemLabel(words, "left-label")}
                      </span>
                      <input
                        id={`aspect-left-${row.id}`}
                        name="left"
                        defaultValue={row.leftValue}
                        maxLength={80}
                        className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {itemLabel(words, "left-help")}
                      </span>
                    </label>
                    <label className="grid gap-1 text-sm" htmlFor={`aspect-right-${row.id}`}>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {itemLabel(words, "right-label")}
                      </span>
                      <input
                        id={`aspect-right-${row.id}`}
                        name="right"
                        defaultValue={row.rightValue}
                        maxLength={80}
                        className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {itemLabel(words, "right-help")}
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      data-aspect-save={row.id}
                      className="inline-flex h-9 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover"
                    >
                      {itemLabel(words, "save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      className="inline-flex h-9 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      {itemLabel(words, "cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2 p-2">
                  <button
                    type="button"
                    data-aspect-grip={row.id}
                    aria-label={fillLabel(itemLabel(words, "grip"), { name: row.prompt })}
                    onPointerDown={(event) => startDrag(event, row.id)}
                    onKeyDown={(event) => step(event, row.id, event.key === "ArrowUp" ? -1 : 1)}
                    className="flex h-11 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <GripVertical aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    data-aspect-edit={row.id}
                    aria-expanded="false"
                    onClick={() => setOpenId(row.id)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md px-1 py-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="w-full truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {row.prompt}
                    </span>
                    <span className="flex w-full items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="truncate">{row.leftValue}</span>
                      <span aria-hidden="true">↔</span>
                      <span className="truncate">{row.rightValue}</span>
                    </span>
                  </button>
                  <span className="shrink-0 pr-1 text-xs font-medium text-action">
                    {itemLabel(words, "edit")}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
