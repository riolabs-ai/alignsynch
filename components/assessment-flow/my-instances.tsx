/**
 * template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: a relationship per card — the same title row with the primary action at the right, the same search field in a filter row, the same stage tabs and the same card grid; the cover block becomes a stage band, the metric row translates Players → sessions `N of M`, Completion → session completion, Average Score → average alignment and `N Questions` → `N Aspects`, and what was paid is drawn on the Initiator's card alone)
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
 * **Every number is derived.** The stage tabs count the rows this component was given, the card's
 * `N of M` is `sessionsCompleted of sessionsOpened`, and the completion percentage is those two
 * divided — there is no literal in this file, and E23 holds it to zero (`data/pages/
 * assessment-instances.ts` carries every word).
 *
 * **No total, and no clock.** What was paid is the plan and the instant it was bought, on the
 * Initiator's card only: one relationship, one purchase, nothing to sum. A date label is a pure
 * function of the ISO instant it read (`formatRelative` against the fixture clock, `formatDate`
 * for an instant past it), because a render path that asks the wall clock prints a label the
 * same rows would print differently a minute later.
 */
import Link from "next/link";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { MODE_LABELS } from "@/content/assessment";
import { DEMO_NOW_ISO, formatDate, formatRelative } from "@/content/core";
import { STAGE_LABELS } from "@/content/stages";
import type { PageCopy } from "@/content/pages";
import type { RelationshipCard } from "@/lib/db/assessments";
import { type OverviewFilter, matchesOverviewFilter } from "@/lib/flow/overview";
import { MY_INSTANCES_PATH, instancePath } from "@/lib/flow/paths";
import { FLOW_STAGES, type FlowStage } from "@/lib/flow/stage";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The one glyph an absent figure is drawn as.
 *
 * Not `0`, and not an empty cell: a metric that has no value and a metric whose value is zero are
 * different facts, and only one of them can be true of a relationship nobody has scored.
 */
const ABSENT = "—";

const CARD =
  "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const STRONG = "font-semibold text-gray-900 dark:text-gray-100";
const CHIP =
  "inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200";

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

/** The label a row's instant is drawn with — a pure function of the instant, never a clock. */
const FIXTURE_CLOCK_MS = Date.parse(DEMO_NOW_ISO);

export function sessionLabelOf(iso: string): string {
  return Date.parse(iso) > FIXTURE_CLOCK_MS ? formatDate(iso) : formatRelative(iso);
}

/**
 * The other side of the card, from the seat the read resolved for this request.
 *
 * Which name is "the other one" is the session's fact, not the row's: the same relationship
 * renders as two different cards to its two parties, and neither card ever names its own reader
 * as the other person. A coach is neither, so they read both names in the direction the
 * relationship was created in.
 */
function otherNameOf(row: RelationshipCard, copy: PageCopy): string {
  const unnamed = itemLabel(sectionOf(copy, "row"), "unnamed-party");
  if (row.viewerRole === "counterparty") return row.initiatorName ?? unnamed;
  if (row.viewerRole === "initiator") return row.counterpartyName ?? unnamed;
  return `${row.initiatorName ?? unnamed} → ${row.counterpartyName ?? unnamed}`;
}

/** One metric tile of the ancestor's stats grid: a label above a figure. */
function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
      <dt className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`text-base ${STRONG}`}>{value}</dd>
      {hint === undefined ? null : (
        <dd className="text-[10px] text-gray-500 dark:text-gray-400">{hint}</dd>
      )}
    </div>
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
  const states = sectionOf(copy, "state");
  const marker = sectionOf(copy, "marker");
  const empty = sectionOf(copy, "empty");
  const filters = sectionOf(copy, "filter");
  const stageCopy = sectionOf(copy, "stage");
  const search = sectionOf(copy, "search");
  const metric = sectionOf(copy, "metric");
  const card = sectionOf(copy, "card");
  const paidCopy = sectionOf(copy, "paid");
  const inviteCopy = sectionOf(copy, "invite");

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
            {shown.map((instance) => {
              const other = otherNameOf(instance, copy);
              const sessions =
                instance.sessionsOpened === 0
                  ? ABSENT
                  : `${instance.sessionsCompleted} of ${instance.sessionsOpened}`;
              const completion =
                instance.sessionsOpened === 0
                  ? ABSENT
                  : `${Math.round((instance.sessionsCompleted / instance.sessionsOpened) * 100)}%`;
              const alignment =
                instance.alignment === null ? ABSENT : instance.alignment.toFixed(1);

              return (
                <li
                  key={instance.relationshipId}
                  data-instance={instance.instanceRecordId}
                  data-instance-state={instance.state}
                  data-instance-stage={instance.stage}
                  data-instance-unlock={instance.unlock}
                  className={CARD}
                >
                  {/* The ancestor's cover-and-overlay block, without the image: a relationship
                      carries a template, a stage and two names, not a thumbnail. */}
                  <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className={CHIP}>{instance.templateTitle}</span>
                      <span data-stage-badge={instance.stage} className={CHIP}>
                        {STAGE_LABELS[instance.stage]}
                      </span>
                    </div>
                    <Link
                      href={instancePath(instance.instanceRecordId)}
                      className="line-clamp-2 text-lg font-semibold text-gray-900 hover:text-action hover:underline dark:text-gray-100"
                    >
                      {instance.name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {itemLabel(card, "with")} ·{" "}
                      {instance.counterpartyName === null && instance.viewerRole !== "counterparty"
                        ? itemLabel(card, "not-claimed")
                        : other}
                    </p>
                  </div>

                  <div className="flex flex-1 flex-col gap-4 p-4">
                    <dl className="grid grid-cols-2 gap-2 text-center">
                      <MetricTile
                        label={itemLabel(metric, "sessions")}
                        value={sessions}
                        hint={
                          instance.sessionsOpened === 0
                            ? itemLabel(metric, "none-opened")
                            : itemLabel(metric, "completed-of-opened")
                        }
                      />
                      <MetricTile label={itemLabel(metric, "completion")} value={completion} />
                      <MetricTile
                        label={itemLabel(metric, "alignment")}
                        value={alignment}
                        hint={
                          instance.alignment === null
                            ? itemLabel(metric, "unscored")
                            : itemLabel(metric, "mean-gap")
                        }
                      />
                      <MetricTile
                        label={itemLabel(metric, "aspects")}
                        value={String(instance.aspectCount)}
                      />
                    </dl>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={CHIP}>{MODE_LABELS[instance.mode]}</span>
                      {instance.inviteState === null ? null : (
                        <span data-invite-state={instance.inviteState} className={CHIP}>
                          {itemLabel(inviteCopy, instance.inviteState)}
                        </span>
                      )}
                    </div>

                    {/* What was paid — the Initiator's card only, and no total anywhere. `paid`
                        is `null` for every other viewer, so this block is not drawn from a
                        value the read withheld; it was never handed one. */}
                    {instance.paid === null ? null : (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/40">
                        <p className="text-gray-500 dark:text-gray-400">
                          {itemLabel(paidCopy, "label")}
                        </p>
                        {instance.paid.plan === null && instance.paid.purchasedAt === null ? (
                          <p data-paid-absent="true" className={STRONG}>
                            {ABSENT}
                          </p>
                        ) : (
                          <p className={STRONG}>
                            {fillLabel(itemLabel(paidCopy, "statement"), {
                              plan: instance.paid.plan ?? itemLabel(paidCopy, "nothing"),
                              date:
                                instance.paid.purchasedAt === null
                                  ? ABSENT
                                  : formatDate(instance.paid.purchasedAt),
                            })}
                          </p>
                        )}
                      </div>
                    )}

                    <p className={`mt-auto ${MUTED}`}>
                      {fillLabel(itemLabel(states, instance.state), { name: other })}
                    </p>

                    {/* The marker (#252): a quiet line on the row, never a toast, a modal or a
                        count in the header. It says the instance moved while this reader was
                        away — the one fact the state sentence above cannot carry. */}
                    {instance.unlock === "unseen" ? (
                      <p
                        data-instance-marker="unseen"
                        className="rounded border border-action/40 bg-action/5 px-2 py-1 text-sm font-medium text-action"
                      >
                        {itemLabel(marker, "unseen")}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {fillLabel(itemLabel(card, "last-session"), {
                        when: sessionLabelOf(instance.lastSessionAt),
                      })}
                    </span>
                    <Link
                      href={instancePath(instance.instanceRecordId)}
                      className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      {itemLabel(card, "view")}
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
