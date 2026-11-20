/**
 * template-ancestor: components/admin/audit-log.tsx   (variation: a read-only registry of rules, not of actions — the rows come from one markdown source parsed at request time, the filters are links rather than a filter form, and a source that cannot be read draws a panel instead of an empty table)
 *
 * `/admin/permissions` — the CRUD & Permissions reference (#1126).
 *
 * **Read-only is structural, not a promise.** There is no form, no input, no button, no server
 * action and no `"use client"` in this file: the page draws a matrix and the reader narrows it
 * with links. A surface that cannot write cannot quietly be given a write path later without
 * deleting this paragraph.
 *
 * **The filters are the address.** Each chip is a `Link` to `/admin/permissions?role=…`, built by
 * `matrixHref(withFacet(…))` in `lib/admin/crud-matrix.ts`; the page parses the same address back
 * into a `CrudFilter` and filters on the server. A narrowed table is therefore a link somebody can
 * paste into a card, the facets combine, and clicking the selected chip again is the way out. No
 * client state means no hydration mismatch and no second answer to "which rows".
 *
 * **Counts are the whole matrix's, never the filtered page's.** The header band is what the source
 * file says — its cell count, how many are applicable, the three prototype statuses, the four
 * priorities and the upstream conflicts, every one of them `countsOf()`'s output; the line under
 * the filters says how much of it this address shows. A filtered figure in the header would make
 * the page's own totals depend on a link.
 *
 * **The table's columns are the source's columns.** `columns` is the header the parser read, so
 * the landed source draws its eight — and a `priority` column appears only once a source carries
 * one instead of folding the rank into `mvp`. A column the file does not have is never drawn, and
 * no column is filled with another's value.
 *
 * **One honest failure.** `unreadable` is why the source could not be read, drawn in place of the
 * counts and the table — never as an empty table, because "the matrix has no cells" and "the
 * matrix could not be read" are different statements and only one of them is true. The rules, the
 * eleven P0 gaps and the conflicts panel still render: those are the issue's text, not the
 * source's rows.
 *
 * **A status reads as an icon plus a word (#1232).** The prototype and upstream columns, and the
 * rank column, are drawn as chips rather than bare text: `Badge`'s geometry, the artifact's tone
 * as this tree's design tokens, and the mark the artifact draws beside the word. The chip's label
 * is still `cellText()`'s word, so the vocabulary keeps its one home in the fixture — a status
 * edit is a fixture edit, and the chip follows it.
 *
 * Every word comes from `data/pages/admin-permissions.ts` (E23 budget 0) — the status vocabulary,
 * the column names, the counts' captions and the failure sentence included.
 */
import { Check, ClipboardCheck, EqualApproximately, Flag, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LeavingLink } from "@/components/layout/leaving-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PageCopy } from "@/content/pages";
import {
  ADMIN_PERMISSIONS_PATH,
  CRUD_EPIC_ISSUE_URL,
  CRUD_FACETS,
  CRUD_MATRIX_PATH,
  CRUD_PRIORITIES,
  CRUD_PROTOTYPE_STATUSES,
  CRUD_TRIAGE_PAGE_URL,
  CRUD_UPSTREAM_STATUSES,
  type CrudCell,
  type CrudColumn,
  type CrudCounts,
  type CrudFacet,
  type CrudFilter,
  type CrudPriority,
  type CrudPrototypeStatus,
  type CrudUpstreamStatus,
  matrixHref,
  withFacet,
} from "@/lib/admin/crud-matrix";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

export interface PermissionsConsoleProps {
  copy: PageCopy;
  /** The cells the current address admits, in the source's order. */
  cells: readonly CrudCell[];
  /** The columns the source's header names, in that header's order — the table's shape. */
  columns: readonly CrudColumn[];
  /** The whole matrix's figures, or `null` when the source could not be read. */
  counts: CrudCounts | null;
  /** The cells whose upstream answer disagrees with the prototype. */
  conflicts: readonly CrudCell[];
  /** The distinct objects and roles the matrix holds — the chips' words. */
  facets: { readonly objects: readonly string[]; readonly roles: readonly string[] };
  /** The filter the address selected. */
  filter: CrudFilter;
  /** The triage pass the source says it was generated from, or `null` when it says none. */
  snapshotPass: number | null;
  /** Why the source could not be read, or `null`. */
  unreadable: string | null;
}

/** The prototype's vocabulary as the page prints it, keyed by the matrix's own value. */
function prototypeWords(copy: PageCopy): Record<CrudPrototypeStatus, string> {
  return {
    covered: pageItemOf(copy, "status-covered").label,
    hinted: pageItemOf(copy, "status-hinted").label,
    missing: pageItemOf(copy, "status-missing").label,
    "n/a": pageItemOf(copy, "status-not-applicable").label,
  };
}

/**
 * What upstream answers, as the page prints it. `n/a` is the source's `—` ("when not applicable")
 * and borrows the same "N/A" word the prototype's own not-applicable status prints — one phrase
 * for one idea, and no second literal in the fixture.
 */
function upstreamWords(copy: PageCopy): Record<CrudUpstreamStatus, string> {
  return {
    exists: pageItemOf(copy, "upstream-exists").label,
    "not-found": pageItemOf(copy, "upstream-not-found").label,
    conflict: pageItemOf(copy, "upstream-conflict").label,
    "n/a": pageItemOf(copy, "status-not-applicable").label,
  };
}

/** The ranking, as the page prints it (`—` for a cell the matrix does not schedule). */
function priorityWords(copy: PageCopy): Record<CrudPriority, string> {
  return {
    P0: pageItemOf(copy, "priority-p0").label,
    P1: pageItemOf(copy, "priority-p1").label,
    P2: pageItemOf(copy, "priority-p2").label,
    "Won't": pageItemOf(copy, "priority-wont").label,
    none: pageItemOf(copy, "priority-none").label,
  };
}

/** The three sets of words one cell's columns are read from — the fixture's, never a literal. */
interface CellWords {
  readonly prototypes: Record<CrudPrototypeStatus, string>;
  readonly upstreams: Record<CrudUpstreamStatus, string>;
  readonly priorities: Record<CrudPriority, string>;
}

/**
 * The chip's tone, as the design system's own tokens (#1232) — never a raw palette step, never
 * red. The artifact names the prototype's classes; this tree paints the same three Gap statuses
 * through `synch` / `small-gap` / `gap`, which is one colour language shared with the scale and
 * the party marks. The neutral trio is a status that is a fact rather than a gap: no tint, no
 * mark, the page's own ground, and the hairline a chip or a control draws here — the prototype's
 * `--line` is not a token in this tree, and `--input` is the role that carries it (globals.css
 * re-toned the pair warm).
 */
const TONE_NEUTRAL = "border-input bg-background font-medium text-foreground";
const TONE_SYNCH = "border-synch-mark bg-synch-tint text-synch";
const TONE_SMALL_GAP = "border-small-gap-mark bg-small-gap-tint text-small-gap";
const TONE_GAP = "border-gap-mark bg-gap-tint text-gap";

interface ChipTone {
  readonly tone: string;
  /** The mark the artifact draws beside the word; `null` where the status is a fact. */
  readonly icon: LucideIcon | null;
}

const NEUTRAL_CHIP: ChipTone = { tone: TONE_NEUTRAL, icon: null };

/** ✓ covered, ≈ hinted, ⚑ missing — the three the artifact marks, in the Gap scale's tones. */
const PROTOTYPE_CHIP: Record<CrudPrototypeStatus, ChipTone> = {
  covered: { tone: TONE_SYNCH, icon: Check },
  hinted: { tone: TONE_SMALL_GAP, icon: EqualApproximately },
  missing: { tone: TONE_GAP, icon: Flag },
  "n/a": NEUTRAL_CHIP,
};

/** What upstream answers; only a conflict is a gap, and it carries the gap tone and mark. */
const UPSTREAM_CHIP: Record<CrudUpstreamStatus, ChipTone> = {
  exists: NEUTRAL_CHIP,
  "not-found": NEUTRAL_CHIP,
  conflict: { tone: TONE_GAP, icon: Flag },
  "n/a": NEUTRAL_CHIP,
};

/** The rank, filled the way the artifact fills it: P0 solid, P1 a tint, P2 soft, the rest plain. */
const PRIORITY_CHIP: Record<CrudPriority, ChipTone> = {
  P0: { tone: "border-transparent bg-action text-action-foreground", icon: null },
  P1: { tone: "border-action/40 bg-action/5 font-medium text-primary", icon: null },
  P2: { tone: "border-transparent bg-secondary text-foreground", icon: null },
  "Won't": NEUTRAL_CHIP,
  none: NEUTRAL_CHIP,
};

/**
 * One status, drawn as an icon plus a word (#1232). The geometry is `Badge`'s — the primitive
 * the artifact maps this chip to — and the tone is merged over `outline`'s, so a tone never has
 * to fight the base string's `text-white` by source order.
 *
 * `marker` is a test hook, not copy: it names the column and the status value so a suite can
 * assert the drawn state without reading a class list.
 */
function StatusChip({
  marker,
  label,
  status,
}: {
  readonly marker: string;
  readonly label: string;
  readonly status: ChipTone;
}) {
  const Icon = status.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 whitespace-nowrap", status.tone)}
      data-status-chip={marker}
    >
      {Icon === null ? null : <Icon className="size-3.5 shrink-0" aria-hidden />}
      {label}
    </Badge>
  );
}

/** Each column's heading, as the page prints it — keyed by the canonical column name. */
function columnWords(copy: PageCopy): Record<CrudColumn, string> {
  return {
    object: pageItemOf(copy, "col-object").label,
    action: pageItemOf(copy, "col-action").label,
    role: pageItemOf(copy, "col-role").label,
    prototype: pageItemOf(copy, "col-prototype").label,
    selector: pageItemOf(copy, "col-selector").label,
    upstream: pageItemOf(copy, "col-upstream").label,
    mvp: pageItemOf(copy, "col-mvp").label,
    rationale: pageItemOf(copy, "col-rationale").label,
    priority: pageItemOf(copy, "col-priority").label,
  };
}

/** The columns whose cell is typeset differently; the rest are plain text. */
const CELL_CLASS: Partial<Record<CrudColumn, string>> = {
  object: "font-medium text-foreground",
  selector: "font-mono text-xs",
  rationale: "max-w-md text-muted-foreground",
};

/**
 * One cell's words, read from the column the source names — never another column's value. This is
 * the plain-text reading of every column, and it is also where a chip's label comes from: the
 * chip is a drawing of this word, not a second copy of it.
 */
function cellText(cell: CrudCell, column: CrudColumn, words: CellWords): string {
  switch (column) {
    case "object":
      return cell.object;
    case "action":
      return cell.action;
    case "role":
      return cell.role;
    case "prototype":
      return words.prototypes[cell.prototype];
    case "selector":
      return cell.selector;
    case "upstream":
      return words.upstreams[cell.upstream];
    case "mvp":
      return cell.mvp;
    case "rationale":
      return cell.rationale;
    case "priority":
      return words.priorities[cell.priority];
  }
}

/**
 * The chip a column draws, or `null` for a column that stays plain text (#1232).
 *
 * `rankColumn` is the parser's own choice — `priority` when the source names one, `mvp` when it
 * folds the rank into it — so the rank is never read off a column that carries something else: a
 * source with a separate `priority` column can put anything in `mvp`, and that text is printed as
 * the file wrote it rather than replaced with a rank the file did not store there.
 */
function cellChip(
  cell: CrudCell,
  column: CrudColumn,
  rankColumn: CrudColumn,
  words: CellWords,
): ReactNode {
  switch (column) {
    case "prototype":
      return (
        <StatusChip
          marker={`prototype-${cell.prototype}`}
          label={words.prototypes[cell.prototype]}
          status={PROTOTYPE_CHIP[cell.prototype]}
        />
      );
    case "upstream":
      return (
        <StatusChip
          marker={`upstream-${cell.upstream}`}
          label={words.upstreams[cell.upstream]}
          status={UPSTREAM_CHIP[cell.upstream]}
        />
      );
    default:
      return column === rankColumn ? (
        <StatusChip
          marker={`priority-${cell.priority}`}
          label={words.priorities[cell.priority]}
          status={PRIORITY_CHIP[cell.priority]}
        />
      ) : null;
  }
}

/** Each facet's heading, as the page prints it. */
function facetHeading(copy: PageCopy): Record<CrudFacet, string> {
  return {
    object: pageItemOf(copy, "filter-object").label,
    role: pageItemOf(copy, "filter-role").label,
    prototype: pageItemOf(copy, "filter-prototype").label,
    upstream: pageItemOf(copy, "filter-upstream").label,
    priority: pageItemOf(copy, "filter-priority").label,
  };
}

/** One facet's values: the matrix's own two free-text lists, then the three closed sets. */
function facetValues(
  facet: CrudFacet,
  copy: PageCopy,
  facets: PermissionsConsoleProps["facets"],
): readonly { readonly value: string; readonly label: string }[] {
  const code = (value: string) => ({ value, label: value });
  switch (facet) {
    case "object":
      return facets.objects.map(code);
    case "role":
      return facets.roles.map(code);
    case "prototype": {
      const words = prototypeWords(copy);
      return CRUD_PROTOTYPE_STATUSES.map((value) => ({ value, label: words[value] }));
    }
    case "upstream": {
      const words = upstreamWords(copy);
      return CRUD_UPSTREAM_STATUSES.map((value) => ({ value, label: words[value] }));
    }
    case "priority": {
      const words = priorityWords(copy);
      return CRUD_PRIORITIES.map((value) => ({ value, label: words[value] }));
    }
    default:
      return [];
  }
}

/** A chip: the facet's value, lit when the address already selects it. */
function FilterChip({ href, label, selected }: { href: string; label: string; selected: boolean }) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={
        selected
          ? "rounded-full border border-action bg-muted px-3 py-1 text-xs font-medium text-action"
          : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-action hover:text-action"
      }
    >
      {label}
    </Link>
  );
}

export function PermissionsConsole({
  copy,
  cells,
  columns,
  counts,
  conflicts,
  facets,
  filter,
  snapshotPass,
  unreadable,
}: PermissionsConsoleProps) {
  const rules = sectionOf(copy, "rules");
  const gaps = sectionOf(copy, "gaps");
  const countBand = sectionOf(copy, "counts");
  const matrixSection = sectionOf(copy, "matrix");
  const conflictsSection = sectionOf(copy, "conflicts");

  const words = {
    prototypes: prototypeWords(copy),
    upstreams: upstreamWords(copy),
    priorities: priorityWords(copy),
  };
  const headings = columnWords(copy);
  const facetHeadings = facetHeading(copy);

  /**
   * The column that carries the rank — the parser's own choice: `priority` when the source's
   * header names one, otherwise `mvp`, which is how the landed source writes it. Reading it here
   * rather than assuming `mvp` keeps the chip honest on a source that separates the two.
   */
  const rankColumn: CrudColumn = columns.includes("priority") ? "priority" : "mvp";

  /** The header band, filled from the matrix's own totals — the ids are the fixture's, checked. */
  const band = [
    { id: "count-cells", label: itemLabel(countBand, "count-cells"), count: counts?.cells ?? 0 },
    {
      id: "count-applicable",
      label: itemLabel(countBand, "count-applicable"),
      count: counts?.applicable ?? 0,
    },
    {
      id: "count-covered",
      label: itemLabel(countBand, "count-covered"),
      count: counts?.covered ?? 0,
    },
    { id: "count-hinted", label: itemLabel(countBand, "count-hinted"), count: counts?.hinted ?? 0 },
    {
      id: "count-missing",
      label: itemLabel(countBand, "count-missing"),
      count: counts?.missing ?? 0,
    },
    { id: "count-p0", label: itemLabel(countBand, "count-p0"), count: counts?.p0 ?? 0 },
    { id: "count-p1", label: itemLabel(countBand, "count-p1"), count: counts?.p1 ?? 0 },
    { id: "count-p2", label: itemLabel(countBand, "count-p2"), count: counts?.p2 ?? 0 },
    { id: "count-wont", label: itemLabel(countBand, "count-wont"), count: counts?.wont ?? 0 },
    {
      id: "count-conflicts",
      label: itemLabel(countBand, "count-conflicts"),
      count: counts?.conflicts ?? 0,
    },
  ];

  const narrowed = CRUD_FACETS.some((facet) => filter[facet] !== undefined);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-action" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">{copy.heading}</h1>
          <Badge variant="muted">{pageItemOf(copy, "read-only").label}</Badge>
        </div>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <LeavingLink href={CRUD_TRIAGE_PAGE_URL} label={pageItemOf(copy, "triage-link").label} />
          <LeavingLink href={CRUD_EPIC_ISSUE_URL} label={pageItemOf(copy, "epic-link").label} />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{rules.heading}</CardTitle>
          <CardDescription>{sectionBody(rules)}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {(rules.items ?? []).map((item) => (
              <li key={item.id} className="flex gap-3 text-sm text-foreground">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-action" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{gaps.heading}</CardTitle>
          <CardDescription>{sectionBody(gaps)}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {(gaps.items ?? []).map((item, index) => (
              <li key={item.id} className="flex gap-3">
                <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  {item.body === undefined ? null : (
                    <span className="block text-sm text-muted-foreground">{item.body}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {unreadable === null ? (
        <Card>
          <CardHeader>
            <CardTitle>{countBand.heading}</CardTitle>
            <CardDescription>{sectionBody(countBand)}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {band.map((entry) => (
                <div key={entry.id} className="rounded-md border border-border px-3 py-2">
                  <dd className="text-sm font-medium text-foreground">
                    {fillLabel(entry.label, { count: entry.count })}
                  </dd>
                </div>
              ))}
            </dl>
            {/* The artifact's summary line (#rectification 12): the triage pass the source states
                about itself, then the rank split, then the P0s the prototype still does not draw.
                Every figure is `countsOf()`'s — including `p0Open`, which is P0 ∩ hinted/missing. */}
            <p className="mt-3 text-sm text-muted-foreground" data-matrix-snapshot>
              {fillLabel(
                itemLabel(countBand, snapshotPass === null ? "snapshot-undated" : "snapshot"),
                {
                  pass: snapshotPass ?? "",
                  p0: counts?.p0 ?? 0,
                  p1: counts?.p1 ?? 0,
                  p2: counts?.p2 ?? 0,
                  wont: counts?.wont ?? 0,
                  p0Open: counts?.p0Open ?? 0,
                },
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border border-border bg-muted/50 p-4" data-matrix-unreadable>
          <p className="text-sm text-foreground">
            {fillLabel(itemLabel(matrixSection, "unreadable"), {
              path: CRUD_MATRIX_PATH,
              reason: unreadable,
            })}
          </p>
        </div>
      )}

      {unreadable === null ? (
        <Card>
          <CardHeader>
            <CardTitle>{matrixSection.heading}</CardTitle>
            <CardDescription>{sectionBody(matrixSection)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {CRUD_FACETS.map((facet) => (
                <div key={facet} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {facetHeadings[facet]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      href={matrixHref(withFacet(filter, facet, null))}
                      label={pageItemOf(copy, "filter-all").label}
                      selected={filter[facet] === undefined}
                    />
                    {facetValues(facet, copy, facets).map((option) => (
                      <FilterChip
                        key={option.value}
                        href={matrixHref(withFacet(filter, facet, option.value))}
                        label={option.label}
                        selected={filter[facet] === option.value}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" data-matrix-shown>
                {cells.length === 0
                  ? fillLabel(pageItemOf(copy, "matches-nothing").label, {
                      cells: counts?.cells ?? 0,
                    })
                  : narrowed
                    ? fillLabel(pageItemOf(copy, "showing").label, {
                        count: cells.length,
                        cells: counts?.cells ?? 0,
                      })
                    : fillLabel(pageItemOf(copy, "rows").label, {
                        cells: counts?.cells ?? 0,
                      })}
              </p>
              {narrowed ? (
                <Link
                  href={ADMIN_PERMISSIONS_PATH}
                  className="text-sm font-medium text-action underline-offset-4 hover:underline"
                >
                  {pageItemOf(copy, "filter-clear").label}
                </Link>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column}>{headings[column]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cells.map((cell) => (
                    <TableRow
                      key={`${cell.object}/${cell.action}/${cell.role}`}
                      data-cell={`${cell.object}/${cell.action}/${cell.role}`}
                    >
                      {columns.map((column) => (
                        <TableCell key={column} className={CELL_CLASS[column]}>
                          {cellChip(cell, column, rankColumn, words) ??
                            cellText(cell, column, words)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{conflictsSection.heading}</CardTitle>
          <CardDescription>{sectionBody(conflictsSection)}</CardDescription>
        </CardHeader>
        <CardContent>
          {conflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-no-conflicts>
              {itemLabel(conflictsSection, "no-conflicts")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{pageItemOf(copy, "col-object").label}</TableHead>
                    <TableHead>{pageItemOf(copy, "col-action").label}</TableHead>
                    <TableHead>{pageItemOf(copy, "col-role").label}</TableHead>
                    <TableHead>{pageItemOf(copy, "col-rationale").label}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.map((cell) => (
                    <TableRow key={`${cell.object}/${cell.action}/${cell.role}`}>
                      <TableCell className="font-medium text-foreground">{cell.object}</TableCell>
                      <TableCell>{cell.action}</TableCell>
                      <TableCell>{cell.role}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {cell.rationale}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
