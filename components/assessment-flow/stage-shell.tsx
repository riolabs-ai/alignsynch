"use client";

// template-ancestor: components/ui/dialog.tsx   (variation: the dialog **is** the route — it is open on mount, has no trigger, and closes onto an address instead of a piece of state)

/**
 * `StageShell` — the create flow's one shell, drawn over the stage route underneath it (#709).
 *
 * **The route stays the route.** `/assessment/templates/[templateId]/create` and its three
 * siblings are still pages: they read the draft, the template and the refusal from the server, and
 * they answer a plain GET with 200. This component only decides how that render is *framed* — one
 * modal instead of four documents — which is why no stage was re-implemented and no
 * parallel-route interception was needed (the issue measured 0 interception points under
 * `@modal` and 0 `(.)`-prefixed segments, and this card adds none).
 *
 * **Two presentations, one tree.** At ≥1024 the panel is inset by 24px on the shipped
 * `DialogOverlay` (`bg-black/80`), which is the approved v6 shape. Below 1024 it is `inset-0` with
 * no radius and no side borders: a full-height sheet, which is what `components/ui/sheet.tsx`
 * draws on the same Radix primitive (`sheet.tsx` imports `@radix-ui/react-dialog`, so there is no
 * second dialog implementation to drift). The breakpoint is **CSS**, not a `matchMedia` read: a
 * runtime choice cannot be made on the server, and the server is where the direct-URL render
 * happens.
 *
 * **Rendered in place, never through `DialogPortal`.** A portal mounts on the client only, so a
 * visitor opening a stage URL directly, refreshing it, or following a link from an email would
 * get an empty overlay until hydration finished — the flash the issue forbids. `position: fixed`
 * here does the same visual job without moving the subtree out of the server's HTML, and
 * `tests/stage-modal.test.tsx` renders this component to static markup to prove the stage is
 * already in the document before any JavaScript runs.
 *
 * **Closing is navigation, not state.** The X (and Escape, and a click on the overlay) call
 * `closeHref`: leaving the flow is a page change, so it can never leave an unclosable modal
 * standing over a route that no longer matches it. Completion is the other exit and needs nothing
 * from this file — the commit answers a 303 to `/dashboard`, so the modal is simply not on the
 * page that lands.
 *
 * Literal-free (E23): `title` and `closeLabel` arrive **already resolved** from the caller's
 * fixture, the same contract `WizardSteps` follows. The one non-fixture string here is the Close
 * glyph's accessible name, which is an `aria-` attribute and therefore not copy.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function StageShell({
  title,
  closeLabel,
  closeHref,
  children,
}: {
  /**
   * The dialog's accessible name — the stage's own heading, already resolved by the caller.
   * Optional only because `PageCopy.heading` is: every stage's fixture carries one and the
   * screen's `<h1>` renders the same field, so an absent name is a fixture defect, not a state
   * this component invents words to cover.
   */
  title: string | undefined;
  /** The close control's accessible name, from the caller's fixture. */
  closeLabel: string;
  /** Where leaving the flow goes. A path, so a dismissal is a page change. */
  closeHref: string;
  /** The stage itself — `CreateRelationship`, `AccountGate`, `SentState`. Not re-drawn here. */
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) router.push(closeHref);
      }}
    >
      <DialogOverlay />
      <DialogPrimitive.Content
        data-stage-shell="true"
        data-stage-close={closeHref}
        // No description to point at: the stage draws its own heading and body. Passing
        // `undefined` is how Radix is told that, and it silences the missing-description warning
        // without inventing a sentence to describe the dialog.
        aria-describedby={undefined}
        className={cn(
          "fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-background",
          // ≥1024 — the approved v6 fullscreen dialog: inset, bordered, rounded, no shadow.
          "lg:inset-6 lg:rounded-lg lg:border",
        )}
      >
        <DialogPrimitive.Title className="sr-only">{title ?? null}</DialogPrimitive.Title>
        {/*
          The close, in a chrome band of its own below 1024.

          It used to be `absolute right-2 top-2`, floating over the stage — and at 390 that is
          not chrome over a margin, it is chrome over the content: the sheet has no inset there,
          the column pads by 16px, so the 44px control landed on the rail's sixth cell and
          covered 35×35px of it (measured 2026-11-08, `docs/qa-modal-mobile/measurements.json`,
          `closeOverlap`). At ≥1024 the panel is inset by 24px and padded by 32px, so the corner
          has real margin and the control overlaps nothing — measured `hits: []` at 1440.

          One control, two placements: in flow inside a band that sizes to it below 1024, and
          absolutely where the band collapses to zero height at 1024. A second `<Close>` node
          hidden by breakpoint would be a second accessible name to keep in sync; a `pt` reserve
          on the scroller would let scrolled content slide under the control. This way the band
          is the only thing that changes and nothing can sit beneath the control at any width.
        */}
        <div className="flex shrink-0 justify-end px-2 py-2 lg:h-0 lg:p-0">
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="z-10 grid h-11 w-11 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:absolute lg:right-4 lg:top-4 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {/*
          The one scroll container. `min-h-0` matters: a flex child defaults to `min-height:auto`,
          which lets a long stage (Aspects) push the panel taller than the viewport instead of
          scrolling inside it — the horizontal-overflow class of bug the 390 acceptance names.
        */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
