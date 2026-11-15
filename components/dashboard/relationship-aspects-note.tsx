"use client";

// template-ancestor: components/relationship/relationship-edit-panel.tsx   (variation: the one read-only pointer at a section the panel does not write — the Aspects — where every other block in the panel is a field, a cost band or a refusal)

/**
 * The Aspects, named inside the Edit form — #975 D12.
 *
 * **The gap this closes is the inverse of #935's.** The owner reported the Aspects appearing twice
 * (the drag list plus a stack of forms in the edit panel) and answered "keep the drag and drop,
 * remove the stacked forms". #935 took the forms out — and with them every mention of the Aspects —
 * so the dialog that says *"Everything here is written to the relationship itself"* was silent about
 * the one section the page behind it edits. Two editors for one record, disagreeing about what is
 * editable.
 *
 * **The fix is a pointer, not a second editor.** A mounted `AspectList` in this dialog would be the
 * duplicated drag list #935 removed, alive at the same time as the page's own list that the modal
 * covers — two `aspects` states and two `saveAspects` writers in one document, which is exactly the
 * stale-snapshot write #943 fixed. So this block states what the Aspects are, says plainly that the
 * form does not write them, and draws **one door**: `DialogClose` plus a scroll to
 * `[data-relationship-aspects]`, the section that owns the single `AspectList`.
 *
 * **It types no copy and holds no state.** The heading, the sentence and the door's label arrive
 * resolved from the page's fixture (E23 gives `/dashboard/relationships/[id]` a leaf-literal budget
 * of zero), and the block is drawn only by the caller that has something to say — the console's
 * staff mount passes no note at all.
 *
 * **It must be mounted inside a Radix `Dialog`/`Sheet` root**, because `DialogClose` is what makes
 * the door close the modal and return focus to the Edit trigger. That is the panel's invariant, not
 * a prop: the only caller is `RelationshipEditPanel`'s `note` slot, which the member page fills.
 *
 * **The scroll waits a turn.** Radix locks body scroll while the modal is open and restores focus to
 * the trigger on close, so a `scrollIntoView` issued inside the click is undone by both. One
 * macrotask later the content is unmounted and the page scrolls again. `scrollIntoView` is
 * feature-checked because jsdom does not implement it (the suite stubs it on the target).
 */
import { DialogClose } from "@/components/ui/dialog";

export function RelationshipAspectsNote({
  heading,
  note,
  door,
}: {
  /** The section's own word for them ("Aspects"), from the page's fixture. */
  heading: string;
  /** The sentence that says this form does not write them, with the count already filled. */
  note: string;
  /** The door's label — "Edit" while the list is live, "See" once it is fixed. */
  door: string;
}) {
  function reveal(): void {
    if (typeof document === "undefined") return;
    const target = document.querySelector<HTMLElement>("[data-relationship-aspects]");
    if (target === null) return;
    setTimeout(() => {
      if (typeof target.scrollIntoView !== "function") return;
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  }

  return (
    <div data-relationship-aspects-note="true" className="space-y-2 rounded-md border p-3 text-sm">
      <p className="font-medium text-foreground">{heading}</p>
      <p className="text-muted-foreground">{note}</p>
      <DialogClose asChild>
        <button
          type="button"
          data-relationship-aspects-open="true"
          onClick={reveal}
          className="inline-flex h-11 items-center font-medium text-action underline underline-offset-4"
        >
          {door}
        </button>
      </DialogClose>
    </div>
  );
}
