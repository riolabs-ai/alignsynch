"use client";

// template-ancestor: components/create/quiz-editor.tsx   (variation: each row carries a question and two pole labels instead of one prompt, is edited in the shared Aspect drawer rather than in place since #1133, and gains a drag handle instead of up/down buttons)

/**
 * `AspectList` — stage 3's list, the one interactive part of the create flow (#689), and the two
 * other screens that author an Aspect.
 *
 * **The row no longer expands; the pencil opens the drawer (#1133).** The approved v2 bundle draws
 * the Aspect editor as a right-side sheet (`06-…/my-template-detail.html` → `NEW: Aspect drawer`),
 * and a row that expands in place pushes every row under it down — the person loses the list they
 * are editing. `components/assessment-flow/aspect-drawer.tsx` is now the one editor, mounted here
 * for wizard Stage 3 and for a `draft`/`pending` relationship's Aspects tab; this component keeps
 * what is genuinely list-shaped, which is the order, the grip, the floor and the remove control.
 *
 * **Saving is a POST, not local state.** `SAVE_ASPECTS_PATH` writes the list into the flow's one
 * draft cookie (`lib/flow/create-draft.ts`), which is what makes "persists across a reload" true
 * rather than plausible: the page reads that cookie on the server, so a reload renders the order
 * and the words the person left. A save that fails does **not** close the drawer — a control that
 * reports success it did not have is worse than one that stays open.
 *
 * **The row is the artifact's line** (#760): `01 · ⠿ · name · poles · ✎`. The ordinal is the
 * Aspect's order at the far left, read off the row's index so a drag renumbers it and drawn as a
 * plain span — never an input, never copy. The two pole labels are the row's data; the ✎ is the
 * edit control, named from the fixture.
 *
 * **The drag is pointer events, not HTML5 drag-and-drop.** `draggable` does not fire on a touch
 * screen, and the acceptance says laptop *and* phone. A `pointerdown` on the handle captures the
 * gesture, `pointermove` hit-tests the row under the finger, and `pointerup` commits the order.
 * `touch-none` on the handle is what stops the page scrolling under the drag. Arrow Up / Arrow
 * Down on the handle moves the row and saves, so the reorder is not a gesture only a pointer can
 * perform — the drag is the fast path, not the only path.
 *
 * Literal-free: every word is the page's own `aspects` / `aspect-drawer` sections, read through the
 * same `itemLabel`/`fillLabel` helpers the server components use. The rows' own words — a
 * question, two labels — are record data from the template, which is why they read as data here
 * and never as copy (E23 counts what a component *writes*).
 */
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { PageCopy } from "@/content/pages";
import {
  AspectDrawer,
  type DrawerAspect,
  type DrawerSaveResult,
} from "@/components/assessment-flow/aspect-drawer";
import { type AspectDraft, canRemoveAspect, moveAspect } from "@/lib/flow/aspects";
import { SAVE_ASPECTS_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

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
   * Told every time the list moves. A page that also saves the list as part of a *status* change
   * (the dashboard's draft → ready) has to write the rows the person is looking at, not the ones
   * the page read on mount, so the component reports and the page keeps the mirror.
   */
  readonly onChange?: (next: readonly AspectDraft[]) => void;
  /** Where the list is written. Absent, it posts to the create flow's draft endpoint stage 3
   * needs. The dashboard passes its own writer because it saves the whole record through a
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
  templateRecordId,
  aspects: initial,
  addRemove = false,
  save,
  onChange,
}: AspectListProps) {
  const [rows, setRows] = useState<AspectDraft[]>(() => [...initial]);
  /** The row the drawer is editing. `null` with `adding` false means the drawer is shut. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Is the drawer open on a row the list does not hold yet? */
  const [adding, setAdding] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const rowsRef = useRef<AspectDraft[]>(rows);
  const dragRef = useRef<string | null>(null);

  const words = sectionOf(copy, wordsSection);

  /** The one place the list moves, so the ref the drag reads can never lag the state. */
  function applyRows(next: AspectDraft[]) {
    rowsRef.current = next;
    setRows(next);
    onChange?.(next);
  }

  /**
   * Write the list into the draft. `true` when the server took it.
   *
   * The reply is read rather than assumed: a 400 carries the field that was refused, and a
   * network failure is not a save. Both leave the drawer where it was and say so.
   */
  async function persist(next: readonly AspectDraft[]): Promise<boolean> {
    try {
      const result = save === undefined ? await postDraft(next) : await save(next);
      if (result.ok) return true;
      toast(itemLabel(words, "refused"));
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

  /**
   * The drawer's save. An edited row replaces its own; a new row is appended **after** the write
   * that carries it, so a refused save never leaves a row on screen the record does not hold.
   */
  async function saveFromDrawer(next: DrawerAspect): Promise<DrawerSaveResult> {
    if (adding) {
      const id = `new-${String(rowsRef.current.length + 1)}`;
      const list = [...rowsRef.current, { ...next, id }];
      if (!(await persist(list))) return { ok: false };
      applyRows(list);
      setAdding(false);
      toast(itemLabel(words, "saved"));
      return { ok: true };
    }
    const list = rowsRef.current.map((row) => (row.id === next.id ? { ...next } : row));
    if (!(await persist(list))) return { ok: false };
    applyRows(list);
    setOpenId(null);
    toast(itemLabel(words, "saved"));
    return { ok: true };
  }

  /** A row added here holds an id no server has seen, and is dropped without a write. */
  function isNew(id: string): boolean {
    return id.startsWith("new-");
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

  /** The row the drawer holds: the edited one, or `null` for a new Aspect. */
  const drawerRow = adding ? null : (rows.find((row) => row.id === openId) ?? null);

  /** Open the drawer on one row, shutting the new-Aspect mode if it was on. */
  function editRow(id: string): void {
    setAdding(false);
    setOpenId(id);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{itemLabel(words, "tap-to-edit")}</p>
        <span className="text-xs font-medium text-muted-foreground">
          {fillLabel(itemLabel(words, "count"), { count: rows.length })}
        </span>
      </div>

      <ol className="space-y-2" data-aspect-list="true">
        {rows.map((row, index) => {
          const open = openId === row.id && !adding;
          return (
            <li
              key={row.id}
              data-aspect-row={row.id}
              data-aspect-open={open ? "true" : "false"}
              data-aspect-position={index}
              className={[
                "rounded-lg border bg-background",
                open ? "border-action" : "border-line",
                draggingId === row.id ? "opacity-60" : "",
              ].join(" ")}
            >
              {/* The artifact's line: `01 · ⠿ · name · poles · ✎` — four tracks below 560, with
                  the poles on a second line, five above it (#760). */}
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
                  className="min-w-[18px] text-left text-[11px] font-semibold tabular-nums tracking-wide text-muted-foreground"
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
                  className="grid h-9 w-7 shrink-0 touch-none cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-mist hover:text-foreground min-[560px]:h-11"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    ⠿
                  </span>
                </button>
                <button
                  type="button"
                  data-aspect-edit={row.id}
                  aria-expanded={open}
                  onClick={() => editRow(row.id)}
                  className="min-w-0 rounded-md px-1 py-1 text-left hover:bg-mist"
                >
                  <span className="block w-full truncate text-sm font-semibold text-foreground">
                    {row.prompt}
                  </span>
                </button>
                {/* The row's own data: the two ends of its scale. Never copy. */}
                <div className="col-start-2 col-span-3 row-start-2 flex min-w-0 items-center gap-1 text-xs text-muted-foreground min-[560px]:col-auto min-[560px]:row-auto">
                  <span className="truncate">{row.leftValue}</span>
                  <span aria-hidden="true">↔</span>
                  <span className="truncate">{row.rightValue}</span>
                </div>
                <button
                  type="button"
                  data-aspect-edit-icon={row.id}
                  aria-label={itemLabel(words, "edit")}
                  title={itemLabel(words, "edit")}
                  onClick={() => editRow(row.id)}
                  className="grid h-9 w-8 shrink-0 place-items-center rounded-md text-sm text-muted-foreground hover:bg-mist hover:text-foreground"
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
                    className="grid h-9 place-items-center rounded-md px-1.5 text-sm text-muted-foreground hover:bg-mist hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {addRemove ? (
        <button
          type="button"
          data-aspect-add="true"
          onClick={() => {
            setOpenId(null);
            setAdding(true);
          }}
          className="inline-flex h-11 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-mist"
        >
          {itemLabel(words, "add")}
        </button>
      ) : null}

      {/* The floor (#699): at one row the remove control is disabled, and the reason is a sentence
          rather than a tooltip nobody can hover on a phone. */}
      {addRemove && !canRemoveAspect(rows.length) ? (
        <p data-aspect-floor="true" className="text-xs text-muted-foreground">
          {itemLabel(words, "last")}
        </p>
      ) : null}

      <AspectDrawer
        copy={copy}
        open={adding || drawerRow !== null}
        aspect={drawerRow}
        count={rows.length}
        onCancel={() => {
          setAdding(false);
          setOpenId(null);
        }}
        onSave={saveFromDrawer}
      />
    </div>
  );
}
