/**
 * template-ancestor: components/admin/instance-registry.tsx   (variation: a read-only registry of destinations — a rail preview, a diff and a screen map projected from one descriptor)
 *
 * `/admin/review/ia` — the IA prototype's body (#721), as a server component.
 *
 * **Three bands, one source.** The rail is projected from `lib/app-ia.ts`, the diff is
 * `ALIGN_MENU` (what ships) joined to `APP_IA_PLACEMENTS` (where each row lands), and the map is
 * `APP_IA_SCREEN_MAP`. Nothing is typed twice: the counts above the preview are lengths of the
 * same arrays the tables below render, so a row cannot appear in one and not the other.
 *
 * **The words are the page's fixture.** Every heading, column label and sentence is
 * `data/pages/admin-review-ia.ts` (`sectionOf` / `itemLabel`), which is what keeps this file at
 * E23's zero and lets a reviewer edit a sentence without touching markup. Today's row labels are
 * the exception on purpose: they are read from `data/pages/shell.ts`, the fixture the shipped rail
 * draws from, so the "today" column cannot drift from the menu it claims to describe.
 *
 * **No new visual language.** `Card`, `Table`, `Badge` and `NavRow` (inside the preview) only.
 * Cards lose their default `shadow-sm` because the review screen is a document, not a raised
 * surface; the border and the radius are the primitives' own.
 */
import Link from "next/link";

import { AppIaRailPreview } from "@/components/admin/ia-rail-preview";
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
import { shellPageCopy } from "@/data/pages/shell";
import {
  APP_IA_GROUPS,
  APP_IA_PLACEMENTS,
  APP_IA_REMOVED,
  APP_IA_SCREEN_MAP,
  appIaRows,
  isLinkableHref,
  type AppIaPattern,
} from "@/lib/app-ia";
import { ALIGN_MENU } from "@/lib/nav-menu";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * The copy id of each navigation pattern's sentence. A record rather than a `pattern-${pattern}`
 * template, so the four ids are visible here and a fifth pattern is a type error rather than a
 * missing label at runtime.
 */
const PATTERN_ITEM: Record<AppIaPattern, string> = {
  "list-detail": "pattern-list-detail",
  "tab-rail": "pattern-tab-rail",
  "row-actions": "pattern-row-actions",
  single: "pattern-single",
};

/** The badge tone a pattern gets: a detail page is secondary, a row action is muted. */
const PATTERN_VARIANT: Record<AppIaPattern, "secondary" | "outline" | "muted"> = {
  "list-detail": "secondary",
  "tab-rail": "secondary",
  "row-actions": "muted",
  single: "outline",
};

/** The review screen's own address — nothing in the rail points here, so no row lights up. */
const IA_REVIEW_PATH = "/admin/review/ia";

export function AdminReviewIaView({ copy }: { copy: PageCopy }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  const rail = sectionOf(copy, "rail");
  const diff = sectionOf(copy, "diff");
  const map = sectionOf(copy, "map");
  /** The shipped rail's words — read from the fixture that draws it, never copied into this one. */
  const today = sectionOf(shellPageCopy, "nav-alignsynch");

  /** Today's rows, flattened in rail order with the group they hang under. */
  const currentRows = ALIGN_MENU.flatMap((group) =>
    group.items.map((item) => ({ item, groupLabel: itemLabel(today, group.label) })),
  );
  const placementOf = new Map(APP_IA_PLACEMENTS.map((placement) => [placement.id, placement]));
  const proposedRows = appIaRows();

  return (
    <div className="space-y-6">
      {/*
        Band 1 — the proposed rail, live. The preview column is the reference shell's own width
        (241px) inside a bordered panel; the notes beside it say what the rail is and count what it
        contains, so the three numbers are the arrays' lengths rather than a caption somebody has
        to keep in step.
      */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{rail.heading}</CardTitle>
          <CardDescription>{rail.body}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[241px_1fr]">
          <div className="rounded-lg border border-gray-200 p-3">
            <AppIaRailPreview copy={copy} pathname={IA_REVIEW_PATH} />
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{itemLabel(rail, "rail-note")}</p>
            <dl className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {itemLabel(rail, "rail-groups")}
                </dt>
                <dd className="text-2xl font-semibold">{APP_IA_GROUPS.length}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {itemLabel(rail, "rail-count")}
                </dt>
                <dd className="text-2xl font-semibold">{proposedRows.length}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {itemLabel(rail, "rail-screens")}
                </dt>
                <dd className="text-2xl font-semibold">{APP_IA_SCREEN_MAP.length}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/*
        Band 2 — current versus proposed. One row per destination in today's rail, in the order
        that rail draws them, with where it lands and what changes. A row with no placement is
        drawn as removed, reading `APP_IA_REMOVED` for its reason — the table cannot quietly lose
        a destination, because the test holds the two lists against `ALIGN_MENU` by id.
      */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{diff.heading}</CardTitle>
          <CardDescription>{diff.body}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{itemLabel(diff, "col-today")}</TableHead>
                <TableHead>{itemLabel(diff, "col-lands")}</TableHead>
                <TableHead>{itemLabel(diff, "col-change")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.map(({ item, groupLabel }) => {
                const placement = placementOf.get(item.id);
                const removed = APP_IA_REMOVED.find((row) => row.id === item.id);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{itemLabel(today, item.id)}</span>
                        <span className="text-xs text-muted-foreground">{item.href}</span>
                        <Badge variant="outline" className="w-fit">
                          {groupLabel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {placement === undefined || placement.row === null ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="muted" className="w-fit">
                            {itemLabel(diff, "removed-heading")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{removed?.reason}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">
                            {placement.group === null ? null : itemLabel(nav, placement.group)}
                            {" › "}
                            {itemLabel(nav, placement.row)}
                          </span>
                          <span className="text-xs text-muted-foreground">{placement.row}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {placement?.change ?? removed?.reason}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium">
              {itemLabel(diff, "removed-heading")}
              {" · "}
              {APP_IA_REMOVED.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {APP_IA_REMOVED.length === 0
                ? itemLabel(diff, "removed-none")
                : APP_IA_REMOVED.map((row) => row.reason).join(" ")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{itemLabel(diff, "gap-note")}</p>
          </div>
        </CardContent>
      </Card>

      {/*
        Band 3 — the screen map. A row is a destination; a screen is what a reader looks at there,
        and the pattern column is the promise the design makes about how they leave it.
      */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{map.heading}</CardTitle>
          <CardDescription>{map.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{itemLabel(map, "col-screen")}</TableHead>
                <TableHead>{itemLabel(map, "col-group")}</TableHead>
                <TableHead>{itemLabel(map, "col-row")}</TableHead>
                <TableHead>{itemLabel(map, "col-pattern")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {APP_IA_SCREEN_MAP.map((screen) => (
                <TableRow key={screen.id}>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{itemLabel(map, screen.id)}</span>
                      {/*
                        A **route pattern is not a destination.** `screen.href` names the shape of a
                        URL (`/dashboard/relationships/[id]`), so handing it to `<Link>` is the
                        dynamic-href error Next raises — and on this page it crashed the client
                        render, taking the whole prototype down. Patterns print as code; concrete
                        routes link. `isLinkableHref` is the one predicate, tested in
                        `tests/app-ia.test.ts`.
                      */}
                      {isLinkableHref(screen.href) ? (
                        <Link
                          href={screen.href}
                          className="text-xs text-muted-foreground hover:text-action"
                        >
                          {screen.href}
                        </Link>
                      ) : (
                        <code className="text-xs text-muted-foreground">{screen.href}</code>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {itemLabel(nav, screen.group)}
                  </TableCell>
                  <TableCell className="align-top text-sm">{itemLabel(nav, screen.row)}</TableCell>
                  <TableCell className="align-top">
                    <Badge variant={PATTERN_VARIANT[screen.pattern]} className="w-fit">
                      {itemLabel(map, PATTERN_ITEM[screen.pattern])}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
