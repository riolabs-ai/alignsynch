"use client";

// template-ancestor: components/ui/dialog.tsx   (variation: a trigger that opens an existing form in a modal, where the ancestor is the surface alone)

/**
 * The relationship detail's edit trigger — #923.
 *
 * **The panel is not shown until it is asked for.** Before this component the detail screen
 * mounted `RelationshipEditPanel` as a permanent card in the 320 px actions rail, so every fact
 * the record carries was on screen twice at once: once as the read-only detail, once as an
 * editable field beside it. The owner reported that as "form and crud UI down the left column,
 * and duplicate features". Editing is now an explicit act: one control, and the same panel, drawn
 * over the page only while it is open.
 *
 * **Two presentations, one tree.** At ≥1024 the existing panel is drawn on the shipped
 * `DialogContent` (`components/ui/dialog.tsx`, centred, the primitive's own overlay); below 1024
 * it is `SheetContent` from `components/ui/sheet.tsx` at `side="right"` and full width, which is
 * the pair the flow's modal artifact draws (`components/assessment-flow/stage-shell.tsx` states
 * the same rule for the create flow). `sheet.tsx` imports `@radix-ui/react-dialog`, so both are
 * the one Radix primitive and neither can drift from the other.
 *
 * **The breakpoint is a media query here, and that is a considered exception.** `stage-shell.tsx`
 * picks its presentation in CSS because it renders on the server, where `matchMedia` does not
 * exist. This component is the opposite: it is closed on the server and in the first client
 * render — the modal only mounts on a click — so the choice is made after mount, where a query
 * is legal and a CSS-only choice cannot work: two mounted dialogs would be two focus traps.
 * `useSyncExternalStore` keeps the server snapshot (`true`, the dialog) free of hydration drift.
 *
 * **Focus, Escape, and the return trip are Radix's, not re-implemented.** `Dialog.Root`/
 * `Sheet.Root` trap focus inside the content while open, close on Escape, and restore focus to
 * the element that had it — this trigger — on close. `<DialogTitle>`/`<SheetTitle>` name the
 * dialog from the panel's own heading, and `aria-describedby={undefined}` is how Radix is told
 * the panel's own body sentence is the description (`stage-shell.tsx` records the same
 * decision), so no sentence is invented to satisfy the primitive.
 *
 * **The trigger's words are the page's.** `label` and `title` arrive resolved from
 * `data/pages/dashboard-relationship-detail.ts` — E23 gives `/dashboard/relationships/[id]` a
 * leaf-literal budget of zero, so this file types no copy of its own.
 *
 * **No control is invented for the closed case.** `editState === undefined || editState.closed`
 * still means the page passes no trigger at all: a relationship that cannot be edited renders no
 * Edit control, exactly as before. A disabled button would be a lie about a permission the server
 * would refuse anyway.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SheetContent, SheetTitle } from "@/components/ui/sheet";

/** The width at which the panel stops being a sheet and becomes a dialog. */
const WIDE_MIN_WIDTH = "(min-width: 1024px)";

function subscribeWide(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(WIDE_MIN_WIDTH);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function wideSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(WIDE_MIN_WIDTH).matches;
}

/** `true` at ≥1024. The server snapshot is the dialog: this tree is closed until a click. */
function useWideViewport(): boolean {
  return React.useSyncExternalStore(subscribeWide, wideSnapshot, () => true);
}

export function RelationshipEditDialog({
  panel,
  label,
  title,
}: {
  /** The existing `RelationshipEditPanel`, rendered by the page. Never re-drawn here. */
  panel: React.ReactNode;
  /** The trigger's words, from the page's fixture. */
  label: string;
  /** The dialog's accessible name — the panel's own heading, from the page's fixture. */
  title: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wide = useWideViewport();

  return (
    /*
     * **One Radix root, two contents.** `components/ui/sheet.tsx` and `components/ui/dialog.tsx`
     * both build on `@radix-ui/react-dialog`, so `Root` is the same component in both and the
     * trigger can be a real `DialogTrigger` while the content is drawn by whichever presentation
     * the viewport asks for. That is what makes the close behave: Radix restores focus to its own
     * `triggerRef`, and a hand-rolled `<button onClick>` would leave focus on `<body>` after every
     * close (measured — `tests/relationship-edit-dialog.test.tsx` asserts the return trip).
     */
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          data-relationship-edit-open="true"
        >
          {label}
        </Button>
      </DialogTrigger>

      {open && wide ? (
        <DialogContent
          data-relationship-edit-dialog="true"
          aria-describedby={undefined}
          /*
           * The panel is the surface: its own `FormSurface` draws the border and the card
           * ground, so the content box is a bare frame that scrolls (`p-0`, no border of its
           * own) — a second frame around a form surface is the treatment the form rules
           * delete. `max-h` keeps a long form — nine fields, the Aspect rows, the cost table —
           * inside the viewport instead of running off the bottom of it.
           */
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border-0 bg-background p-0 sm:rounded-lg"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {panel}
        </DialogContent>
      ) : null}

      {open && !wide ? (
        <SheetContent
          /*
           * `side` is omitted on purpose: `sheetVariants` defaults to `right`, and the route's
           * leaf-literal budget is 0 (E23) — a prop string is a literal like any other.
           */
          data-relationship-edit-sheet="true"
          aria-describedby={undefined}
          /* At 390 a `w-3/4` sheet is 292 px: narrower than the two-up field rows want to be,
             so the panel takes the whole width it has. */
          className="w-full overflow-y-auto border-0 bg-background p-0 sm:max-w-md"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {panel}
        </SheetContent>
      ) : null}
    </Dialog>
  );
}
