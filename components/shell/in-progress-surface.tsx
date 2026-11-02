/**
 * template-ancestor: components/ui/alert.tsx   (variation: the in-progress surface — the alert's neutral frame as one inline honesty line under the surface's own heading, drawn from a registry entry's `needs`, with `role="status"` because nothing failed)
 *
 * The in-progress body a not-yet-wired surface renders (issue #409, owner direction).
 *
 * **The decision this component exists for: show the surface, not a gate.** Greying a nav row and
 * re-enabling it later is churn — the owner's words were "better to include ui in progress than
 * zig/zag final ux" — so a surface that is not wired yet is still *present*: its real heading, the
 * page's real body (`children`), and **one inline notice** that says what is not wired yet, taken
 * from the same `data/surface-registry.ts` entry the page names. Nothing here blocks a reader and
 * nothing here looks like a failure: the frame is neutral, `role="status"` (never `alert`), and
 * the notice reads as a statement about the build, not an error about the request.
 *
 * **It is not a redaction and not a 404.** A 404 reads as a bug; a spinner or an empty state
 * reads as an accident; a notice that names the missing capability reads as the roadmap it is.
 * That is why the words come from the registry and never from the page: the entry is the one place
 * the product states what it has not built, so two pages cannot describe the same gap differently.
 *
 * **The honest-action rule belongs to the surfaces that use this.** A control that cannot work yet
 * must say so *at the point of action* — a disabled button with "Not wired yet" beside it, or the
 * notice inside the form — and must never be a silent no-op. Rendering the UI is wanted; faking
 * the behaviour is the defect this panel's honesty exists to prevent. This component draws no
 * controls: it is the surrounding statement a page's in-progress body sits in.
 *
 * A **server component with no client state**: one plain record and some children in, markup out.
 * That is what lets a route render it at request time with no bundle, and it keeps `data:check`
 * E34 quiet — the registry is a fixture, not a `lib/db` module.
 *
 * Colour comes from tokens (`bg-muted`, `text-muted-foreground`, `border-dashed`), never from a
 * palette step or a status hue: this panel means the same thing under both brands.
 */
import type React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Surface } from "@/data/surface-registry";
import { cn } from "@/lib/utils";

export interface InProgressSurfaceProps {
  /** One entry from `data/surface-registry.ts` — never a hand-written copy of one. */
  readonly surface: Surface;
  /** The surface's real body. It is drawn as-is; the notice states what it cannot do yet. */
  readonly children?: React.ReactNode;
  readonly className?: string;
}

/**
 * `<InProgressSurface surface={requireSurface("/shop")}>…the real body…</InProgressSurface>`
 *
 * The entry is passed rather than looked up from a route string so a page cannot render a notice
 * about a surface it is not: the route that mounts this names the entry it owns.
 */
export function InProgressSurface({ surface, children, className }: InProgressSurfaceProps) {
  const missing = surface.needs ?? [];

  return (
    <section
      data-surface-route={surface.route}
      data-surface-status={surface.status}
      className={cn("mx-auto w-full max-w-3xl py-6 sm:py-10", className)}
    >
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{surface.label}</h1>
      </header>

      {children}

      <Alert role="status" className="mt-5 border-dashed bg-muted/40">
        <AlertDescription>
          <p className="font-medium text-foreground">Not wired yet</p>
          {surface.reason !== undefined && (
            <p className="mt-1 text-muted-foreground">{surface.reason}</p>
          )}
          {missing.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {missing.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          )}
        </AlertDescription>
      </Alert>
    </section>
  );
}
