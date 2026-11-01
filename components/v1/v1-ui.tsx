// template-ancestor: none — prototype screen, approved for /v1
import { STAGE_LABELS, type RelationshipStage } from "@/content/stages";
import type { Gap } from "@/content/record";
import { cn } from "@/lib/utils";
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
