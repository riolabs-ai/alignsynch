/**
 * template-ancestor: components/admin/review-artifacts.tsx   (variation: the shelf's list-and-record arrangement over the release record instead of the artifact store — the list is every release newest first, the panes are one release's judgement, the facts behind it and the build answering, and the selection is `?release=` instead of `?artifact=`)
 *
 * `/admin/docs/releases` — the release record, one release at a time (#893).
 *
 * **Selection is an address, not state.** Every row is a `<Link href="?release=…">`, so a release
 * somebody quotes is a link they can send, the back button works, and a reload renders the same
 * pane — the property `/admin/review` gets from `?artifact=`, and the reason neither screen needs a
 * client component to hold a selection.
 *
 * **Three panes, one record.** The facts (`date`, the tag, the PR count, the page path) are
 * `CHANGELOG.md`'s; `theme` and `headline` are the two one-line judgements in
 * `docs/changelog/releases.json`; the build pair is `next.config.mjs`'s, read in process. Nothing is
 * counted twice and nothing is inferred: `pullRequests` is the entry's own count, and the feature
 * areas are the `feat(<area>)` scopes the entry carries.
 *
 * **The build pane is the one thing the release note cannot say.** An operator reading a release
 * wants to know whether the build in front of them *is* that release, and the answer is two inlined
 * strings — so it is printed beside the judgement rather than left to a deploy list.
 *
 * Every word comes from `data/pages/admin-docs.ts` (E23 budget 0); the versions, themes, dates and
 * paths are records.
 */
import { CalendarClock, GitCommitHorizontal, Tag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { BuildInfo } from "@/lib/build-info";
import type { ReleaseRow } from "@/lib/docs/releases";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

export interface ReleasesShelfProps {
  copy: PageCopy;
  /** Every release, newest first — the record's order, which is `CHANGELOG.md`'s. */
  rows: readonly ReleaseRow[];
  /** The release the address names, or `null` when the record could not be built. */
  selected: ReleaseRow | null;
  /** Why the record could not be built, or `null`. Drawn instead of the shelf. */
  unreadable: string | null;
  /** The build answering this request — `GET /api/version`'s pair, read in process. */
  build: BuildInfo;
}

/** `{count} releases` vs `{count} release` — the pair the fixture declares, never a plural `s`. */
function counted(list: PageCopySection, count: number, one: string, many: string): string {
  return fillLabel(itemLabel(list, count === 1 ? one : many), { count });
}

/** One labelled fact in the detail pane. The label is the fixture's; the value is the record's. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function ReleasesShelf({ copy, rows, selected, unreadable, build }: ReleasesShelfProps) {
  const list = sectionOf(copy, "list");
  const detail = sectionOf(copy, "detail");
  const buildCopy = sectionOf(copy, "build");
  const unreadableCopy = sectionOf(copy, "unreadable");

  const isNewest = selected !== null && rows[0]?.version === selected.version;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tag className="h-5 w-5 text-action" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">{copy.heading}</h1>
          <Badge variant="muted" data-release-count={rows.length}>
            {counted(list, rows.length, "release-count-one", "release-count")}
          </Badge>
        </div>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
        {copy.cta === undefined ? null : (
          <Link href={copy.cta.href} className="text-sm font-medium text-action hover:underline">
            {copy.cta.label}
          </Link>
        )}
      </header>

      {unreadable === null ? null : (
        <Card data-unreadable="true">
          <CardHeader>
            <CardTitle>{unreadableCopy.heading ?? ""}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-muted-foreground">
              {fillLabel(sectionBody(unreadableCopy), { reason: unreadable })}
            </p>
          </CardContent>
        </Card>
      )}

      {unreadable !== null ? null : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>{list.heading ?? ""}</CardTitle>
              <CardDescription>{sectionBody(list)}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {rows.length === 0 ? (
                <p
                  data-empty="true"
                  className="mx-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  {itemLabel(list, "empty")}
                </p>
              ) : (
                <nav aria-label={list.heading ?? ""} className="space-y-1 px-2">
                  {rows.map((row) => {
                    const open = selected?.version === row.version;
                    return (
                      <Link
                        key={row.version}
                        href={row.shelfHref}
                        data-release-row={row.version}
                        data-selected={open}
                        aria-current={open ? "page" : undefined}
                        className={
                          open
                            ? "flex flex-col gap-1 rounded-md border border-action/40 bg-action/5 px-3 py-2"
                            : "flex flex-col gap-1 rounded-md border border-transparent px-3 py-2 hover:border-border hover:bg-muted/50"
                        }
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-medium text-foreground">
                            {row.version}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.date}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">{row.theme}</span>
                      </Link>
                    );
                  })}
                </nav>
              )}
            </CardContent>
          </Card>

          {selected === null ? null : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>
                      <span className="font-mono">{selected.version}</span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted" data-areas={selected.featureAreas.length}>
                        {fillLabel(itemLabel(list, "row-meta"), {
                          pullRequests: selected.pullRequests,
                          areas: selected.areas.length,
                        })}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{sectionBody(detail)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Fact label={itemLabel(detail, "theme-label")}>{selected.theme}</Fact>
                    <Fact label={itemLabel(detail, "headline-label")}>{selected.headline}</Fact>
                    <Fact label={itemLabel(detail, "released-label")}>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span className="font-mono">{selected.date}</span>
                      </span>
                    </Fact>
                    <Fact label={itemLabel(detail, "tag-label")}>
                      <a
                        href={selected.tagUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-action underline underline-offset-2"
                      >
                        <span className="font-mono">{selected.version}</span>
                      </a>
                    </Fact>
                    <Fact label={itemLabel(detail, "pull-requests-label")}>
                      {selected.pullRequests}
                    </Fact>
                    <Fact label={itemLabel(detail, "page-label")}>
                      {selected.inManifest ? (
                        <Link
                          href={selected.href}
                          className="text-action underline underline-offset-2"
                        >
                          {selected.path}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {fillLabel(itemLabel(detail, "page-missing"), { path: selected.path })}
                        </span>
                      )}
                    </Fact>
                    <Fact label={itemLabel(detail, "limits-label")}>
                      {selected.hasLimits
                        ? itemLabel(detail, "limits-present")
                        : itemLabel(detail, "limits-absent")}
                    </Fact>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{itemLabel(detail, "areas-label")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {selected.featureAreas.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-no-features="true">
                      {itemLabel(detail, "no-features")}
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {selected.featureAreas.map((area) => (
                        <li key={area}>
                          <Link href={`/admin/docs/features#area-${area}`}>
                            <Badge variant="muted" className="font-mono">
                              {area}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card data-build="true">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{buildCopy.heading ?? ""}</CardTitle>
                    <Badge variant={isNewest ? "blue" : "warning"} data-build-current={isNewest}>
                      <GitCommitHorizontal className="mr-1 h-3.5 w-3.5" aria-hidden />
                      <span className="font-mono">{build.version}</span>
                    </Badge>
                  </div>
                  <CardDescription>{sectionBody(buildCopy)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-mono text-xs text-muted-foreground">
                    {fillLabel(itemLabel(buildCopy, "serving"), {
                      version: build.version,
                      commit: build.commit,
                    })}
                  </p>
                  <p className="text-sm text-foreground">
                    {isNewest
                      ? itemLabel(buildCopy, "newest-match")
                      : fillLabel(itemLabel(buildCopy, "newest-behind"), {
                          version: rows[0]?.version ?? "",
                        })}
                  </p>
                  {build.commit === "unknown" ? (
                    <p className="text-xs text-muted-foreground">
                      {itemLabel(buildCopy, "unknown")}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
