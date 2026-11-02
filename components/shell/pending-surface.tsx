/**
 * template-ancestor: components/ui/alert.tsx   (variation: the declared-not-wired surface — the alert's frame carrying a registry entry's label, reason and missing capability instead of a failure message, and `role="status"` because a pending surface is a state a reader is being told, not an alert they must act on)
 *
 * The one body every pending route renders (issue #409).
 *
 * The alternative was a 404, and a 404 reads as a bug. A stated pending surface reads as a
 * roadmap: it says what this page will be, why it is not that yet, and what has to exist before
 * it can be. So this component is deliberately not a redaction, not an empty state and not a
 * spinner — it renders `data/surface-registry.ts`'s own words, so the page and the registry
 * cannot disagree, and the nav row that leads here (or refuses to) reads the same entry.
 *
 * A **server component with no client state**: it takes one plain record and returns markup.
 * That is what lets a route render it at request time with no bundle, and it is also what keeps
 * `data:check` E34 quiet — the registry is a fixture, not a `lib/db` module.
 *
 * Colour comes from tokens (`bg-muted`, `text-muted-foreground`, `border-dashed`), never from a
 * palette step: this panel means the same thing under both brands.
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Surface } from "@/data/surface-registry";
import { cn } from "@/lib/utils";

export interface PendingSurfaceProps {
  /** One entry from `data/surface-registry.ts` — never a hand-written copy of one. */
  readonly surface: Surface;
  readonly className?: string;
}

/**
 * The pending page body. `surface` is passed rather than looked up from a route string so a page
 * cannot render a panel about a surface it is not: the route that mounts this names the entry it
 * owns (`requireSurface("/shop")` on a page that serves `/shop`).
 */
export function PendingSurface({ surface, className }: PendingSurfaceProps) {
  const missing = surface.needs ?? [];

  return (
    <section
      data-surface-route={surface.route}
      data-surface-status={surface.status}
      className={cn("mx-auto w-full max-w-2xl py-6 sm:py-10", className)}
    >
      <Alert role="status" className="border-dashed bg-muted/40">
        <AlertTitle className="flex flex-wrap items-center gap-2 text-base">
          <span>{surface.label}</span>
          <Badge variant="muted">{surface.status === "preview" ? "Preview" : "Pending"}</Badge>
        </AlertTitle>
        <AlertDescription className="mt-2">
          {surface.reason !== undefined && (
            <p className="text-muted-foreground">{surface.reason}</p>
          )}
          {missing.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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
