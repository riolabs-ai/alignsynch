"use client";

// template-ancestor: components/ui/sheet.tsx   (variation: a right-side form sheet for one Aspect — Title, Prompt, 1 Means, 5 Means over the locked 1–5 band — replacing the inline expanded row it was ported from, and shared by the three screens that author one)

/**
 * `AspectDrawer` — **one** drawer for Add and Edit (#1133), and the row editor's replacement.
 *
 * The approved bundle draws the Aspect editor as a sheet that slides in from the right
 * (`06-spec-design-page-templates-v2/js/proto.js` · `aspectDrawer()`), not as a row that expands
 * in place: a row that expands pushes every row under it down, and the person loses sight of the
 * list they are editing. So the anatomy is the artifact's, field for field:
 *
 *   eyebrow     `New Aspect` / `Edit Aspect`
 *   heading     `Add an Aspect`, or the Aspect's own name
 *   Title       the row's name — **read-only here, and it is the only field the model cannot carry**
 *   Prompt      what both seats answer
 *   1 Means     4 lines, two columns   …the low pole's words
 *   5 Means                             …the high pole's words
 *   scale       `Scale Locked · 1–5 for every Aspect`, five painted cells, `1 · <left>` / `5 · <right>`
 *   foot        `Cancel` and `Add Aspect` | `Save Aspect`
 *
 * **Why Title is drawn and not written.** `zAspect` is `zItem` plus `leftValue` / `rightValue`:
 * `{ id, prompt, scale, leftValue, rightValue }`, and the `item` table carries the same columns.
 * An Aspect is *named by its id*, which is also the handle every `opinion` row is keyed by — so a
 * rename would strand the answers to it, and there is no `title` column for a rename to land in.
 * The bundle's Title is that name, printed; the drawer prints it and says so, rather than showing
 * an input whose value the model would drop on save. A `title` column is a schema card, not this
 * one (`tests/aspect-drawer.test.tsx` pins that the field is not editable).
 *
 * **The 1–5 cells are never a field.** They are a `role="img"` band painted from the scale tokens,
 * with the two pole words repeated underneath as the live preview: the scale is the product's one
 * locked band (`docs/specs/v2-bundles/09-…`), and a five-cell row of `<input>`s here would be the
 * second way to answer.
 *
 * **A refusal keeps the drawer open.** `onSave` answers `{ ok }` or `{ ok: false, problem }`, and a
 * refusal surfaces its sentence while the typed words stay where they are — the inline editor
 * shipped the opposite (a Save that collapsed over a failed write) and that is the bug this
 * component must not re-create.
 *
 * **The words are the fixture's.** Every label is read from the page's own `aspect-drawer`
 * section, so this module writes no English (E23) and the three screens that mount it say the same
 * thing in their own fixtures — the row anatomy is shared, the vocabulary is per page, exactly as
 * `AspectList`'s `wordsSection` already works.
 */
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PageCopy } from "@/content/pages";
import { aspectProblem, type AspectField } from "@/lib/flow/aspects";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/** One Aspect as the drawer holds it. The same four fields `zAspectDraft` carries. */
export interface DrawerAspect {
  readonly id: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** What a save answers: taken, or the field it refused (`lib/flow/aspects.ts`). */
export type DrawerSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem?: string };

/** The five cells, as a map: Tailwind scans source text, not `bg-scale-${n}` built at runtime. */
export const ASPECT_SCALE_CELL: Readonly<Record<number, string>> = {
  1: "bg-scale-1",
  2: "bg-scale-2",
  3: "bg-scale-3",
  4: "bg-scale-4",
  5: "bg-scale-5",
};

export const ASPECT_SCALE_STEPS = [1, 2, 3, 4, 5] as const;

/**
 * The name an Aspect is known by: its id, without the `aspect-` prefix, read back as words.
 *
 * This is the whole of "Title" in the product — `aspect-contact-frequency` prints as
 * `Contact Frequency` — and it is derived rather than stored because the id is the handle the
 * answers hang from.
 */
export function aspectNameOf(id: string): string {
  const bare = id.replace(/^aspect[-_]/, "").replace(/^new[-_]/, "");
  return bare
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The field label a refusal names, by the id the fixtures declare it under. */
const FIELD_ITEM: Readonly<Record<AspectField, string>> = {
  prompt: "prompt-label",
  left: "left-label",
  right: "right-label",
};

export interface AspectDrawerProps {
  /** The route's copy. The drawer reads its own section out of it. */
  readonly copy: PageCopy;
  /** The section holding the drawer's words. `aspect-drawer` unless a page names another. */
  readonly wordsSection?: string;
  /** Open? The caller owns the address of "which row is open", so it survives a re-render. */
  readonly open: boolean;
  /** The row being edited, or `null` for a new one. */
  readonly aspect: DrawerAspect | null;
  /** The list's current length — the floor (`a relationship asks at least one Aspect`). */
  readonly count: number;
  readonly onCancel: () => void;
  readonly onSave: (next: DrawerAspect) => Promise<DrawerSaveResult>;
}

export function AspectDrawer({
  copy,
  wordsSection = "aspect-drawer",
  open,
  aspect,
  count,
  onCancel,
  onSave,
}: AspectDrawerProps) {
  const words = sectionOf(copy, wordsSection);
  const newRow = aspect === null;
  const formId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [poles, setPoles] = useState({
    left: aspect?.leftValue ?? "",
    right: aspect?.rightValue ?? "",
  });

  /** The first field takes focus on open — a sheet that opened onto nothing would trap a keyboard. */
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  }, [open]);

  /**
   * Re-seed the preview whenever a different row opens. The fields are uncontrolled (a controlled
   * mirror of four strings is a second copy of the row), so the preview is the one piece of
   * per-open state, and it is re-read from the row rather than from the last form.
   */
  useEffect(() => {
    setPoles({ left: aspect?.leftValue ?? "", right: aspect?.rightValue ?? "" });
  }, [aspect]);

  /** Has anything been typed into the open form? Read off the form, never a mirror of it. */
  function isDirty(): boolean {
    const form = formRef.current;
    if (form === null) return false;
    const data = new FormData(form);
    const typed = {
      prompt: String(data.get("prompt") ?? "").trim(),
      left: String(data.get("left") ?? "").trim(),
      right: String(data.get("right") ?? "").trim(),
    };
    return (
      typed.prompt !== (aspect?.prompt ?? "") ||
      typed.left !== (aspect?.leftValue ?? "") ||
      typed.right !== (aspect?.rightValue ?? "")
    );
  }

  /** Close without writing — asking first when there are words to lose. */
  function cancel(): void {
    if (isDirty() && !window.confirm(itemLabel(words, "unsaved"))) return;
    onCancel();
  }

  /** The fixture's sentence for a refused field — never a column name, never a new sentence. */
  function refusalSentence(problem: string): string {
    const field =
      problem === "prompt" || problem === "left" || problem === "right" ? problem : null;
    if (field === null) return itemLabel(words, "refused");
    return fillLabel(itemLabel(words, "required"), { field: itemLabel(words, FIELD_ITEM[field]) });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const next: DrawerAspect = {
      id: aspect?.id ?? "",
      prompt: String(data.get("prompt") ?? "").trim(),
      leftValue: String(data.get("left") ?? "").trim(),
      rightValue: String(data.get("right") ?? "").trim(),
    };
    const problem = aspectProblem(next);
    if (problem !== null) {
      toast(refusalSentence(problem));
      return;
    }
    setSaving(true);
    try {
      const answer = await onSave(next);
      if (!answer.ok) {
        toast(refusalSentence(answer.problem ?? ""));
        return;
      }
      onCancel();
    } catch {
      toast(itemLabel(words, "refused"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    /*
     * A right-side sheet, hand-rolled on purpose.
     *
     * `components/ui/sheet.tsx` is Radix, and Radix renders its content through a portal — which
     * means **nothing about this anatomy can be asserted from a server render**, and the three
     * claims this drawer makes (four labelled fields, a locked band, no field inside the band) are
     * exactly the ones a static test must be able to read. A `<div role="dialog">` renders in
     * place, carries the same semantics for a screen reader, and keeps `tests/aspect-drawer.test.tsx`
     * honest. The overlay is a real button so a pointer can dismiss it; Escape is bound on the
     * panel, and the first field takes focus on open.
     */
    <div className="fixed inset-0 z-50" data-aspect-drawer-root>
      <button
        type="button"
        aria-label={itemLabel(words, "close")}
        tabIndex={-1}
        onClick={cancel}
        className="absolute inset-0 h-full w-full cursor-default bg-foreground/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        data-aspect-drawer={newRow ? "new" : "edit"}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            cancel();
          }
        }}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-lg"
      >
        <form
          ref={formRef}
          id={formId}
          onSubmit={(event) => void submit(event)}
          className="flex min-h-full flex-col"
        >
          <div className="flex flex-row items-start justify-between gap-3 border-b border-border p-5 text-left">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-deep">
                {itemLabel(words, newRow ? "eyebrow-new" : "eyebrow-edit")}
              </p>
              <h2 id={`${formId}-title`} className="text-lg font-semibold text-primary">
                {newRow ? itemLabel(words, "heading-new") : aspectNameOf(aspect.id)}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancel}
              aria-label={itemLabel(words, "close")}
            >
              <span aria-hidden="true">×</span>
            </Button>
          </div>

          <div className="flex-1 space-y-4 p-5">
            {/* Title: drawn, not written — see the module header. */}
            <div className="space-y-1.5" data-aspect-drawer-title>
              <p className="text-sm font-medium">{itemLabel(words, "title-label")}</p>
              <input
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                value={newRow ? itemLabel(words, "name-new") : aspectNameOf(aspect.id)}
                data-aspect-drawer-name={aspect?.id ?? ""}
                className="w-full rounded-md border border-input bg-mist px-3 py-2 text-sm text-foreground"
              />
              <p className="text-xs text-muted-foreground">{itemLabel(words, "title-help")}</p>
            </div>

            <label className="block space-y-1.5" htmlFor={`${formId}-prompt`}>
              <span className="text-sm font-medium">{itemLabel(words, "prompt-label")}</span>
              <textarea
                id={`${formId}-prompt`}
                name="prompt"
                rows={3}
                defaultValue={aspect?.prompt ?? ""}
                maxLength={240}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <span className="block text-xs text-muted-foreground">
                {itemLabel(words, "prompt-help")}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5" htmlFor={`${formId}-left`}>
                <span className="text-sm font-medium">{itemLabel(words, "left-label")}</span>
                <input
                  id={`${formId}-left`}
                  name="left"
                  defaultValue={aspect?.leftValue ?? ""}
                  maxLength={40}
                  required
                  onChange={(event) =>
                    setPoles((current) => ({ ...current, left: event.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1.5" htmlFor={`${formId}-right`}>
                <span className="text-sm font-medium">{itemLabel(words, "right-label")}</span>
                <input
                  id={`${formId}-right`}
                  name="right"
                  defaultValue={aspect?.rightValue ?? ""}
                  maxLength={40}
                  required
                  onChange={(event) =>
                    setPoles((current) => ({ ...current, right: event.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>

            {/* The locked band. `role="img"`: five painted cells, never five fields. */}
            <div className="rounded-md border bg-paper p-3" data-aspect-drawer-scale>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span aria-hidden="true">🔒</span>
                {itemLabel(words, "scale-locked")}
              </p>
              <div
                role="img"
                aria-label={itemLabel(words, "scale-name")}
                className="mt-2 grid h-6 grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10"
              >
                {ASPECT_SCALE_STEPS.map((step) => (
                  <span
                    key={step}
                    className={cn(
                      "flex items-center justify-center text-xs font-medium text-foreground",
                      ASPECT_SCALE_CELL[step],
                    )}
                  >
                    {step}
                  </span>
                ))}
              </div>
              <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  1 · <span data-aspect-drawer-pole="left">{poles.left}</span>
                </span>
                <span className="text-right">
                  5 · <span data-aspect-drawer-pole="right">{poles.right}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={cancel}>
              {itemLabel(words, "cancel")}
            </Button>
            <Button
              type="submit"
              data-aspect-drawer-save
              disabled={saving || (count < 1 && newRow)}
            >
              {itemLabel(words, newRow ? "save-new" : "save-edit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
