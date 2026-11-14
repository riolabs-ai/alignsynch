/**
 * template-ancestor: components/v1/admin-console-overview.tsx   (variation: the figure grid is one card per *area* rather than per count, and each card expands into the releases it shipped in and the pages that explain it — grouped cards instead of a flat shelf)
 *
 * `/admin/docs/features` — what has been built, grouped by area (#893).
 *
 * **A server component, deliberately.** Nothing here is interactive: the areas, their releases and
 * their pages are all derived on the request (`lib/docs/features.ts`), the grid needs no state, and
 * shipping 379 commit summaries as a hydration payload to re-render what the server already drew
 * would be the one cost this screen does not have to pay. The docs hub next door *is* a client
 * component, and for a reason it states: its filter runs in the browser. This one has no filter.
 *
 * **Two shapes, one rule.** The overview's `StatCardGrid` leads — one card per area, the feature
 * commit count as the figure, and the card links to the card below it — then the grouped cards say
 * what the numbers are: the releases the area appeared in, each opening its release note, and the
 * pages that explain it. The stat grid is the shipped component unchanged; what varies is where a
 * card points, and `#area-<scope>` is derived from the same scope the heading prints, so a card
 * cannot link to a heading that is not there.
 *
 * **Nothing is authored.** There is no area list, no fixture array and no constant naming a scope:
 * `featureAreas()` is the only source, and an area appears here because a commit says
 * `feat(<area>)`. That is the card's success test — a release must not need an edit to this file.
 *
 * **Every word comes from `data/pages/admin-docs.ts`** (E23 budget 0). The scope names, the themes,
 * the commit summaries and the page titles are records, and arrive as props.
 */
import { Layers } from "lucide-react";
import Link from "next/link";

import { StatCardGrid, type StatCard } from "@/components/console/stat-card-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { FeatureArea } from "@/lib/docs/features";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

export interface FeaturesIndexProps {
  copy: PageCopy;
  /** Every area, heaviest first — derived, never listed. */
  areas: readonly FeatureArea[];
  /** Why the record could not be built, or `null`. Drawn instead of the areas. */
  unreadable: string | null;
}

/** `{count} releases` vs `{count} release` — the pair the fixture declares, never a plural `s`. */
function counted(index: PageCopySection, count: number, one: string, many: string): string {
  return fillLabel(itemLabel(index, count === 1 ? one : many), { count });
}

export function FeaturesIndex({ copy, areas, unreadable }: FeaturesIndexProps) {
  const index = sectionOf(copy, "index");
  const totalCommits = areas.reduce((total, area) => total + area.commits, 0);

  const cards: readonly StatCard[] = areas.map((area) => ({
    id: area.anchor,
    label: area.scope,
    value: area.commits,
    detail: fillLabel(itemLabel(index, "stat-detail"), {
      releases: area.releases.length,
      pages: area.docs.length,
    }),
    href: `#${area.anchor}`,
    icon: <Layers className="h-4 w-4" />,
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Layers className="h-5 w-5 text-action" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">{copy.heading}</h1>
          <Badge variant="muted" data-area-count={areas.length}>
            {counted(index, areas.length, "area-count-one", "area-count")}
          </Badge>
          <Badge variant="muted" data-commit-count={totalCommits}>
            {counted(index, totalCommits, "commit-count-one", "commit-count")}
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
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-foreground" data-unreadable="true">
            {fillLabel(itemLabel(index, "unreadable"), { reason: unreadable })}
          </p>
        </div>
      )}

      {unreadable !== null ? null : (
        <div className="space-y-6">
          <StatCardGrid cards={cards} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => (
              <Card key={area.scope} id={area.anchor} data-area={area.scope} className="h-full">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="font-mono text-base">{area.scope}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">
                        {counted(index, area.commits, "area-commit-count-one", "area-commit-count")}
                      </Badge>
                      <Badge variant="muted">
                        {counted(
                          index,
                          area.releases.length,
                          "area-release-count-one",
                          "area-release-count",
                        )}
                      </Badge>
                      <Badge variant={area.docs.length === 0 ? "warning" : "muted"}>
                        {counted(index, area.docs.length, "area-doc-count-one", "area-doc-count")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <section className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {itemLabel(index, "releases-heading")}
                    </h2>
                    <ul className="space-y-3">
                      {area.releases.map((release) => (
                        <li key={release.version} data-area-release={release.version}>
                          <Link
                            href={release.href}
                            className="group flex flex-wrap items-baseline gap-2 text-sm"
                          >
                            <span className="font-mono font-medium text-action group-hover:underline">
                              {release.version}
                            </span>
                            <span className="min-w-0 text-muted-foreground">{release.theme}</span>
                          </Link>
                          <ul className="mt-1 space-y-1 border-l border-border pl-3">
                            {release.commits.map((summary) => (
                              <li key={summary} className="text-sm text-foreground">
                                {summary}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {itemLabel(index, "docs-heading")}
                    </h2>
                    {area.docs.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-area-no-docs="true">
                        {itemLabel(index, "no-docs")}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {area.docs.map((doc) => (
                          <li key={doc.path}>
                            <Link
                              href={doc.href}
                              className="flex flex-wrap items-baseline gap-2 text-sm text-action hover:underline"
                            >
                              <span className="min-w-0">{doc.title}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {doc.path}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">{sectionBody(index)}</p>
        </div>
      )}
    </div>
  );
}
