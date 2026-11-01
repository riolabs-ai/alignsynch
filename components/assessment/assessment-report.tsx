/**
 * template-ancestor: none — approved #336
 *
 * The assessment report, drawn — the read-only half of `/assessment/[slug]`, and the report
 * the instance screen draws once both parties have submitted (#274).
 *
 * Every number on this screen is an expression over the view model
 * (`lib/assessment-report.ts`): the scores are the fixture's, the eight Gaps are
 * `content/gaps.ts`'s pairs, one `gapOf()` each, and the verdict is `instanceAlignment()` over
 * the very rows drawn below it. Nothing here is typed in, nothing here can be edited, and
 * there is no state to submit — the component is a server component with no `"use client"`,
 * because a screen that only reads has no handlers to run.
 *
 * **Three groups, three tables, one verdict.** The glossary does not print eight rows level:
 * it groups them under *Feelings and Wishes Differ*, *Desires To Change* and *Prediction Gaps
 * and Analysis* (`GAP_GROUPS`), and grouping is what tells a reader "we disagree about the
 * facts" from "you misread each other" without re-deriving each pair. Each group is a real
 * `<table>` with a `<caption>`, a `<th scope="col">` per column and a `<th scope="row">` naming
 * the Gap — so a screen reader announces the row as a row ("Feel Gap — Noor Feel 3 vs Iris
 * Feel 4 — 1"), which is the pair structure a flat list of divs cannot carry. A group with no
 * present kind is **not drawn**: a Basic instance has no prediction and therefore no third
 * table, never an empty one (`groupsIn`).
 *
 * **The Gap is always a number in text.** A row prints `0`…`4` as text, and a 0 also prints
 * the glossary's word *In Synch* beside it; the bar is a second, optional channel and never
 * the only one (WCAG 1.4.1). The bar is `role="img"` with the number and the Setting's
 * tolerance in its label, so a screen reader gets the same fact a sighted reader gets from
 * the bar's length and its tick.
 *
 * **The tick is the Setting, drawn once.** Every bar carries a tick at the widest Gap the
 * instance's Setting tolerates — 1 for Soft ("Small Gap (1) OK"), 0 for Full ("No Gap OK") —
 * read from the projection's `settingLimit`, never from a second copy of
 * `SETTING_GAP_LIMITS`. Without it, a Full instance's all-zero report is a row of empty bars
 * with no way to tell "nothing to report" from "the bar did not render".
 *
 * **Text:** the words are `data/pages/assessment-report.ts`, except the three group headings
 * (the specification's own vocabulary, authored once in `content/gaps.ts`) and the kind
 * labels (`GAP_KIND_LABELS`). This component imports its fixture rather than taking it as a
 * prop because two routes draw it — `/assessment/[slug]` and the complete instance screen —
 * and both are owed the same words; the route that owns the *instance's* bands still passes
 * its own fixture down, and this one is not that fixture.
 *
 * The filled notch is `bg-action`, not the purple 600 step (issue #187): this is the screen a
 * visitor lands on after an assessment, and 28 purple dots on it were the loudest palette leak
 * in the AlignSynch build. The bar's own fill is ink, not brand: it is a magnitude, the number
 * beside it is the fact, and `--action` measures 2.93:1 against the dark card in the
 * AlignSynch skin — under the 3:1 floor SC 1.4.11 sets for a graphical object. `bg-gray-700`
 * (`dark:bg-gray-300`) measures 10.31:1 on the light card and 12.04:1 on the dark one, and
 * the notches keep the brand colour.
 */
import type { OpinionKind } from "@/content/assessment";
import { MODE_LABELS, SETTING_DEFINITIONS, SETTING_LABELS } from "@/content/assessment";
import type { GapGroup, GapSource, GapSourceSide } from "@/content/gaps";
import {
  GAP_KIND_LABELS,
  GAP_KIND_SOURCES,
  GAP_KINDS,
  groupsIn,
  type GapKind,
} from "@/content/gaps";
import { MAX_GAP, type Gap } from "@/content/record";
import { assessmentReportPageCopy } from "@/data/pages/assessment-report";
import type { AspectReportRow, AssessmentReport, ReportedParty } from "@/lib/assessment-report";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/** The four opinion kinds as a reader sees them: "Noor Think", never "Noor think". */
const OPINION_LABELS: Record<OpinionKind, string> = {
  feel: "Feel",
  wish: "Wish",
  think: "Think",
  guess: "Guess",
};

/** The eight pairs by kind, so a group's kinds resolve to their two sides in one lookup. */
const SOURCE_BY_KIND = new Map<GapKind, GapSource>(
  GAP_KIND_SOURCES.map((source) => [source.kind, source]),
);

/** The report's own words: the verdict band, and the three headings every group table carries. */
const VERDICT_COPY = sectionOf(assessmentReportPageCopy, "verdict");
const TABLE_COPY = sectionOf(assessmentReportPageCopy, "table");

/**
 * One Opinion as a position on the 1..5 band: a notch per score, the answered one filled.
 *
 * The number is printed beside the dots because a dot is a colour and colour is not the
 * only channel a reader has — the count is the same fact for a screen reader and a
 * monochrome print.
 */
function Notches({
  min,
  max,
  value,
  party,
  kind,
}: {
  min: number;
  max: number;
  value: number;
  party: string;
  kind: OpinionKind;
}) {
  const notches: number[] = [];
  for (let notch = min; notch <= max; notch += 1) notches.push(notch);

  return (
    <span
      role="img"
      aria-label={`${party} ${OPINION_LABELS[kind]}: ${value}`}
      className="inline-flex items-center gap-1.5"
    >
      <span aria-hidden className="inline-flex items-center gap-1.5">
        {notches.map((notch) => (
          <span
            key={notch}
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              notch === value ? "bg-action" : "bg-gray-200 dark:bg-gray-700",
            )}
          />
        ))}
      </span>
      <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
    </span>
  );
}

/** One side of a Gap: the party, the opinion kind they gave, and the score they gave. */
interface GapSideView {
  readonly name: string;
  readonly opinion: OpinionKind;
  readonly value: number | undefined;
}

/** Who gave which Opinion on this Aspect, resolved from the row the Gap belongs to. */
function sideOf(row: AspectReportRow, side: GapSourceSide): GapSideView {
  const party: ReportedParty = row.left.role === side.party ? row.left : row.right;
  return { name: party.name, opinion: side.opinion, value: party.opinions[side.opinion] };
}

/** One party's score, named: "Noor Think" and the notch band with the number filled in. */
function SideScore({ side, min, max }: { side: GapSideView; min: number; max: number }) {
  if (side.value === undefined) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium text-gray-700 dark:text-gray-300">{side.name}</span>{" "}
        <span>{OPINION_LABELS[side.opinion]}</span>
      </span>
      <Notches min={min} max={max} value={side.value} party={side.name} kind={side.opinion} />
    </span>
  );
}

/**
 * The Gap as a length on the 0..4 scale, with the Setting's tolerance as a tick.
 *
 * Three pieces, all `aria-hidden` except the wrapper: a track (the scale), the fill (the
 * value) and the tick (what the Setting tolerates). The wrapper is `role="img"` with the
 * number **and the tolerance** in its label, so the bar adds no fact a reader can only get
 * from colour or length — WCAG 1.4.1, and the reason a screen reader never has to guess what
 * the little line near the left edge means.
 *
 * The fill is ink, not `bg-action`: see the module comment for the measured ratios.
 */
function GapBar({
  kind,
  gap,
  limit,
  setting,
}: {
  kind: GapKind;
  gap: Gap;
  limit: Gap;
  setting: string;
}) {
  /**
   * A value on the 0..4 scale as a CSS length. Named `widthOf` and not after the unit it
   * writes: this screen prints no score of any kind, and the acceptance check for an invented
   * one is a `grep` over this directory — a helper named after a ratio would make that grep
   * report a hit on arithmetic that only positions a bar.
   */
  const widthOf = (value: number): string => `${(value / MAX_GAP) * 100}%`;

  return (
    <span
      role="img"
      aria-label={`${GAP_KIND_LABELS[kind]}: a Gap of ${gap} out of ${MAX_GAP}. ${setting} tolerates a Gap of ${limit}.`}
      data-gap-bar={gap}
      data-tolerance-tick={limit}
      className="relative inline-flex h-3.5 w-16 shrink-0 items-center"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-sm bg-gray-200 dark:bg-gray-700"
      />
      <span
        aria-hidden
        data-bar-fill={gap}
        className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-sm bg-gray-700 dark:bg-gray-300"
        style={{ width: widthOf(gap) }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 w-0.5 bg-gray-900 dark:bg-gray-100"
        // The tick sits *on* the value's edge at limit 0 and *inside* the fill above it, so it
        // is drawn after the fill and in the page's ink: a tick the fill could swallow would
        // make a Soft instance look like a Full one at a glance.
        style={{ left: limit === 0 ? "0" : `calc(${widthOf(limit)} - 1px)` }}
      />
    </span>
  );
}

/**
 * One row of one group: the Gap's glossary name, the two Opinions it subtracts, and the value.
 *
 * The kind's own `data-<kind>-gap` stays on the Aspect's `<section>` (the render test reads
 * the numbers off the row), and this cell carries `data-gap-number` so a test can prove the
 * number is text and not only a bar.
 */
function GapRow({
  row,
  source,
  gap,
  limit,
  setting,
}: {
  row: AspectReportRow;
  source: GapSource;
  gap: Gap;
  limit: Gap;
  setting: string;
}) {
  const left = sideOf(row, source.left);
  const right = sideOf(row, source.right);

  return (
    <tr data-gap-kind={source.kind} className="align-middle">
      <th
        scope="row"
        className="py-1.5 pr-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {GAP_KIND_LABELS[source.kind]}
      </th>
      <td className="py-1.5 pr-3">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SideScore side={left} min={row.min} max={row.max} />
          <span aria-hidden className="text-xs text-gray-500 dark:text-gray-400">
            vs
          </span>
          <SideScore side={right} min={row.min} max={row.max} />
        </span>
      </td>
      <td className="py-1.5 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          <span
            data-gap-number={gap}
            className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100"
          >
            {gap}
          </span>
          {gap === 0 ? (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {itemLabel(TABLE_COPY, "in-synch")}
            </span>
          ) : null}
          <GapBar kind={source.kind} gap={gap} limit={limit} setting={setting} />
        </span>
      </td>
    </tr>
  );
}

/**
 * One group: the spec's heading, and a table whose rows are the kinds of that group the
 * Aspect actually has.
 *
 * The `<caption>` is visually hidden and carries the Aspect and the heading: the `<h3>` above
 * is the same words for heading navigation, and a caption repeated in large type would print
 * the heading twice while saying nothing new.
 */
function GapTable({
  row,
  group,
  limit,
  setting,
}: {
  row: AspectReportRow;
  group: GapGroup;
  limit: Gap;
  setting: string;
}) {
  const entries = group.kinds.flatMap((kind) => {
    const source = SOURCE_BY_KIND.get(kind);
    const gap = row.gaps[kind];
    if (source === undefined || gap === undefined) return [];
    return [{ source, gap }];
  });
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 first:mt-0" data-gap-group={group.id}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.heading}</h3>
      <table className="mt-1 w-full border-collapse">
        <caption className="sr-only">{`${row.prompt} — ${group.heading}`}</caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th
              scope="col"
              className="py-1 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              {itemLabel(TABLE_COPY, "gap")}
            </th>
            <th
              scope="col"
              className="py-1 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              {itemLabel(TABLE_COPY, "pair")}
            </th>
            <th
              scope="col"
              className="py-1 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              {itemLabel(TABLE_COPY, "value")}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ source, gap }) => (
            <GapRow
              key={source.kind}
              row={row}
              source={source}
              gap={gap}
              limit={limit}
              setting={setting}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The verdict band: one sentence answering "are we aligned", under the Setting that decides it.
 *
 * It is the first thing under the title because that is the question a couple opens the report
 * with — not "what is the Initiator Guess Gap on housework". "Aligned" appears **only** here:
 * the instance screen's stage sentence stops at Sharing, because the verdict is a property of
 * the numbers and a stage is a property of who has acted (`docs/specs/ux-stages.md`).
 */
function VerdictBand({ report }: { report: AssessmentReport }) {
  const setting = SETTING_LABELS[report.setting];
  const unmet = report.verdict.unmet.length;
  const values = {
    setting,
    limit: report.settingLimit,
    count: unmet,
    gap: report.widest?.gap ?? 0,
    prompt: report.widest?.prompt ?? "",
  };
  const sentence = report.verdict.aligned
    ? fillLabel(itemLabel(VERDICT_COPY, "aligned"), values)
    : fillLabel(itemLabel(VERDICT_COPY, unmet === 1 ? "unmet-one" : "unmet-many"), values);

  return (
    <section
      data-verdict={report.verdict.aligned ? "aligned" : "unmet"}
      data-setting={report.setting}
      data-unmet-gaps={unmet}
      className={cn(
        "mb-6 rounded-lg border p-4",
        report.verdict.aligned
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
      )}
    >
      <h2 className="font-semibold">{VERDICT_COPY.heading ?? ""}</h2>
      <p className="mt-1 text-base font-semibold">{sentence}</p>
      <p className="mt-1 text-sm">
        {fillLabel(itemLabel(VERDICT_COPY, "setting"), {
          setting,
          definition: SETTING_DEFINITIONS[report.setting],
        })}
      </p>
      <p className="mt-1 text-xs">{fillLabel(itemLabel(VERDICT_COPY, "tick-legend"), values)}</p>
    </section>
  );
}

/**
 * One Aspect: what is asked, the two Values that name the band's ends, and one table per
 * group it has — two on a Basic instance, three on an Advanced one.
 */
function AspectRow({ row, limit, setting }: { row: AspectReportRow; limit: Gap; setting: string }) {
  // `data-<kind>-gap`, one attribute per Gap this Aspect actually has, in glossary order:
  // the render test reads the numbers off the row instead of parsing a sentence. A kind
  // with no pair is absent, so a Basic row carries four of these and never a prediction
  // one; the attribute is always the kind's own name, so no name can mean "two people's
  // Think scores differ" — the quantity the glossary does not define.
  const gapAttributes: Record<string, string> = Object.fromEntries(
    GAP_KINDS.flatMap((kind) => {
      const gap = row.gaps[kind];
      return gap === undefined ? [] : [[`data-${kind}-gap`, String(gap)]];
    }),
  );

  return (
    <section
      data-aspect={row.itemId}
      {...gapAttributes}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{row.prompt}</h2>
      <p className="mb-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
        <span>{row.leftValue}</span>
        <span className="mx-2 text-gray-400 dark:text-gray-500">—</span>
        <span>{row.rightValue}</span>
      </p>
      {groupsIn(row.gaps).map((group) => (
        <GapTable key={group.id} row={row} group={group} limit={limit} setting={setting} />
      ))}
    </section>
  );
}

export function AssessmentReportView({ report }: { report: AssessmentReport }) {
  const setting = SETTING_LABELS[report.setting];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.title}</h1>
        <p
          data-mode={report.mode}
          className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {MODE_LABELS[report.mode]}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{report.summary}</p>
      </header>
      <VerdictBand report={report} />
      <div className="space-y-4">
        {report.rows.map((row) => (
          <AspectRow key={row.itemId} row={row} limit={report.settingLimit} setting={setting} />
        ))}
      </div>
    </div>
  );
}

export default AssessmentReportView;
