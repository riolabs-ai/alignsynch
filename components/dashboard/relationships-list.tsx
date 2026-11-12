"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the record list — the same `text-3xl` heading with the create action in the header, the same toolbar (search + two selects + the `rounded-md border bg-muted/40` grid/list toggle), the same `TabsList`, the same per-filter empty state (`rounded-full bg-muted` ring + one action) and the same `gap-6` 1/2/3-column grid — over a relationship's stored lifecycle instead of a quiz's publication state, and with the create band as the header action rather than a route)
//
// The cards themselves are `./relationship-cards`, which stays the card inside this shell; the
// header note above is the *shell's* ancestry, which is the one #841 part 2 changes.

/**
 * `/dashboard/relationships` — the member's relationships as a record list (#841 part 2).
 *
 * **The page is the My Quizzes pattern, and every control in it does something.** The header
 * carries the one write this surface owns (`Start a relationship`, which opens the create band
 * in place, because a relationship is started from one of *your* templates and there is no
 * separate route to send a picker to); the toolbar searches the **relationship's own title** and
 * **the other party's name**, filters by the same status the tabs filter, and orders the rows in
 * hand by `createdAt`; the six tabs are the stored lifecycle, default `all`, with a count each
 * that is the number of rows behind that tab.
 *
 * **Nothing here invents a fact the read cannot back.** A relationship's status is stored
 * (`relationship.status`), so every tab is a stored value: `Drafts` filters `draft`, `Running`
 * reads stored `active` — the word and the value are different on purpose and both come from
 * `data/pages/dashboard-relationships.ts`. `pending` and `void` exist in the lifecycle and have no
 * tab; they are listed under `All`, never under a tab that would claim to hold them.
 *
 * **The two empty states are different sentences.** No rows at all is the fixture's `empty` band —
 * nobody has started one with you and you have started none. Rows that do not match what was asked
 * for is `empty-filter`, worded by whether a search or a tab emptied the list, because "clear the
 * search" and "try another tab" are different instructions.
 *
 * The approved artifact is `docs/review/artifacts/mockup-relationships-list-v1.html`; the cards
 * themselves are `RelationshipCards`, which stays the card inside this shell.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageCopy } from "@/content/pages";
import type { RelationshipCreateOutcome } from "@/lib/member/outcomes";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import type { MemberTemplateRow } from "@/lib/member/templates";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { Grid3X3, List, Plus, Search } from "lucide-react";
import { useState } from "react";
import { RelationshipCards } from "./relationship-cards";
import { RelationshipCreate } from "./relationship-create";

/** The tabs, in the order the artifact draws them. The id is the fixture item, the value the filter. */
const STATUS_TABS = [
  { value: "all", id: "all" },
  { value: "draft", id: "draft" },
  { value: "published", id: "published" },
  { value: "active", id: "active" },
  { value: "complete", id: "complete" },
  { value: "expired", id: "expired" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["value"];
export type { StatusFilter };
type SortOrder = "newest" | "oldest";

/** How many rows sit behind a tab. `all` counts every row, which is what the tab prints. */
export function statusCount(rows: readonly MemberRelationshipRow[], status: StatusFilter): number {
  return status === "all" ? rows.length : rows.filter((row) => row.status === status).length;
}

/**
 * What the toolbar and the tabs select, as one pure function — exported so the behaviour is
 * testable without a DOM (there is no interaction-testing dependency in this tree).
 *
 * The search covers the **relationship's own title** (#841 part 1: the name stage 1 chose, not the
 * template it was copied from) and **the other party's name**; a row with neither a counterparty
 * nor an initiator name simply contributes no name to its haystack.
 */
export function visibleRelationships(
  rows: readonly MemberRelationshipRow[],
  options: { status: StatusFilter; query: string; order: SortOrder },
): MemberRelationshipRow[] {
  const query = options.query.trim().toLowerCase();
  const matched = rows.filter((row) => {
    if (options.status !== "all" && row.status !== options.status) return false;
    if (query === "") return true;
    const title = row.relationshipTitle ?? row.title;
    const party =
      row.viewerRole === "initiator" ? (row.counterpartyName ?? "") : (row.initiatorName ?? "");
    return `${title} ${party}`.toLowerCase().includes(query);
  });
  const instant = (row: MemberRelationshipRow) => new Date(row.createdAt).getTime();
  return [...matched].sort((left, right) =>
    options.order === "oldest" ? instant(left) - instant(right) : instant(right) - instant(left),
  );
}

export function RelationshipsList({
  copy,
  rows,
  templates,
  onCreate,
  unreadable,
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  templates: readonly MemberTemplateRow[];
  onCreate: (payload: {
    templateId?: string;
    reason?: string;
  }) => Promise<RelationshipCreateOutcome>;
  unreadable: string | null;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [createOpen, setCreateOpen] = useState(false);

  const controls = sectionOf(copy, "controls");
  const tabs = sectionOf(copy, "tabs");
  const empty = sectionOf(copy, "empty");
  const emptyFilter = sectionOf(copy, "empty-filter");
  const startLabel = itemLabel(sectionOf(copy, "new"), "start");

  const query = searchQuery.trim().toLowerCase();
  const visible = visibleRelationships(rows, { status: statusFilter, query, order: sort });

  const countOf = (value: StatusFilter) => statusCount(rows, value);

  const startAction = (
    <Button type="button" onClick={() => setCreateOpen((open) => !open)} aria-expanded={createOpen}>
      <Plus className="h-4 w-4" />
      <span>{startLabel}</span>
    </Button>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
          {copy.subtitle === undefined ? null : (
            <p className="mt-1 text-muted-foreground">{copy.subtitle}</p>
          )}
        </div>
        {unreadable === null ? startAction : null}
      </header>

      {/* The one write this page owns. A relationship is started from one of the member's own
          templates, so the picker opens here rather than behind a route of its own. */}
      {unreadable === null && createOpen ? (
        <RelationshipCreate copy={copy} templates={templates} onCreate={onCreate} />
      ) : null}

      {unreadable !== null ? (
        <RelationshipCards copy={copy} rows={rows} unreadable={unreadable} view={viewMode} />
      ) : (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={itemLabel(controls, "search")}
                placeholder={itemLabel(controls, "search")}
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  {/* A `SelectValue` with children renders the selected word on the server too;
                      without it the trigger is blank until the items register on the client. */}
                  <SelectValue placeholder={itemLabel(controls, "status-label")}>
                    {statusFilter === "all"
                      ? itemLabel(controls, "all-statuses")
                      : itemLabel(tabs, statusFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{itemLabel(controls, "status-label")}</SelectLabel>
                    <SelectItem value="all">{itemLabel(controls, "all-statuses")}</SelectItem>
                    {STATUS_TABS.filter((tab) => tab.value !== "all").map((tab) => (
                      <SelectItem key={tab.value} value={tab.value}>
                        {itemLabel(tabs, tab.id)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={(value) => setSort(value as SortOrder)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={itemLabel(controls, "sort-label")}>
                    {itemLabel(controls, sort)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{itemLabel(controls, "sort-label")}</SelectLabel>
                    <SelectItem value="newest">{itemLabel(controls, "newest")}</SelectItem>
                    <SelectItem value="oldest">{itemLabel(controls, "oldest")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <div className="flex items-center rounded-md border bg-muted/40">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                  <span className="sr-only">{itemLabel(controls, "grid")}</span>
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                  <span className="sr-only">{itemLabel(controls, "list")}</span>
                </Button>
              </div>
            </div>
          </div>

          <Tabs
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <span>{itemLabel(tabs, tab.id)}</span>
                  <span className="ml-1.5 tabular-nums text-muted-foreground">
                    {countOf(tab.value)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {visible.length === 0 ? (
            <div
              data-relationships-empty
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="mb-4 rounded-full bg-muted p-6">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">
                {rows.length === 0 ? empty.heading : emptyFilter.heading}
              </h2>
              <p className="mb-6 max-w-md text-muted-foreground">
                {rows.length === 0
                  ? sectionBody(empty)
                  : query === ""
                    ? fillLabel(itemLabel(emptyFilter, "status"), {
                        status: itemLabel(tabs, statusFilter).toLowerCase(),
                      })
                    : fillLabel(itemLabel(emptyFilter, "search"), {
                        query: searchQuery.trim(),
                        count: String(rows.length),
                      })}
              </p>
              {startAction}
            </div>
          ) : (
            <RelationshipCards copy={copy} rows={visible} unreadable={null} view={viewMode} />
          )}
        </>
      )}
    </div>
  );
}
