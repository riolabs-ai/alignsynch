// template-ancestor: components/admin/platform-health.tsx   (variation: the labelled stat cards become one sticky certification panel — a gauge, four scope meters, a status census, the section index and the register's own metadata, all derived from one file read instead of five recorded artifacts)
/**
 * The status box — the project spec's sticky left panel (s02, #1252).
 *
 * **Every figure is derived, and the derivation is the same one the tables use.** `met`/`total`
 * are `specTotalsOf(specStoryRows(doc))` — the register minus `Beyond the Agreement`, which is why
 * the gauge reads 44 of 76 while the Validation table draws 88 rows across its four sections. The
 * scope meters and the status census come from the same rows, so the panel cannot drift from the
 * matrix beside it.
 *
 * **Sticky at `xl`, stacked above the rows below it.** Per the artifact: the box holds its place
 * while the sections scroll at ≥1280, goes to a full-width strip with the meters side by side
 * between `md` and `xl`, and stacks at a phone width. `md:sticky` is not used — at those widths the
 * column would eat the rows' width for no benefit.
 *
 * **The gauge is a server SVG, not a chart primitive.** `components/ui/circular-progress.tsx` is a
 * client component with a framer-motion arc; this one is two circles and two labels, needs no
 * JavaScript, and carries the whole number as its accessible name (`role="img"` plus the fixture's
 * "44 of 76 met, 58 percent"), so a screen reader gets the fact rather than "graphic".
 *
 * **A status is a chip with a word.** The census list is `SpecStatusChip` plus the count — no
 * legend keyed by colour, and no red in any of the six tones (AS-07).
 *
 * A server component: no state, no handler, no clock — the date is the register's `generatedAt`.
 */
import Link from "next/link";

import { Chip } from "@/components/ui/badge";
import type { PageCopy } from "@/content/pages";
import {
  SPEC_STATUSES,
  specScopesOf,
  specSectionsOf,
  specStatusCounts,
  specStoryRows,
  specTotalsOf,
  specBeyondRows,
  type SpecValidation,
} from "@/content/spec";
import { SPEC_VALIDATION_SOURCE } from "@/lib/spec/file";
import { specDateLabel } from "@/lib/spec/evidence";
import { fillLabel, pageItemOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

import { SpecStatusChip } from "./spec-status";

/** The gauge's geometry, in one place: a 132px ring with a 12px stroke, drawn as an arc. */
const GAUGE = { size: 132, stroke: 12 } as const;

function Gauge({
  met,
  total,
  percent,
  label,
}: {
  met: number;
  total: number;
  percent: number;
  label: string;
}) {
  const radius = (GAUGE.size - GAUGE.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const drawn = total === 0 ? 0 : (met / total) * circumference;

  return (
    <svg
      viewBox={`0 0 ${GAUGE.size} ${GAUGE.size}`}
      role="img"
      aria-label={label}
      className="inline-block size-[132px]"
      data-spec-gauge={percent}
    >
      <defs>
        <linearGradient id="spec-gauge" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--initiator))" />
          <stop offset="1" stopColor="hsl(var(--synch))" />
        </linearGradient>
      </defs>
      <circle
        cx={GAUGE.size / 2}
        cy={GAUGE.size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--input))"
        strokeWidth={GAUGE.stroke}
      />
      <circle
        cx={GAUGE.size / 2}
        cy={GAUGE.size / 2}
        r={radius}
        fill="none"
        stroke="url(#spec-gauge)"
        strokeWidth={GAUGE.stroke}
        strokeLinecap="round"
        strokeDasharray={`${drawn} ${circumference}`}
        transform={`rotate(-90 ${GAUGE.size / 2} ${GAUGE.size / 2})`}
      />
      <text
        x={GAUGE.size / 2}
        y={GAUGE.size / 2 - 2}
        textAnchor="middle"
        className="fill-foreground text-[26px] font-bold"
      >
        {percent}%
      </text>
      <text
        x={GAUGE.size / 2}
        y={GAUGE.size / 2 + 17}
        textAnchor="middle"
        className="fill-muted-foreground text-[10.5px] font-medium"
      >
        {label}
      </text>
    </svg>
  );
}

export function SpecStatusBox({
  copy,
  doc,
  sections = false,
  meta = false,
  className,
}: {
  copy: PageCopy;
  doc: SpecValidation;
  /** Draw the section index (the Validation page). The Overview's box has none. */
  sections?: boolean;
  /** Draw the register's metadata (the Validation page). */
  meta?: boolean;
  className?: string;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const storyRows = specStoryRows(doc);
  const totals = specTotalsOf(storyRows);
  const counts = specStatusCounts(storyRows);
  const scopes = specScopesOf(storyRows);
  const sectionRows = specSectionsOf(doc.rows);
  const beyond = specBeyondRows(doc).length;

  return (
    <aside aria-label={words("status-heading")} className={cn("grid gap-3", className)}>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {words("status-heading")}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-1.5">
          <Chip className="gap-1 border-dashed border-small-gap-mark bg-small-gap-tint font-semibold text-small-gap">
            <span aria-hidden="true">◐</span>
            <span>{words("status-draft")}</span>
          </Chip>
          <Chip className="gap-1 border-dashed border-input bg-background font-semibold text-muted-foreground">
            <span aria-hidden="true">☐</span>
            <span>{words("status-not-signable")}</span>
          </Chip>
        </div>
        <p className="mt-2 text-xs">
          <span className="font-bold">{doc.release}</span>
          <span aria-hidden="true"> · </span>
          <span className="text-muted-foreground">
            {fillLabel(words("meta-main-sha"), { sha: doc.main })}
          </span>
        </p>
        <Gauge
          met={totals.met}
          total={totals.total}
          percent={totals.percent}
          label={fillLabel(words("status-gauge-label"), {
            met: totals.met,
            total: totals.total,
            percent: totals.percent,
          })}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{words("status-met-caption")}</p>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="mb-2 text-xs font-bold">{words("status-by-scope")}</p>
        <div className="grid gap-2">
          {scopes.map((scope) => (
            <div key={scope.prefix}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {fillLabel(words("status-scope"), { prefix: scope.prefix, label: scope.label })}
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {fillLabel(words("status-scope-ratio"), { met: scope.met, total: scope.total })}
                </span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-synch-mark"
                  style={{
                    width: `${scope.total === 0 ? 0 : Math.round((scope.met / scope.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="mb-2 text-xs font-bold">{words("status-by-status")}</p>
        <ul className="grid gap-1.5">
          {SPEC_STATUSES.map((status) => (
            <li key={status} className="flex items-center justify-between gap-2 text-xs">
              <SpecStatusChip status={status} />
              <span className="font-bold tabular-nums">{counts[status]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {fillLabel(words("status-beyond"), { count: beyond })}
        </p>
      </div>

      {sections ? (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-xs font-bold">{words("status-sections")}</p>
          <nav className="grid gap-0.5">
            {sectionRows.map((section) => (
              <Link
                key={section.number}
                href={`#spec-section-${section.number}`}
                className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-1.5 rounded px-1 py-1 text-xs hover:bg-muted"
              >
                <span className="font-bold tabular-nums text-muted-foreground">
                  {section.number}
                </span>
                <span className="min-w-0">{section.name}</span>
                <span className="font-bold tabular-nums text-muted-foreground">{section.rows}</span>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      {meta ? (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-1 text-xs font-bold">{words("status-meta")}</p>
          <dl className="grid gap-1 text-[11.5px]">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {words("meta-register")}
            </dt>
            <dd>
              {fillLabel(words("meta-register-value"), {
                rows: totals.total,
                date: specDateLabel(doc.generatedAt),
              })}
            </dd>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {words("meta-evidence")}
            </dt>
            <dd>{fillLabel(words("meta-evidence-value"), { sha: doc.main })}</dd>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {words("meta-release-map")}
            </dt>
            <dd>{words("meta-release-map-value")}</dd>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {words("meta-sign-off")}
            </dt>
            <dd>
              {words("meta-sign-off-value")}
              <br />
              {words("meta-sign-off-second")}
            </dd>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {words("meta-fees")}
            </dt>
            <dd>{words("meta-fees-value")}</dd>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {words("meta-source")}
            </dt>
            <dd>
              <code className="font-mono">{SPEC_VALIDATION_SOURCE}</code>
            </dd>
          </dl>
          <p className="mt-2 text-[11.5px] text-muted-foreground">{words("status-legend")}</p>
        </div>
      ) : null}
    </aside>
  );
}
