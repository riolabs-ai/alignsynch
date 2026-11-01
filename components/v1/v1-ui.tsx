// template-ancestor: components/assessment-flow/instance-view.tsx   (variation: shared prototype atoms: status tones and empty-state copy)
import { STAGE_LABELS, type RelationshipStage } from "@/content/stages";
import type { Gap } from "@/content/record";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Presentational primitives shared by the /v1 screens. No hooks, no
 * store access — a screen composes these, the screen owns its data.
 * ------------------------------------------------------------------ */

/** The stage word, painted in a status hue (outside the brand-class rule, #187). */
export function StageBadge({ stage }: { stage: RelationshipStage }) {
  const tone: Record<RelationshipStage, string> = {
    invited: "bg-slate-100 text-slate-700 border-slate-200",
    connected: "bg-blue-50 text-blue-700 border-blue-200",
    sharing: "bg-amber-50 text-amber-700 border-amber-200",
    aligned: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone[stage],
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

/** The gap number, coloured the way the report colours it: In Synch / Small / Big. */
export function GapPill({ gap, label }: { gap: Gap; label?: string }) {
  const tone =
    gap === 0
      ? "bg-green-50 text-green-700 border-green-200"
      : gap === 1
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold",
        tone,
      )}
    >
      {label ?? gap}
    </span>
  );
}

/** The empty state every list renders when it has nothing. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body !== undefined && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The loading state every list renders while the store hydrates. */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-muted" />
      ))}
    </div>
  );
}

/** The error state a screen renders when a record it expected is missing. */
export function NotFoundState({ message, back }: { message: string; back: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">Not found</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Link
        href={back}
        className="mt-4 inline-flex items-center rounded-md bg-action px-3 py-2 text-sm font-medium text-action-foreground hover:bg-action/90"
      >
        Back
      </Link>
    </div>
  );
}

/** A section heading with a small heading and a one-line lead. */
export function SectionIntro({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
      {subtitle !== undefined && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** A small stat figure, for the overview and admin aggregates. */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * The back affordance every detail view carries — the shell header's own pattern (a ghost link
 * with an arrow), at a 44px touch target so it stays tappable at 390px. Text and icon, never one
 * without the other; a detail view without it is a dead end on a phone.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** One breadcrumb step: a link to an ancestor surface, or the terminal (current) step. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * The context line every detail view carries — names where the viewer is, e.g.
 * `Relationships / Avery & Rowan / Session 2 report`. The last crumb is the current page; every
 * earlier one links to the surface it names.
 */
export function ContextLine({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.label} className="flex items-center gap-x-1.5">
              {crumb.href !== undefined && !last ? (
                <Link href={crumb.href} className="text-muted-foreground hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {crumb.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-muted-foreground">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
