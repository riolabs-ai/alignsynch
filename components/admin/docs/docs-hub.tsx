"use client";

/**
 * template-ancestor: components/admin/audit-log.tsx   (variation: a registry list over the docs manifest, with a local filter and a section per band)
 *
 * `/admin/docs` — the documentation hub (#892).
 *
 * **One list, two states.** With no query the hub draws the manifest's nine sections, each with its
 * blurb and its rows; with a query it draws the same rows, grouped the same way, filtered by title and
 * question. The grouping is derived from the rows' own `sectionId` (they arrive flattened from
 * `lib/docs/rows.ts::docsRows`), so a section heading can never disagree with what is under it.
 *
 * **The filter is local, and that is the issue's scope.** 117 rows are already in the payload, so a
 * round trip to filter them would be a search server for data the browser holds — the header palette's
 * shape, not `/search`'s. `searchDocs` is the same pure function the tests drive, imported from the
 * zod-free half of the feature so a schema never rides along in this bundle.
 *
 * **Every word comes from `data/pages/admin-docs.ts`** (E23 budget 0), and every *title* comes from
 * the manifest: a document's name is the tree's, never a string somebody typed here, which is why
 * adding a page needs no change to this file.
 *
 * **A failure is a panel, never an empty list.** `unreadable` is the reason the manifest could not be
 * built, drawn above the (absent) rows — "there are no documents" and "the graph could not be read"
 * are different statements and only one of them can be true.
 */
import { BookOpen, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PageCopy } from "@/content/pages";
import { type DocsRow, type DocsSectionMeta, searchDocs } from "@/lib/docs/rows";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

export interface DocsHubProps {
  copy: PageCopy;
  /** Every document, in manifest order — flattened on the server so this list has one shape. */
  rows: readonly DocsRow[];
  /** The sections as headings: titles and blurbs, with no second copy of the rows. */
  sections: readonly DocsSectionMeta[];
  /** Why the manifest could not be built, or `null`. Drawn instead of the rows. */
  unreadable: string | null;
}

/** One document in the list: its name, the question it answers, and the address it opens. */
function DocRowLink({
  row,
  openLabel,
}: {
  row: DocsRow;
  /** The word on the row's action, from the fixture. */
  openLabel: string;
}) {
  return (
    <Link
      href={row.href}
      className="group flex items-start justify-between gap-4 rounded-md border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/50"
    >
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-medium text-foreground group-hover:text-action">
          {row.title}
        </span>
        <span className="block text-sm text-muted-foreground">{row.question}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-action">
        {openLabel}
      </span>
    </Link>
  );
}

export function DocsHub({ copy, rows, sections, unreadable }: DocsHubProps) {
  const hub = sectionOf(copy, "hub");
  const [query, setQuery] = useState("");

  const matches = useMemo(() => searchDocs(rows, query), [rows, query]);

  /** `{count} documents` vs `{count} document` — the pair the fixture declares, never a plural `s`. */
  const counted = (count: number, one: string, many: string): string =>
    fillLabel(itemLabel(hub, count === 1 ? one : many), { count });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <BookOpen className="h-5 w-5 text-action" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">{copy.heading}</h1>
          <Badge variant="muted">{counted(rows.length, "doc-count-one", "doc-count")}</Badge>
        </div>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      {unreadable === null ? null : (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">
            {fillLabel(itemLabel(hub, "unreadable"), { reason: unreadable })}
          </p>
        </div>
      )}

      {unreadable === null ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={itemLabel(hub, "search-placeholder")}
                aria-label={itemLabel(hub, "search-placeholder")}
                className="pl-9"
              />
            </div>
            {query.trim() === "" ? null : (
              <Badge variant="muted">
                {counted(matches.length, "result-count-one", "result-count")}
              </Badge>
            )}
            {query.trim() === "" ? null : (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs font-medium text-action hover:underline"
              >
                {itemLabel(hub, "search-clear")}
              </button>
            )}
          </div>

          {matches.length === 0 ? (
            <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {fillLabel(itemLabel(hub, "empty-search"), {
                query: query.trim(),
                count: rows.length,
              })}
            </p>
          ) : (
            <div className="space-y-6">
              {sections.map((section) => {
                const inSection = matches.filter((row) => row.sectionId === section.id);
                if (inSection.length === 0) return null;
                return (
                  <Card key={section.id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>{section.title}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {counted(inSection.length, "section-count-one", "section-count")}
                        </span>
                      </div>
                      <CardDescription>{section.blurb}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {inSection.map((row) => (
                        <DocRowLink key={row.path} row={row} openLabel={itemLabel(hub, "open")} />
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{sectionBody(hub)}</p>
        </div>
      ) : null}
    </div>
  );
}
