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
 * file says (169 cells · 124 applicable · 37 covered / 25 hinted / 62 missing · 33 P0 / 18 P1 / 28
 * P2 / 15 Won't · 4 conflicts); the line under the filters says how much of it this address shows.
 * A filtered figure in the header would make the page's own totals depend on a link.
 *
 * **One honest failure.** `unreadable` is why the source could not be read, drawn in place of the
 * counts and the table — never as an empty table, because "the matrix has no cells" and "the
 * matrix could not be read" are different statements and only one of them is true. The rules, the
 * eleven P0 gaps and the conflicts panel still render: those are the issue's text, not the
 * source's rows.
 *
 * Every word comes from `data/pages/admin-permissions.ts` (E23 budget 0) — the status vocabulary,
 * the column names, the counts' captions and the failure sentence included.
 */
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

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

export interface PermissionsConsoleProps {
  copy: PageCopy;
  /** The cells the current address admits, in the source's order. */
  cells: readonly CrudCell[];
  /** The whole matrix's figures, or `null` when the source could not be read. */
  counts: CrudCounts | null;
  /** The cells whose upstream answer disagrees with the prototype. */
  conflicts: readonly CrudCell[];
  /** The distinct objects and roles the matrix holds — the chips' words. */
  facets: { readonly objects: readonly string[]; readonly roles: readonly string[] };
  /** The filter the address selected. */
  filter: CrudFilter;
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

/** What upstream answers, as the page prints it. */
function upstreamWords(copy: PageCopy): Record<CrudUpstreamStatus, string> {
  return {
    exists: pageItemOf(copy, "upstream-exists").label,
    "not-found": pageItemOf(copy, "upstream-not-found").label,
    conflict: pageItemOf(copy, "upstream-conflict").label,
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

/** The nine columns, in the source header's order. */
function columnWords(copy: PageCopy): readonly string[] {
  return [
    pageItemOf(copy, "col-object").label,
    pageItemOf(copy, "col-action").label,
    pageItemOf(copy, "col-role").label,
    pageItemOf(copy, "col-prototype").label,
    pageItemOf(copy, "col-selector").label,
    pageItemOf(copy, "col-upstream").label,
    pageItemOf(copy, "col-mvp").label,
    pageItemOf(copy, "col-rationale").label,
    pageItemOf(copy, "col-priority").label,
  ];
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
  counts,
  conflicts,
  facets,
  filter,
  unreadable,
}: PermissionsConsoleProps) {
  const rules = sectionOf(copy, "rules");
  const gaps = sectionOf(copy, "gaps");
  const countBand = sectionOf(copy, "counts");
  const matrixSection = sectionOf(copy, "matrix");
  const conflictsSection = sectionOf(copy, "conflicts");

  const prototypes = prototypeWords(copy);
  const upstreams = upstreamWords(copy);
  const priorities = priorityWords(copy);
  const columns = columnWords(copy);
  const headings = facetHeading(copy);

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
                    {headings[facet]}
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
                  : fillLabel(pageItemOf(copy, "showing").label, {
                      count: cells.length,
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
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cells.map((cell) => (
                    <TableRow
                      key={`${cell.object}/${cell.action}/${cell.role}`}
                      data-cell={`${cell.object}/${cell.action}/${cell.role}`}
                    >
                      <TableCell className="font-medium text-foreground">{cell.object}</TableCell>
                      <TableCell>{cell.action}</TableCell>
                      <TableCell>{cell.role}</TableCell>
                      <TableCell>{prototypes[cell.prototype]}</TableCell>
                      <TableCell className="font-mono text-xs">{cell.selector}</TableCell>
                      <TableCell>{upstreams[cell.upstream]}</TableCell>
                      <TableCell>{cell.mvp}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {cell.rationale}
                      </TableCell>
                      <TableCell>{priorities[cell.priority]}</TableCell>
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
