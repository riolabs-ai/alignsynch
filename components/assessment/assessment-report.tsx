/**
 * The assessment report, drawn — the read-only half of `/assessment/[slug]`.
 *
 * Every number on this screen is an expression over the view model
 * (`lib/assessment-report.ts`): the scores are the fixture's, and the eight Gaps are
 * `content/gaps.ts`'s pairs, one `gapOf()` each. Nothing here is typed in, nothing here
 * can be edited, and there is no state to submit — the component is a server component
 * with no `"use client"`, because a screen that only reads has no handlers to run.
 *
 * **One line per Gap, not one line per Opinion.** The glossary's Gaps are pairs, and a
 * pair is not always "the same answer from both parties": an Initiator Think Gap is
 * Noor's *thought* about Iris against Iris's *actual* Feel. So a line names the two
 * Opinions it subtracts (who, which kind, which score) and prints the Gap those two make,
 * which is why the old party-column table is gone — a score's column said who gave it but
 * not what it was compared with.
 *
 * It takes the projection rather than the records so the render is testable in a node
 * environment: `tests/assessment-report.test.ts` renders this with `renderToStaticMarkup`
 * and reads the row attributes back out of the markup.
 *
 * The filled notch is `bg-action`, not the purple 600 step (issue #187): this is the screen a
 * visitor lands on after an assessment, and 28 purple dots on it were the loudest palette leak
 * in the AlignSynch build — the `assessment-flow` components this card owns are the write half
 * of the same product, so leaving the read half purple would have moved the leak one route to
 * the right. The unfilled notch stays `bg-gray-200`: it is a neutral ground, not a brand colour.
 */
import type { OpinionKind } from "@/content/assessment";
import { MODE_LABELS } from "@/content/assessment";
import type { GapSource, GapSourceSide } from "@/content/gaps";
import { GAP_KIND_LABELS, GAP_KIND_SOURCES, GAP_KINDS } from "@/content/gaps";
import type { AspectReportRow, AssessmentReport, ReportedParty } from "@/lib/assessment-report";
import { cn } from "@/lib/utils";

/** The four opinion kinds as a reader sees them: "Noor Think", never "Noor think". */
const OPINION_LABELS: Record<OpinionKind, string> = {
  feel: "Feel",
  wish: "Wish",
  think: "Think",
  guess: "Guess",
};

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
 * One Gap of one Aspect: its glossary name, the two Opinions it subtracts, and the number.
 *
 * A kind is drawn only when it has a number. The four Basic kinds always do (Feel and Wish
 * are required on both sides); the four prediction kinds do only on an Advanced instance,
 * where both parties answered Think and Guess. Basic never renders a Think or Guess Gap,
 * because the schema never let it store the score one would need.
 */
function GapLine({ row, source }: { row: AspectReportRow; source: GapSource }) {
  const gap = row.gaps[source.kind];
  const left = sideOf(row, source.left);
  const right = sideOf(row, source.right);
  if (gap === undefined || left.value === undefined || right.value === undefined) return null;

  return (
    <div className="grid grid-cols-[12rem_1fr_3.5rem] items-center gap-3 py-1.5">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {GAP_KIND_LABELS[source.kind]}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SideScore side={left} min={row.min} max={row.max} />
        <span aria-hidden className="text-xs text-gray-400 dark:text-gray-500">
          vs
        </span>
        <SideScore side={right} min={row.min} max={row.max} />
      </span>
      <span className="text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {gap === 0 ? "In synch" : gap}
      </span>
    </div>
  );
}

/** The column names for one Aspect's Gaps: the kind, the pair it subtracts, the value. */
function GapHeading() {
  return (
    <div className="grid grid-cols-[12rem_1fr_3.5rem] items-center gap-3 border-b border-gray-200 pb-1 dark:border-gray-700">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Gap
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        The two Opinions it compares
      </span>
      <span className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Value
      </span>
    </div>
  );
}

/**
 * One Aspect: what is asked, the two Values that name the band's ends, and one line per Gap
 * kind it has — four on a Basic instance, eight on an Advanced one.
 */
function AspectRow({ row }: { row: AspectReportRow }) {
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
      <p className="mb-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
        <span>{row.leftValue}</span>
        <span className="mx-2 text-gray-400 dark:text-gray-500">—</span>
        <span>{row.rightValue}</span>
      </p>
      <GapHeading />
      {GAP_KIND_SOURCES.map((source) => (
        <GapLine key={source.kind} row={row} source={source} />
      ))}
    </section>
  );
}

export function AssessmentReportView({ report }: { report: AssessmentReport }) {
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
      <div className="space-y-4">
        {report.rows.map((row) => (
          <AspectRow key={row.itemId} row={row} />
        ))}
      </div>
    </div>
  );
}

export default AssessmentReportView;
