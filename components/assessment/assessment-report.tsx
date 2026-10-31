/**
 * The assessment report, drawn — the read-only half of `/assessment/[slug]`.
 *
 * Every number on this screen is an expression over the view model
 * (`lib/assessment-report.ts`): the scores are the fixture's, and the Gaps are `gapOf()`
 * over the pair beside them. Nothing here is typed in, nothing here can be edited, and
 * there is no state to submit — the component is a server component with no `"use client"`,
 * because a screen that only reads has no handlers to run.
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
import type { AspectReportRow, AssessmentReport, ReportedParty } from "@/lib/assessment-report";
import { cn } from "@/lib/utils";

/** The opinion kinds in the glossary's order: Basic's pair, then Advanced's. */
const OPINION_KINDS: readonly OpinionKind[] = ["feel", "wish", "think", "guess"];

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
      aria-label={`${party} ${kind}: ${value}`}
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

/** One opinion kind for one Aspect: both parties' positions, and the Gap between them. */
function OpinionLine({ row, kind }: { row: AspectReportRow; kind: OpinionKind }) {
  const left = row.left.opinions[kind];
  const right = row.right.opinions[kind];
  const gap = row.gaps[kind];

  // Only the kinds both parties answered are drawn: Think and Guess are Advanced Mode,
  // answered per Aspect, and a row with one side blank is a Gap with nothing to measure.
  if (left === undefined || right === undefined || gap === undefined) return null;

  return (
    <div className="grid grid-cols-[5rem_1fr_1fr_3.5rem] items-center gap-3 py-1.5">
      <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
        {kind}
      </span>
      <Notches min={row.min} max={row.max} value={left} party={row.left.name} kind={kind} />
      <Notches min={row.min} max={row.max} value={right} party={row.right.name} kind={kind} />
      <span className="text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {gap === 0 ? "In synch" : gap}
      </span>
    </div>
  );
}

/** The column names for one Aspect's answers: who answered, and what the last column is. */
function RowHeading({ left, right }: { left: ReportedParty; right: ReportedParty }) {
  return (
    <div className="grid grid-cols-[5rem_1fr_1fr_3.5rem] items-center gap-3 border-b border-gray-200 pb-1 dark:border-gray-700">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Aspect
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {left.name}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {right.name}
      </span>
      <span className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Gap
      </span>
    </div>
  );
}

/** One Aspect: what is asked, the two Values that name the band's ends, and the answers. */
function AspectRow({ row }: { row: AspectReportRow }) {
  return (
    <section
      // Read back by the render test: the Gap of this Aspect is on the row, not in a
      // sentence a regex has to guess at.
      data-aspect={row.itemId}
      data-feel-gap={row.gaps.feel}
      data-wish-gap={row.gaps.wish}
      {...(row.gaps.think === undefined ? {} : { "data-think-gap": row.gaps.think })}
      {...(row.gaps.guess === undefined ? {} : { "data-guess-gap": row.gaps.guess })}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{row.prompt}</h2>
      <p className="mb-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
        <span>{row.leftValue}</span>
        <span className="mx-2 text-gray-400 dark:text-gray-500">—</span>
        <span>{row.rightValue}</span>
      </p>
      <RowHeading left={row.left} right={row.right} />
      {OPINION_KINDS.map((kind) => (
        <OpinionLine key={kind} row={row} kind={kind} />
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
