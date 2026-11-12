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
 * **The row is the artifact's line** (#760): `01 · ⠿ · name · opinions · ✎`. The ordinal is the
 * Aspect's order at the far left, read off the row's index so a drag renumbers it and drawn as a
 * plain span — never an input, never copy. No "Copied from the template" chip sits on a row: the
 * template is stated once in the stage body, and a chip repeating it on all five rows is the
 * eleven-times-repeated line the owner removed. The two Opinion labels are the row's data; the ✎
 * is the edit control, named from the fixture.
 *
 * **An open row stays open.** The editor closes through Save or Cancel and nothing else — a click
 * into a field is an edit, not a collapse. Cancel (or opening a different row) with words typed
 * asks before throwing them away, because the artifact's own editor shipped a toggle that
 * swallowed both the typing and the Save.
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
  canRemoveAspect,
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

/** What a writer reports back: `ok`, or the field it refused by the fixture's id. */
export interface AspectSaveResult {
  readonly ok: boolean;
  readonly problem?: string;
}

export interface AspectListProps {
  copy: PageCopy;
  /**
   * The fixture section the row vocabulary lives in. Stage 3 and the dashboard declare the same
   * row ids in their own sections, which is what makes the row the same row on both screens: the
   * words are per page, the anatomy is not.
   */
  readonly wordsSection?: string;
  /** Where `required` lives. `null` when the page has none, so a refusal falls back to the words'
   * own `refused` sentence rather than inventing a second one. */
  readonly validationSection?: string | null;
  /** The template being copied — the list is saved against it, one draft per template. */
  readonly templateRecordId?: string;
  /** The list the page read: the draft's own when it has one, the template's on a first visit. */
  readonly aspects: readonly AspectDraft[];
  /**
   * Whether a row may be added or removed here. Off by default; both screens that mount this
   * editor pass it — stage 3 since #699 (adding and removing an Aspect is what makes a copy
   * *authored*, and the create records that) and the dashboard's initiator editor, which has always
   * allowed it. Off is the safe default for a third screen that has not decided yet.
   */
  readonly addRemove?: boolean;
  /**
   /**
    * Told every time the list moves. A page that also saves the list as part of a *status* change
    * (the dashboard's draft → ready) has to write the rows the person is looking at, not the ones
    * the page read on mount, so the component reports and the page keeps the mirror.
    */
  readonly onChange?: (next: readonly AspectDraft[]) => void;
  /** Where the list is written. Absent, it posts to the create flow's draft endpoint
   * stage 3 needs. The dashboard passes its own writer because it saves the whole record through a
   * server action — the row anatomy is shared, the persistence is not.
   */
  readonly save?: (next: readonly AspectDraft[]) => Promise<AspectSaveResult>;
}

interface SaveReply {
  readonly ok?: boolean;
  readonly problem?: string;
}

export function AspectList({
  copy,
  wordsSection = "aspects",
  validationSection = "validation",
  templateRecordId,
  aspects: initial,
  addRemove = false,
  save,
  onChange,
}: AspectListProps) {
  const [rows, setRows] = useState<AspectDraft[]>(() => [...initial]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const rowsRef = useRef<AspectDraft[]>(rows);
  const dragRef = useRef<string | null>(null);
  /** The one open row's form, so "has this been typed into?" is read off the DOM, not a mirror. */
  const formRef = useRef<HTMLFormElement | null>(null);

  const words = sectionOf(copy, wordsSection);
  const validation = validationSection === null ? null : sectionOf(copy, validationSection);

  /** The one place the list moves, so the ref the drag reads can never lag the state. */
  function applyRows(next: AspectDraft[]) {
    rowsRef.current = next;
    setRows(next);
    onChange?.(next);
  }

  /**
   * Has the open row been typed into since it was opened? Read from the form itself, so a
   * controlled mirror of three fields cannot drift from what the person sees.
   */
  function isDirty(id: string): boolean {
    const form = formRef.current;
    const row = rowsRef.current.find((entry) => entry.id === id);
    if (form === null || row === undefined) return false;
    const data = new FormData(form);
    return (
      String(data.get("prompt") ?? "").trim() !== row.prompt ||
      String(data.get("left") ?? "").trim() !== row.leftValue ||
      String(data.get("right") ?? "").trim() !== row.rightValue
    );
  }

  /** Ask before throwing typed words away — the artifact's editor asks, and these are copy (E23). */
  function confirmDiscard(id: string): boolean {
    if (!isDirty(id)) return true;
    return window.confirm(itemLabel(words, "unsaved"));
  }

  /** Open a row, asking first when the row already open holds unsaved words. */
  function openRow(id: string): void {
    if (openId === id) return;
    if (openId !== null && !confirmDiscard(openId)) return;
    setOpenId(id);
  }

  /** Cancel: the one control that closes a row without writing, and it asks when it should. */
  function cancelRow(id: string): void {
    if (!confirmDiscard(id)) return;
    setOpenId(null);
  }

  /** The fixture's sentence for a refused field — never a column name, never a new sentence. */
  function refusalSentence(problem: AspectField | string): string {
    const field =
      problem === "prompt" || problem === "left" || problem === "right" ? problem : null;
    if (field === null || validation === null) return itemLabel(words, "refused");
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
      const result = save === undefined ? await postDraft(next) : await save(next);
      if (result.ok) return true;
      toast(refusalSentence(result.problem ?? ""));
      return false;
    } catch {
      toast(itemLabel(words, "refused"));
      return false;
    }
  }

  /** The create flow's writer: the list lands in the draft behind this template. */
  async function postDraft(next: readonly AspectDraft[]): Promise<AspectSaveResult> {
    if (templateRecordId === undefined) {
      throw new Error("aspect-list: a list with no writer and no template cannot be saved");
    }
    const response = await fetch(SAVE_ASPECTS_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateRecordId, aspects: next }),
    });
    if (response.ok) return { ok: true };
    const reply = (await response.json().catch(() => ({}))) as SaveReply;
    return { ok: false, problem: reply.problem ?? "" };
  }

  /** A row added here holds an id no server has seen, and is dropped without a write. */
  function isNew(id: string): boolean {
    return id.startsWith("new-");
  }

  function addRow(): void {
    const id = `new-${String(rowsRef.current.length + 1)}`;
    const next = [...rowsRef.current, { id, prompt: "", leftValue: "", rightValue: "" }];
    applyRows(next);
    setOpenId(id);
  }

  /**
   * Remove one row. A row the server holds is written out first and disappears only if the write
   * took, so the list on screen never disagrees with the list on record.
   *
   * **The last row stays (#699).** A relationship with no Aspects asks nothing of either seat, and
   * the create refuses an empty list (`aspects-none`) — so the gesture is refused here, with the
   * fixture's sentence, instead of being written and bounced a stage later. The control is drawn
   * disabled at one row; the guard is repeated here because this is the writer, and a `disabled`
   * attribute is not a rule.
   */
  async function removeRow(id: string): Promise<void> {
    if (!canRemoveAspect(rowsRef.current.length)) {
      toast(itemLabel(words, "last"));
      return;
    }
    const next = rowsRef.current.filter((row) => row.id !== id);
    if (next.length === rowsRef.current.length) return;
    if (!isNew(id) && !(await persist(next))) return;
    applyRows(next);
    if (openId === id) setOpenId(null);
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
                  ref={(node) => {
                    formRef.current = node;
                  }}
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
                      data-aspect-cancel={row.id}
                      onClick={() => cancelRow(row.id)}
                      className="inline-flex h-9 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      {itemLabel(words, "cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                // The artifact's line: `01 · ⠿ · name · opinions · ✎` — four tracks below 560
                // with the opinions on a second line, five above it (#760).
                <div
                  className={[
                    "grid items-center gap-2 p-2",
                    addRemove
                      ? "grid-cols-[auto_1.75rem_minmax(0,1fr)_auto_auto] min-[560px]:grid-cols-[auto_1.75rem_minmax(0,1fr)_auto_auto_auto]"
                      : "grid-cols-[auto_1.75rem_minmax(0,1fr)_auto] min-[560px]:grid-cols-[auto_1.75rem_minmax(0,1fr)_auto_auto]",
                  ].join(" ")}
                >
                  {/* The position, at the far left: the row's index, so a drag renumbers it. */}
                  <span
                    data-aspect-ordinal={index + 1}
                    aria-hidden="true"
                    className="min-w-[18px] text-left text-[11px] font-semibold tabular-nums tracking-wide text-gray-400 dark:text-gray-500"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    data-aspect-grip={row.id}
                    aria-label={fillLabel(itemLabel(words, "grip"), { name: row.prompt })}
                    title={itemLabel(words, "drag-hint")}
                    onPointerDown={(event) => startDrag(event, row.id)}
                    onKeyDown={(event) => step(event, row.id, event.key === "ArrowUp" ? -1 : 1)}
                    className="grid h-9 w-7 shrink-0 touch-none cursor-grab place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 min-[560px]:h-11"
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      ⠿
                    </span>
                  </button>
                  <button
                    type="button"
                    data-aspect-edit={row.id}
                    aria-expanded="false"
                    onClick={() => openRow(row.id)}
                    className="min-w-0 rounded-md px-1 py-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="block w-full truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {row.prompt}
                    </span>
                  </button>
                  {/* The row's own data: the two ends of its scale. Never copy. */}
                  <div className="col-start-2 col-span-3 row-start-2 flex min-w-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-[560px]:col-auto min-[560px]:row-auto">
                    <span className="truncate">{row.leftValue}</span>
                    <span aria-hidden="true">↔</span>
                    <span className="truncate">{row.rightValue}</span>
                  </div>
                  <button
                    type="button"
                    data-aspect-edit-icon={row.id}
                    aria-label={itemLabel(words, "edit")}
                    title={itemLabel(words, "edit")}
                    onClick={() => openRow(row.id)}
                    className="grid h-9 w-8 shrink-0 place-items-center rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  >
                    <span aria-hidden="true">✎</span>
                  </button>
                  {addRemove ? (
                    <button
                      type="button"
                      data-aspect-remove={row.id}
                      disabled={!canRemoveAspect(rows.length)}
                      aria-label={
                        canRemoveAspect(rows.length)
                          ? fillLabel(itemLabel(words, "remove"), { name: row.prompt })
                          : itemLabel(words, "last")
                      }
                      title={
                        canRemoveAspect(rows.length)
                          ? fillLabel(itemLabel(words, "remove"), { name: row.prompt })
                          : itemLabel(words, "last")
                      }
                      onClick={() => void removeRow(row.id)}
                      className="grid h-9 place-items-center rounded-md px-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {addRemove ? (
        <button
          type="button"
          data-aspect-add="true"
          onClick={addRow}
          className="inline-flex h-11 items-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          {itemLabel(words, "add")}
        </button>
      ) : null}

      {/* The floor (#699): at one row the remove control is disabled, and the reason is a sentence
          rather than a tooltip nobody can hover on a phone. */}
      {addRemove && !canRemoveAspect(rows.length) ? (
        <p data-aspect-floor="true" className="text-xs text-gray-500 dark:text-gray-400">
          {itemLabel(words, "last")}
        </p>
      ) : null}
    </div>
  );
}
