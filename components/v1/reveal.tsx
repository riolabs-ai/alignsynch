// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: peek and expand on a summary row)
// collapsible and drawer (vaul) into one surface-choosing component; it is not a variation
// of a single screen.
"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one reveal primitive with three jobs — peek, expand and preview — and a real mobile
 * fallback instead of a hover-only trick that dies on a phone.
 *
 * The surface is chosen by **breakpoint, never by inference**: the desktop overlay
 * (`HoverCard` for peek, `Popover` for preview) and the mobile bottom sheet (`Drawer`, vaul)
 * are both rendered, and the trigger buttons are shown with `hidden sm:flex` / `flex
 * sm:hidden`. CSS alone decides which surface exists at a given width, so the server-rendered
 * markup and the hydrated client agree on the first paint — there is no `matchMedia` branch
 * that could disagree with SSR (React hydration rule #418).
 *
 *   peek    — a compact summary; hovering shows the detail on desktop, a tap opens the bottom
 *             sheet on touch. The mobile trigger is the same summary, so nothing essential is
 *             hover-only.
 *   expand  — inline detail that pushes content down (`Collapsible`), with the chevron and
 *             `aria-expanded` handled by Radix.
 *   preview — a wider panel for something structured (`Popover` on desktop, `Drawer` below
 *             `sm`).
 *
 * Both surfaces close on Escape and return focus to the trigger (Radix/vaul manage focus),
 * close on outside interaction, and the sheet is dismissible by drag (vaul's grab handle) and
 * a visible close control. Every trigger is a real `<button>` — ≥44px (`min-h-11`), reachable
 * with Enter/Space.
 *
 * The caller owns the data, never the surface: `summary` and `detail` are React nodes, and
 * `summary` must be **non-interactive** (no links or buttons inside a trigger), which is why
 * an action that belongs with the detail — "open the relationship" — lives in `detail`.
 */
type OverlayVariant = "peek" | "preview";

interface OverlayRevealProps {
  variant: OverlayVariant;
  /** The accessible title of the revealed panel and the sheet. */
  title: string;
  /** One optional line under the title. */
  description?: string;
  /** The always-visible summary — the trigger's own content. Non-interactive. */
  summary: ReactNode;
  /** The detail the surface reveals. */
  detail: ReactNode;
  /** Optional classes on both trigger buttons. */
  className?: string;
  /** Optional classes on the desktop overlay content. */
  contentClassName?: string;
}

interface ExpandRevealProps {
  variant: "expand";
  /** The always-visible summary — the toggle's own content. Non-interactive. */
  summary: ReactNode;
  /** The detail that expands inline, pushing content down. */
  detail: ReactNode;
  /** Optional classes on the toggle button. */
  className?: string;
  /** An accessible name for the toggle; defaults to "Expand". */
  expandLabel?: string;
}

export type RevealProps = OverlayRevealProps | ExpandRevealProps;

/** The trigger styling both surfaces share; `flex`/`hidden` are set per surface below. */
const triggerBase = cn(
  "min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-50",
);

/** The heading + optional description shared by the desktop overlay and the sheet. */
function RevealHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Peek and preview share the mobile bottom sheet; only the desktop surface differs. */
function RevealOverlay(props: OverlayRevealProps) {
  const { variant, title, description, summary, detail, className, contentClassName } = props;

  const desktopTrigger = (
    <button type="button" className={cn(triggerBase, "hidden sm:flex", className)}>
      {summary}
    </button>
  );
  const mobileTrigger = (
    <button type="button" className={cn(triggerBase, "flex sm:hidden", className)}>
      {summary}
    </button>
  );

  return (
    <>
      {variant === "peek" ? (
        <HoverCard>
          <HoverCardTrigger asChild>{desktopTrigger}</HoverCardTrigger>
          <HoverCardContent className={cn("w-80 max-w-[calc(100vw-2rem)]", contentClassName)}>
            <RevealHeading title={title} description={description} />
            <div className="mt-3">{detail}</div>
          </HoverCardContent>
        </HoverCard>
      ) : (
        <Popover>
          <PopoverTrigger asChild>{desktopTrigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn("w-96 max-w-[calc(100vw-2rem)]", contentClassName)}
          >
            <RevealHeading title={title} description={description} />
            <div className="mt-3">{detail}</div>
          </PopoverContent>
        </Popover>
      )}

      <Drawer>
        <DrawerTrigger asChild>{mobileTrigger}</DrawerTrigger>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description !== undefined && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="px-4">{detail}</div>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** Expand renders one toggle on every width — no overlay, no sheet, no breakpoint. */
function RevealExpand(props: ExpandRevealProps) {
  const { summary, detail, className, expandLabel } = props;
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-label={expandLabel}
          className={cn(triggerBase, "group flex", className)}
        >
          {summary}
          <ChevronDown
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 overflow-hidden">{detail}</CollapsibleContent>
    </Collapsible>
  );
}

/**
 * `<Reveal variant="peek" | "expand" | "preview" …>`.
 *
 * `peek` and `preview` require `title` (and may take `description`); `expand` takes only
 * `summary` and `detail` plus an optional `expandLabel`.
 */
export function Reveal(props: RevealProps) {
  if (props.variant === "expand") {
    return <RevealExpand {...props} />;
  }
  return <RevealOverlay {...props} />;
}
