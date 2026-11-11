/**
 * template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: a relationship per card in the same title row, filter row, stage tabs and card grid — the axes are the card's cover, which carries the relationship's stage word on the muted wash where a quiz card carries its image, and the relationship's working facts: the one meta line is the record's figures, and what was paid is drawn on the Initiator's card alone)
 * The /v1 prototype of the same variation — `relationships-list.tsx` and the metric row in its
 * Manage tab — is deleted (#478); this file is the port that replaced it, and the ancestor above is
 * the surface both varied.
 *
 * `/assessment/instances` — the relationship list, server-rendered (#409, #213).
 *
 * **Server-rendered, not store-rewired.** The `/v1` surface is a client component bound to an
 * in-browser store, and a `"use client"` module may not value-import anything that reaches
 * `lib/db/**` or `pg` (#228, `data:check` E34). This file is the app's own expression of the same
 * variation: no `"use client"`, no state, no handler. The search and the stage tabs are plain
 * links and a GET form, so every state of the screen is a URL a `curl` can ask for — the same
 * reason `/templates/relationship` is built that way.
 *
 * **What a card may say is decided before it gets here.** `RelationshipCard` (`lib/db/
 * assessments.ts`) carries counts, a stage and — only when the latest session is complete — a
 * mean Gap. There is no field for one party's answers, no array of Opinions and no per-Aspect
 * score on this type, so a card cannot draw what the read did not hand it. `alignment === null`
 * is drawn `—` and never `0`: absent and zero are different facts, and a relationship nobody has
 * scored has no figure.
 *
 * **The card is a projection, and this file computes nothing** (#795 F2, F4). `relationshipCard()`
 * (`lib/member/card.ts`) turns a row into a `MemberCard`: the chips, the sentence, and the record's
 * one meta line — `3 of 4 sessions`, `Avg alignment 2.4`, `5 Aspects`, every figure formatted once,
 * there, beside the template shelf's cards, which are the same type and print the same line. The
 * component below prints what it is handed and joins nothing; `tests/member-card-projection.test.ts`
 * fails the build if a `toFixed`, a `Math.round` or a division of the two session counts comes back
 * into this file, and it fails if the four-tile grid the artifact replaced comes back either. The
 * stage tabs still count the rows this component was given, and the page's own copy is still the
 * fixture's (E23).
 */
import Link from "next/link";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { Chip } from "@/components/ui/badge";
import type { PageCopy } from "@/content/pages";
import { STAGE_LABELS } from "@/content/stages";
import type { RelationshipCard } from "@/lib/db/assessments";
import { type OverviewFilter, matchesOverviewFilter } from "@/lib/flow/overview";
import { MY_INSTANCES_PATH } from "@/lib/flow/paths";
import { FLOW_STAGES, type FlowStage } from "@/lib/flow/stage";
import {
  CARD_ABSENT,
  CARD_ACTIONS,
  CARD_COVER,
  CARD_COVER_WORD,
  CARD_FRAME,
  CARD_META,
  CARD_TITLE,
  relationshipCard,
} from "@/lib/member/card";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const STRONG = "font-semibold text-gray-900 dark:text-gray-100";
const OUTLINE =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

/**
 * The stage a `?stage=` value names, or `null` for "every relationship".
 *
 * An unknown value is no filter, exactly as `overviewFilterOf()` decides for `?filter=`: the
 * unfiltered list is true about every row it shows, while a list built from a value nobody
 * recognises would be a page that says it filtered and did not. `aligned` is deliberately not a
 * value — it is the report's verdict, not a stage (`lib/flow/stage.ts`).
 */
export function flowStageOf(value: string | readonly string[] | undefined): FlowStage | null {
  if (typeof value !== "string") return null;
  return FLOW_STAGES.find((stage) => stage === value) ?? null;
}

/** The stage tab ids, in ladder order, with `all` in front. */
const STAGE_TABS: readonly (FlowStage | "all")[] = ["all", ...FLOW_STAGES];

/** How many rows each tab would show. Counts the rows this page was handed, never a literal. */
export function stageCountsOf(
  rows: readonly RelationshipCard[],
): Readonly<Record<FlowStage | "all", number>> {
  const counts: Record<FlowStage | "all", number> = {
    all: rows.length,
    invited: 0,
    connected: 0,
    sharing: 0,
  };
  for (const row of rows) counts[row.stage] += 1;
  return counts;
}

/**
 * Does this row match the search box?
 *
 * Three fields, the same three the ancestor searches: the relationship's name (its own, else the
 * template's title), the template's title and the other person's name. Case-insensitive and
 * substring, because a directory is searched by a word a reader half-remembers. Nothing here can
 * match an answer: those are not on the row.
 */
export function matchesQuery(row: RelationshipCard, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [row.name, row.templateTitle, row.initiatorName ?? "", row.counterpartyName ?? ""].some(
    (field) => field.toLowerCase().includes(needle),
  );
}

export function MyInstances({
  copy,
  relationships,
  unreadable,
  filter = null,
  stage = null,
  query = "",
}: {
  copy: PageCopy;
  relationships: readonly RelationshipCard[];
  /** The database layer's sentence when the read did not answer; `null` when it did. */
  unreadable: string | null;
  /**
   * The one list the reader came here for, when they arrived from a console card (Console 2/5).
   *
   * `null` is the unfiltered list. The predicate is `matchesOverviewFilter()` — the same one the
   * Overview counted with — so the figure on the card and the length of this list are arithmetic
   * over one array, and the stage tabs count the rows this filter kept.
   */
  filter?: OverviewFilter | null;
  /** `?stage=` — one rung of the relationship ladder, or `null` for all of them. */
  stage?: FlowStage | null;
  /** `?q=` — the reader's search, already trimmed by the page. */
  query?: string;
}) {
  if (unreadable !== null) {
    const failure = sectionOf(copy, "unreadable");
    return (
      <StageColumn>
        <div
          data-my-instances-unreadable="true"
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failure.heading}</h1>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{sectionBody(failure)}</p>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{unreadable}</p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <a className="underline" href={MY_INSTANCES_PATH}>
              {itemLabel(failure, "reload")}
            </a>
          </p>
        </div>
      </StageColumn>
    );
  }

  const list = sectionOf(copy, "list");
  const empty = sectionOf(copy, "empty");
  const filters = sectionOf(copy, "filter");
  const stageCopy = sectionOf(copy, "stage");
  const search = sectionOf(copy, "search");

  // The console's filter first, then the stage tab, then the search: three narrowings of one
  // array, each one a predicate over the rows the read produced.
  const scoped =
    filter === null
      ? [...relationships]
      : relationships.filter((instance) => matchesOverviewFilter(instance, filter));
  const counts = stageCountsOf(scoped);
  const atStage = stage === null ? scoped : scoped.filter((instance) => instance.stage === stage);
  const shown = atStage.filter((instance) => matchesQuery(instance, query));

  /** `?stage=`/`?q=`/`?filter=` preserved across a tab click — a link, never a control. */
  const hrefFor = (tab: FlowStage | "all"): string => {
    const params = new URLSearchParams();
    if (filter !== null) params.set("filter", filter);
    if (tab !== "all") params.set("stage", tab);
    if (query !== "") params.set("q", query);
    const search_ = params.toString();
    return search_ === "" ? MY_INSTANCES_PATH : `${MY_INSTANCES_PATH}?${search_}`;
  };

  return (
    <StageColumn>
      {/* Title row, then the action — the ancestor's stacking: the heading answers "what am I in
          the middle of", the button answers "where does another one start". */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
          {copy.subtitle === undefined ? null : <p className={`mt-2 ${MUTED}`}>{copy.subtitle}</p>}
        </div>
        {copy.cta === undefined ? null : (
          <Link
            href={copy.cta.href}
            className="inline-flex h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover"
          >
            {copy.cta.label}
          </Link>
        )}
      </div>

      {/* The console's card sends the reader here with one list in mind (Console 2/5). The band
          names it and offers the way back to every row — without it a narrowed list would look
          like a list that lost somebody's relationships. */}
      {filter === null ? null : (
        <p data-my-instances-filter={filter} className={`mt-6 ${MUTED}`}>
          {itemLabel(filters, "showing")}:{" "}
          <span className={STRONG}>{itemLabel(filters, filter)}</span>{" "}
          <Link className="underline" href={MY_INSTANCES_PATH}>
            {itemLabel(filters, "show-all")}
          </Link>
        </p>
      )}

      {/* The filter row: a GET form, so the search is a URL and not a client bundle. */}
      <form
        method="get"
        action={MY_INSTANCES_PATH}
        className="mt-6 flex flex-col gap-3 md:flex-row md:items-end"
      >
        {filter === null ? null : <input type="hidden" name="filter" value={filter} />}
        {stage === null ? null : <input type="hidden" name="stage" value={stage} />}
        <div className="flex-1">
          <label
            htmlFor="relationship-search"
            className="mb-1 block text-xs text-gray-500 dark:text-gray-400"
          >
            {itemLabel(search, "label")}
          </label>
          <input
            id="relationship-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={itemLabel(search, "placeholder")}
            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          {itemLabel(search, "submit")}
        </button>
        <p className={MUTED}>
          {fillLabel(itemLabel(search, "count"), {
            shown: String(shown.length),
            total: String(scoped.length),
          })}
        </p>
      </form>

      {/* Stage tabs — links, because the surface is server-rendered: every tab is a URL. */}
      <nav
        data-stage-tabs="true"
        className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700"
      >
        {STAGE_TABS.map((tab) => (
          <Link
            key={tab}
            href={hrefFor(tab)}
            data-stage-tab={tab}
            aria-current={(stage ?? "all") === tab ? "page" : undefined}
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${
              (stage ?? "all") === tab
                ? "bg-action/10 text-action"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            {tab === "all" ? itemLabel(stageCopy, "all") : STAGE_LABELS[tab]} ({counts[tab]})
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        filter !== null && scoped.length === 0 ? (
          /**
           * A filter that keeps no rows is not the same sentence as "You are not in a relationship
           * yet": this reader has relationships, none of them in this state.
           */
          <section
            data-my-instances-filter-empty={filter}
            className={`mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900`}
          >
            <p className={MUTED}>{itemLabel(filters, "empty")}</p>
            <p className="mt-3 text-sm">
              <Link className="underline" href={MY_INSTANCES_PATH}>
                {itemLabel(filters, "show-all")}
              </Link>
            </p>
          </section>
        ) : scoped.length === 0 ? (
          <section
            data-empty-state="true"
            className={`mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900`}
          >
            <h2 className={`text-xl ${STRONG}`}>{empty.heading}</h2>
            <p className={`mt-2 ${MUTED}`}>{sectionBody(empty)}</p>
            {empty.cta === undefined ? null : (
              <p className="mt-4">
                <Link
                  href={empty.cta.href}
                  className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover"
                >
                  {empty.cta.label}
                </Link>
              </p>
            )}
          </section>
        ) : (
          /**
           * Rows exist and this narrowing keeps none of them. Three different sentences, because
           * they are three different facts: a stage with no relationship, a search with no match,
           * and a search over a stage that had rows.
           */
          <section
            data-stage-empty={stage ?? "search"}
            className={`mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900`}
          >
            <p className={MUTED}>
              {query !== "" ? itemLabel(search, "no-match") : itemLabel(stageCopy, "empty")}
            </p>
            <p className="mt-3 text-sm">
              <Link className="underline" href={MY_INSTANCES_PATH}>
                {itemLabel(filters, "show-all")}
              </Link>
            </p>
          </section>
        )
      ) : (
        <section data-my-instances="true" className="mt-6">
          <h2 className={`text-xl ${STRONG}`}>{list.heading}</h2>
          <p className={`mt-2 ${MUTED}`}>{sectionBody(list)}</p>

          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((row) => {
              // One projection call; the list prints what it returns and composes no figure, no
              // name and no sentence of its own (#795 F2).
              const model = relationshipCard(copy, row);
              const rel = model.relationship;

              return (
                <li
                  key={rel.relationshipId}
                  data-instance={rel.instanceRecordId}
                  data-instance-state={rel.state}
                  data-instance-stage={rel.stage}
                  data-instance-unlock={rel.unlock}
                  className={CARD_FRAME}
                >
                  {/* One card, and the same one as the template shelf: the frame, the 104 px cover
                      slot, the title and the facts line come from `lib/member/card.ts`. The axis is
                      what goes *in* the cover — the stage word where a template draws its monogram
                      — because a relationship has no thumbnail. `aria-hidden` keeps it decoration:
                      the chip below carries the stage as text. */}
                  <div className={`${CARD_COVER} bg-gray-50 dark:bg-gray-800/40`}>
                    <span className={CARD_COVER_WORD} aria-hidden="true">
                      {rel.stageLabel}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip variant="tint">{rel.templateTitle}</Chip>
                      <Chip variant="tint" data-stage-badge={rel.stage}>
                        {rel.stageLabel}
                      </Chip>
                    </div>
                    <Link href={model.detail.href} className={CARD_TITLE}>
                      {model.title}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{rel.party}</p>

                    {/* The record's figures are the card's one meta line (#795 F4) — the same row
                        the template shelf prints, handed over formatted by the projection. */}
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
                        <Chip variant="soft" data-invite-state={rel.invite.state}>
                          {rel.invite.label}
                        </Chip>
                      )}
                    </div>

                    {/* What was paid — the Initiator's card only, and no total anywhere. The
                        block is absent for every other viewer, not blanked: `paid` is `null`
                        because the read never handed this seat the fact, and a statement of
                        `null` is the different fact that nothing has been bought yet. */}
                    {rel.paid === null ? null : (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/40">
                        <p className="text-gray-500 dark:text-gray-400">{rel.paid.label}</p>
                        {rel.paid.statement === null ? (
                          <p data-paid-absent="true" className={STRONG}>
                            {CARD_ABSENT}
                          </p>
                        ) : (
                          <p className={STRONG}>{rel.paid.statement}</p>
                        )}
                      </div>
                    )}

                    <p className={`mt-auto ${MUTED}`}>{rel.sentence}</p>

                    {/* The marker (#252): a quiet line on the row, never a toast, a modal or a
                        count in the header. It says the instance moved while this reader was
                        away — the one fact the state sentence above cannot carry. */}
                    {rel.marker === null ? null : (
                      <p
                        data-instance-marker={rel.unlock}
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
                    <Link href={model.detail.href} className={OUTLINE}>
                      {model.detail.label}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </StageColumn>
  );
}
