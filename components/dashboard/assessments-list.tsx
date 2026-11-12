"use client";

// template-ancestor: components/dashboard/relationships-list.tsx   (variation: the member record list over assessment sessions instead of relationships — the same `text-3xl` heading with the one action in the header, the same toolbar (search + two selects + the `rounded-md border bg-muted/40` grid/list toggle), the same `TabsList`, the same per-filter empty state and the same `gap-6` 1/2/3-column grid; the card inside it is unchanged)
//
// The card is still the one `#795` projected — `relationshipCard()` and the `CARD_*` chrome — so
// this surface moved (#877) and the card did not.

/**
 * `/assessments` — the member's assessment sessions, as a record list (#877).
 *
 * **The listing moved; the data did not.** The read is `listRelationshipCards(user.userId)` — the
 * same statement `/assessment/instances` rendered and the same one this page renders now — so
 * nothing here is a new query, a new column or a new feature. What changed is the address (plural,
 * `assessments/`, beside `/dashboard/relationships` and `/dashboard/templates`) and the shell,
 * which is the relationships list's.
 *
 * **A row is one session.** `RelationshipCard` carries the relationship's **latest** session —
 * its record id, its invitation, its state and its figures — so the row links to the session, and
 * the row's state is the stored derivation `myInstanceStateOf()` made (`yours-to-answer`,
 * `awaiting-other`, `complete`). Nothing on the card is authored here: the title, the party line,
 * the sentence, the marker, the paid block and the one facts line are `relationshipCard()`'s, and
 * `tests/member-card-projection.test.ts` fails the build if this file starts naming a figure
 * (`sessionsOpened`, `alignment`, `aspectCount`) or formats one.
 *
 * **Every destination is an address that already exists** — the owner's scope, exactly: "only UI,
 * data scoped to session, instance, assessment, gap analysis".
 *
 * | The row offers | The address |
 * |---|---|
 * | the session | `/assessment/instances/<record id>` (`instancePath()`) |
 * | the assessment | `/templates/relationship/<slug>` (`relationshipTemplatePath()`) |
 * | the relationship | `/dashboard/relationships/<id>` (`relationshipScreenPath()`) |
 * | its Gap | `/assessment/instances/<record id>/report` (`reportPath()`) |
 *
 * The Gap is drawn **only on a complete row**: before both parties have accepted, that route
 * answers the locked page, so a link there would be a door onto "not yet" on every other row. And
 * no destination is invented for comments, notes, analytics or progress — those are the scopes the
 * owner deferred, so the row does not stub them.
 *
 * **The three narrowings are the shell's, and each one only narrows.** `?filter=<id>` is the
 * console Overview's list (Console 2/5) and arrives as a prop, resolved by `overviewFilterOf()` on
 * the page; the search box and the state tabs are in-component state over the rows the read
 * produced. A tab with no rows behind it prints `0` and an empty band, never a filter nobody chose.
 */
import { Grid3X3, List, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Chip } from "@/components/ui/badge";
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
import type { RelationshipCard } from "@/lib/db/assessments";
import { matchesOverviewFilter, type OverviewFilter } from "@/lib/flow/overview";
import {
  MY_ASSESSMENTS_PATH,
  instancePath,
  relationshipScreenPath,
  relationshipTemplatePath,
  reportPath,
} from "@/lib/flow/paths";
import type { MyInstanceState } from "@/lib/flow/state";
import {
  CARD_ACTIONS,
  CARD_COVER,
  CARD_COVER_WORD,
  CARD_FRAME,
  CARD_META,
  CARD_TITLE,
  lastSessionInstant,
  relationshipCard,
} from "@/lib/member/card";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const OUTLINE =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

/**
 * The three stored states a tab can select, in the order they happen.
 *
 * These are `MyInstanceState`'s values — `lib/flow/state.ts` owns the derivation and this file
 * does not re-decide it. `all` is the default, so no row is hidden behind a tab nobody clicked.
 */
export const SESSION_STATES: readonly MyInstanceState[] = [
  "yours-to-answer",
  "awaiting-other",
  "complete",
];

export type StateFilter = "all" | MyInstanceState;
type SortOrder = "newest" | "oldest";

/** The state tabs, `all` first — the shell's order, and the order the counts print in. */
const STATE_TABS: readonly StateFilter[] = ["all", ...SESSION_STATES];

/**
 * How many rows sit behind a tab.
 *
 * Counts the rows the read returned, never a literal — a tab that said `3` over a list of two is
 * the defect this function exists to make impossible.
 */
export function stateCount(rows: readonly RelationshipCard[], state: StateFilter): number {
  return state === "all" ? rows.length : rows.filter((row) => row.state === state).length;
}

/**
 * What the toolbar and the tabs select, as one pure function.
 *
 * Exported so the behaviour is testable without a DOM — this tree has no interaction-testing
 * dependency, and the search covers the same four fields the surface it replaced searched: the
 * session's own name, the template it was copied from, and either party's name. Nothing here can
 * match an answer or a Gap value: those are not on the row the read hands over.
 */
export function visibleAssessments(
  rows: readonly RelationshipCard[],
  options: { state: StateFilter; query: string; order: SortOrder },
): RelationshipCard[] {
  const query = options.query.trim().toLowerCase();
  const matched = rows.filter((row) => {
    if (options.state !== "all" && row.state !== options.state) return false;
    if (query === "") return true;
    return [row.name, row.templateTitle, row.initiatorName ?? "", row.counterpartyName ?? ""].some(
      (field) => field.toLowerCase().includes(query),
    );
  });
  const instant = (row: RelationshipCard) => lastSessionInstant(row);
  return [...matched].sort((left, right) =>
    options.order === "oldest" ? instant(left) - instant(right) : instant(right) - instant(left),
  );
}

export function AssessmentsList({
  copy,
  rows,
  filter = null,
  unreadable,
}: {
  copy: PageCopy;
  rows: readonly RelationshipCard[];
  /**
   * The one list the reader came here for, when they arrived from a console card (Console 2/5).
   * `null` is the unfiltered list; the predicate is the one the Overview counted with, so the
   * figure on the card and the length of this list are arithmetic over one array.
   */
  filter?: OverviewFilter | null;
  /** The database layer's sentence when the read did not answer; `null` when it did. */
  unreadable: string | null;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const controls = sectionOf(copy, "controls");
  const tabs = sectionOf(copy, "tabs");
  const states = sectionOf(copy, "state");
  const links = sectionOf(copy, "links");
  const emptyCopy = sectionOf(copy, "empty");
  const emptyFilter = sectionOf(copy, "empty-filter");
  const filters = sectionOf(copy, "filter");

  const scoped =
    filter === null ? [...rows] : rows.filter((row) => matchesOverviewFilter(row, filter));
  const query = searchQuery.trim().toLowerCase();
  const visible = visibleAssessments(scoped, { state: stateFilter, query, order: sort });
  const countOf = (value: StateFilter) => stateCount(scoped, value);

  const startAction =
    copy.cta === undefined ? null : (
      <Button asChild>
        <Link href={copy.cta.href}>
          <Plus className="h-4 w-4" />
          <span>{copy.cta.label}</span>
        </Link>
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

      {unreadable === null ? null : (
        <div
          data-assessments-unreadable="true"
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
        >
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {sectionBody(sectionOf(copy, "unreadable"))}
          </p>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{unreadable}</p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <a className="underline" href={MY_ASSESSMENTS_PATH}>
              {itemLabel(sectionOf(copy, "unreadable"), "reload")}
            </a>
          </p>
        </div>
      )}

      {/* The console's card sends the reader here with one list in mind (Console 2/5). The band
          names it and offers the way back, without which a narrowed list would look like a list
          that lost somebody's sessions. */}
      {filter === null ? null : (
        <p data-assessments-filter={filter} className={MUTED}>
          {itemLabel(filters, "showing")}:{" "}
          <span className="font-semibold">{itemLabel(filters, filter)}</span>{" "}
          <Link className="underline" href={MY_ASSESSMENTS_PATH}>
            {itemLabel(filters, "show-all")}
          </Link>
        </p>
      )}

      {unreadable === null ? (
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
                value={stateFilter}
                onValueChange={(value) => setStateFilter(value as StateFilter)}
              >
                <SelectTrigger className="w-[190px]">
                  {/* A `SelectValue` with children renders the selected word on the server too;
                      without it the trigger is blank until the items register on the client. */}
                  <SelectValue placeholder={itemLabel(controls, "state-label")}>
                    {stateFilter === "all"
                      ? itemLabel(controls, "all-states")
                      : itemLabel(tabs, stateFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{itemLabel(controls, "state-label")}</SelectLabel>
                    <SelectItem value="all">{itemLabel(controls, "all-states")}</SelectItem>
                    {SESSION_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {itemLabel(tabs, state)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={(value) => setSort(value as SortOrder)}>
                <SelectTrigger className="w-[150px]">
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

          <Tabs value={stateFilter} onValueChange={(value) => setStateFilter(value as StateFilter)}>
            <TabsList>
              {STATE_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  <span>{itemLabel(tabs, tab)}</span>
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{countOf(tab)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {visible.length === 0 ? (
            <div
              data-assessments-empty={
                scoped.length > 0 ? "filter" : filter === null ? "all" : "filter-list"
              }
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="mb-4 rounded-full bg-muted p-6">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">
                {scoped.length > 0
                  ? emptyFilter.heading
                  : filter === null
                    ? emptyCopy.heading
                    : filters.heading}
              </h2>
              <p className="mb-6 max-w-md text-muted-foreground">
                {scoped.length > 0
                  ? query === ""
                    ? fillLabel(itemLabel(emptyFilter, "status"), {
                        status: itemLabel(tabs, stateFilter).toLowerCase(),
                      })
                    : fillLabel(itemLabel(emptyFilter, "search"), {
                        query: searchQuery.trim(),
                        count: String(scoped.length),
                      })
                  : filter === null
                    ? sectionBody(emptyCopy)
                    : itemLabel(filters, "empty")}
              </p>
              {startAction}
            </div>
          ) : (
            <ul
              data-assessments-list="true"
              className={
                viewMode === "grid"
                  ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-4"
              }
            >
              {visible.map((row) => {
                // One projection call; the list prints what it returns and composes no figure,
                // no name and no sentence of its own (#795 F2).
                const model = relationshipCard(copy, row);
                const rel = model.relationship;
                const sessionHref = instancePath(rel.instanceRecordId);

                return (
                  <li
                    key={rel.relationshipId}
                    data-assessment-session={rel.instanceRecordId}
                    data-assessment-state={rel.state}
                    data-assessment-relationship={rel.relationshipId}
                    className={CARD_FRAME}
                  >
                    {/* The cover slot the card chrome owns, carrying the stage word where a
                        template card carries its monogram. `aria-hidden` keeps it decoration: the
                        state chip below carries the same fact as text. */}
                    <div className={`${CARD_COVER} bg-gray-50 dark:bg-gray-800/40`}>
                      <span className={CARD_COVER_WORD} aria-hidden="true">
                        {rel.stageLabel}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* The assessment this session was copied from — a link only when the read
                            handed the template's slug (older fixtures omit it). */}
                        {row.templateSlug === undefined ? (
                          <Chip variant="tint">{rel.templateTitle}</Chip>
                        ) : (
                          <Link
                            href={relationshipTemplatePath(row.templateSlug)}
                            data-assessment-template={row.templateSlug}
                          >
                            <Chip variant="tint">{rel.templateTitle}</Chip>
                          </Link>
                        )}
                        <Chip variant="tint" data-assessment-state-badge={rel.state}>
                          {itemLabel(states, rel.state)}
                        </Chip>
                      </div>

                      <Link href={sessionHref} className={CARD_TITLE}>
                        {model.title}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{rel.party}</p>

                      {/* The record's figures are the card's one meta line (#795 F4) — the same
                          row the template shelf prints, handed over formatted by the projection. */}
                      <div className={CARD_META}>
                        {model.meta.map((fact, index) => (
                          <span
                            key={fact}
                            className={index === 0 ? "" : "border-l border-gray-300 pl-2"}
                          >
                            {fact}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Chip variant="neutral">{rel.mode}</Chip>
                        {rel.invite === null ? null : (
                          <Chip variant="soft" data-assessment-invite={rel.invite.state}>
                            {rel.invite.label}
                          </Chip>
                        )}
                      </div>

                      <p className={`mt-auto ${MUTED}`}>{rel.sentence}</p>

                      {/* The #252 marker: a quiet line on the row, never a toast or a count. */}
                      {rel.marker === null ? null : (
                        <p
                          data-assessment-marker={rel.unlock}
                          className="rounded border border-action/40 bg-action/5 px-2 py-1 text-sm font-medium text-action"
                        >
                          {rel.marker}
                        </p>
                      )}
                    </div>

                    <div className={`${CARD_ACTIONS} justify-between`}>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {rel.lastSession}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={relationshipScreenPath(rel.relationshipId)}
                          data-assessment-relationship-link={rel.relationshipId}
                          className="text-xs font-medium text-action underline-offset-4 hover:underline"
                        >
                          {itemLabel(links, "relationship")}
                        </Link>
                        {/* The Gap opens on acceptance (#R2), so the door is drawn only when the
                            report would draw a report; until then the session screen is the way
                            in, and it says why. */}
                        {rel.state === "complete" ? (
                          <Link
                            href={reportPath(rel.instanceRecordId)}
                            data-assessment-gap={rel.instanceRecordId}
                            className={OUTLINE}
                          >
                            {itemLabel(links, "gap")}
                          </Link>
                        ) : null}
                        <Link
                          href={sessionHref}
                          data-assessment-session-link={rel.instanceRecordId}
                          className={OUTLINE}
                        >
                          {itemLabel(links, "session")}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
