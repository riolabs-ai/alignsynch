/**
 * template-ancestor: components/assessment/assessment-report.tsx   (variation: the instance's read through the flow screen, with the locked page replacing a redacted body — the v1 report body it was ported from is deleted with `/v1`)
 *
 * `/assessment/instances/[instanceId]/report` — **the one read surface the app did not have**
 * (#409). This is the surface whose loss cost a whole card to restore: a report that collapses to
 * "widest gap 3" is a number with no mechanism, so every Gap here prints **the two Opinions it
 * subtracts**, named by party and by value, beside the result.
 *
 * ## The blind rule, as a branch and not as a redaction
 *
 * `screen.report` is `null` until both parties have answered every Aspect (`projectScreen` →
 * `instanceStatusOf` → `assessmentReport`, and `readFlowScreen` never reads the other party's
 * opinion rows before that). When it is `null` this component draws the **locked page**: the
 * relationship's title, what unlocks the report, and the viewer's own answered count. It does not
 * draw a greyed-out table, a hidden score, a "3 of 5" for the other party, or an empty Aspect
 * list — a report that does not exist cannot leak, and a redacted one still ships the values in
 * the markup.
 *
 * ## Every number is an expression over a row
 *
 * The scores are each party's stored `opinion` rows. The Gaps are `gapKindsOf()` — eight calls of
 * `gapOf()`, one per kind, with the pairs read from `GAP_KIND_SOURCES` — so a row can never label
 * one pair and compute another. The per-Aspect line and the verdict band are
 * `instanceAlignment()`'s own `unmet` list, so the sentence and the table cannot disagree. The
 * Setting is the instance's column and its tolerance is `SETTING_GAP_LIMITS`, carried by the
 * projection as `settingLimit` rather than re-imported here.
 *
 * ## A dash, never a zero
 *
 * An Opinion a party did not give prints `—` in the matrix, and an Aspect with no measurable Gap
 * (no stored pair to subtract) says so and reports no Gap at all — never `0`. Zero is the
 * glossary's *In Synch*: printing it about a question nobody answered would be the report claiming
 * agreement it never measured.
 *
 * No client code: a screen that only reads has no handlers. The words are
 * `data/pages/assessment-relationship-report.ts` (E23, budget 0).
 */
import type { OpinionKind } from "@/content/assessment";
import {
  MODE_LABELS,
  OPINION_DEFINITIONS,
  OPINION_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  opinionKindsFor,
} from "@/content/assessment";
import type { GapSource, GapSourceSide, GapGroup } from "@/content/gaps";
import { GAP_KIND_LABELS, GAP_KIND_SOURCES, gapKindsIn, groupsIn } from "@/content/gaps";
import { MAX_GAP } from "@/content/record";
import { relationshipReportPageCopy } from "@/data/pages/assessment-relationship-report";
import type { AspectReportRow, AssessmentReport, ReportedParty } from "@/lib/assessment-report";
import { answerSheetPath, instancePath } from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The eight pairs by kind, so a group's kinds resolve to their two sides in one lookup. */
const SOURCE_BY_KIND = new Map<GapSource["kind"], GapSource>(
  GAP_KIND_SOURCES.map((source) => [source.kind, source]),
);

const CARD = "rounded-lg border border-border bg-card p-4";
const MUTED = "text-sm text-muted-foreground";
const CHIP = "rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground";
const PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover";
const COLUMN =
  "py-1 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/** One side of a Gap, resolved against the row: who said it, which Opinion, what value. */
interface GapSide {
  readonly name: string;
  readonly opinion: OpinionKind;
  readonly value: number | undefined;
}

function sideOf(row: AspectReportRow, side: GapSourceSide): GapSide {
  const party: ReportedParty = row.left.role === side.party ? row.left : row.right;
  return { name: party.name, opinion: side.opinion, value: party.opinions[side.opinion] };
}

/** One Opinion named and valued: the party, the kind, the number — or a dash, never a zero. */
function SideScore({ side, unscored }: { side: GapSide; unscored: string }) {
  return (
    <span
      className="inline-flex flex-wrap items-baseline gap-1 text-sm"
      data-gap-side={side.opinion}
    >
      <span className="font-medium text-foreground" data-gap-side-party={side.name}>
        {side.name}
      </span>
      <span className="text-muted-foreground">{OPINION_LABELS[side.opinion]}</span>
      <span className="font-semibold tabular-nums text-foreground">
        {side.value === undefined ? unscored : side.value}
      </span>
    </span>
  );
}

/**
 * Both parties' Opinions on one Aspect, as a matrix — one row per party, one column per kind the
 * instance's Mode asks. This is the table a "widest gap" summary throws away: the reader sees who
 * said what before seeing the distance between them.
 */
function OpinionMatrix({
  row,
  mode,
  copy,
}: {
  row: AspectReportRow;
  mode: FlowScreen["mode"];
  copy: typeof relationshipReportPageCopy;
}) {
  const matrix = sectionOf(copy, "matrix");
  const gaps = sectionOf(copy, "gaps");
  const kinds = opinionKindsFor(mode);
  const parties: readonly ReportedParty[] = [row.left, row.right];

  return (
    <table className="mt-3 w-full border-collapse text-sm" data-opinion-matrix="true">
      <caption className="sr-only">{`${row.prompt} — ${matrix.heading ?? ""}`}</caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={COLUMN}>
            {itemLabel(matrix, "party")}
          </th>
          {kinds.map((kind) => (
            <th key={kind} scope="col" className={`${COLUMN} px-2 align-top`}>
              <span className="block">{OPINION_LABELS[kind]}</span>
              <span className="block font-normal normal-case text-muted-foreground">
                {OPINION_DEFINITIONS[kind]}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {parties.map((party) => (
          <tr key={party.role} data-opinion-party={party.role}>
            <th scope="row" className="py-1.5 pr-3 text-left font-medium text-foreground">
              {party.name}
            </th>
            {kinds.map((kind) => {
              const value = party.opinions[kind];
              return (
                <td
                  key={kind}
                  data-opinion-value={value === undefined ? "unscored" : String(value)}
                  className="px-2 py-1.5 tabular-nums text-foreground"
                >
                  {value === undefined ? itemLabel(matrix, "unanswered") : value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One glossary group's rows for one Aspect: the Gap's name, **the two Opinions it compares** (each
 * named by party and value), and the Gap itself — never a bare number.
 */
function GapTable({
  row,
  group,
  copy,
}: {
  row: AspectReportRow;
  group: GapGroup;
  copy: typeof relationshipReportPageCopy;
}) {
  const gapsCopy = sectionOf(copy, "gaps");
  const unscored = itemLabel(gapsCopy, "unscored");
  const entries = group.kinds.flatMap((kind) => {
    const source = SOURCE_BY_KIND.get(kind);
    const gap = row.gaps[kind];
    if (source === undefined || gap === undefined) return [];
    return [{ source, gap }];
  });
  if (entries.length === 0) return null;

  return (
    <div className="mt-4" data-gap-group={group.id}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {group.heading}
      </h3>
      <table className="mt-1 w-full border-collapse">
        <caption className="sr-only">{`${row.prompt} — ${group.heading}`}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={COLUMN}>
              {itemLabel(gapsCopy, "gap")}
            </th>
            <th scope="col" className={COLUMN}>
              {itemLabel(gapsCopy, "pair")}
            </th>
            <th scope="col" className={`${COLUMN} text-right`}>
              {fillLabel(itemLabel(gapsCopy, "value"), { max: MAX_GAP })}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map(({ source, gap }) => (
            <tr key={source.kind} data-gap-kind={source.kind} className="align-middle">
              <th scope="row" className="py-1.5 pr-3 text-left font-medium text-foreground">
                {GAP_KIND_LABELS[source.kind]}
              </th>
              <td className="py-1.5 pr-3">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SideScore side={sideOf(row, source.left)} unscored={unscored} />
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {itemLabel(gapsCopy, "versus")}
                  </span>
                  <SideScore side={sideOf(row, source.right)} unscored={unscored} />
                </span>
              </td>
              <td className="py-1.5 text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <span
                    data-gap-number={gap}
                    className="text-sm font-semibold tabular-nums text-foreground"
                  >
                    {gap}
                  </span>
                  {gap === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {itemLabel(gapsCopy, "in-synch")}
                    </span>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** This Aspect's verdict in words, from the same `unmet` rows the report's band counts. */
function aspectVerdictLine(
  row: AspectReportRow,
  report: AssessmentReport,
  copy: typeof relationshipReportPageCopy,
): string {
  const aspect = sectionOf(copy, "aspect");
  const setting = SETTING_LABELS[report.setting];
  const measured = gapKindsIn(row.gaps).length;
  const unmet = report.verdict.unmet.filter((entry) => entry.itemId === row.itemId).length;
  if (unmet === 0) return fillLabel(itemLabel(aspect, "within"), { setting, count: measured });
  if (unmet === measured) {
    return fillLabel(itemLabel(aspect, "over-all"), { setting, count: unmet });
  }
  return fillLabel(itemLabel(aspect, "over-some"), { setting, count: unmet, measured });
}

/** One Aspect: what is asked, both named ends of the scale, the verdict, the opinions, the Gaps. */
function AspectCard({
  row,
  report,
  mode,
  copy,
}: {
  row: AspectReportRow;
  report: AssessmentReport;
  mode: FlowScreen["mode"];
  copy: typeof relationshipReportPageCopy;
}) {
  const aspect = sectionOf(copy, "aspect");
  const gapsCopy = sectionOf(copy, "gaps");
  const kinds = gapKindsIn(row.gaps);
  const groups = groupsIn(row.gaps);

  // One attribute per Gap this Aspect actually has, in glossary order: an acceptance check reads
  // the numbers off the markup instead of parsing a sentence. A kind with no stored pair is
  // absent, so a Basic Aspect carries four and never a prediction one.
  const gapAttributes: Record<string, string> = Object.fromEntries(
    kinds.flatMap((kind) => {
      const gap = row.gaps[kind];
      return gap === undefined ? [] : [[`data-${kind}-gap`, String(gap)]];
    }),
  );

  return (
    <section data-aspect={row.itemId} {...gapAttributes} className={CARD}>
      <h2 className="text-base font-semibold text-foreground">{row.prompt}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        <span data-aspect-left-value={row.leftValue}>{row.leftValue}</span>
        <span aria-hidden className="mx-1.5">
          —
        </span>
        <span data-aspect-right-value={row.rightValue}>{row.rightValue}</span>
        <span aria-hidden className="mx-1.5" />
        <span className="tabular-nums">
          {fillLabel(itemLabel(aspect, "scale"), { min: row.min, max: row.max })}
        </span>
      </p>

      <p className="mt-2 text-sm text-foreground" data-aspect-verdict-line="true">
        {aspectVerdictLine(row, report, copy)}
      </p>

      <OpinionMatrix row={row} mode={mode} copy={copy} />

      {kinds.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-aspect-unscored="true">
          {itemLabel(gapsCopy, "unscored-aspect")}
        </p>
      ) : (
        groups.map((group) => <GapTable key={group.id} row={row} group={group} copy={copy} />)
      )}
    </section>
  );
}

/** The verdict band: one sentence under the Setting that decides it. */
function VerdictBand({
  report,
  copy,
}: {
  report: AssessmentReport;
  copy: typeof relationshipReportPageCopy;
}) {
  const verdict = sectionOf(copy, "verdict");
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
    ? fillLabel(itemLabel(verdict, "aligned"), values)
    : fillLabel(itemLabel(verdict, unmet === 1 ? "unmet-one" : "unmet-many"), values);

  return (
    <section
      data-verdict={report.verdict.aligned ? "aligned" : "unmet"}
      data-setting={report.setting}
      data-unmet-gaps={unmet}
      className={
        report.verdict.aligned
          ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950"
          : "rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
      }
    >
      <h2 className="font-semibold text-foreground">{verdict.heading}</h2>
      <p className="mt-1 text-base font-semibold text-foreground">{sentence}</p>
      <p className="mt-1 text-sm text-foreground">
        {fillLabel(itemLabel(verdict, "setting"), {
          setting,
          definition: SETTING_DEFINITIONS[report.setting],
        })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {fillLabel(itemLabel(verdict, "tolerance"), values)}
      </p>
    </section>
  );
}

/** The locked page: what the blind rule owes a viewer who has not both submitted. */
function ReportGate({
  screen,
  copy,
}: {
  screen: FlowScreen;
  copy: typeof relationshipReportPageCopy;
}) {
  const back = sectionOf(copy, "back");
  const gate = sectionOf(copy, "gate");
  const answered = screen.aspects.filter((aspect) => aspect.own !== null).length;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <nav aria-label={itemLabel(back, "all")} className="mb-3">
        <a
          className="text-sm font-medium text-action hover:underline"
          href={instancePath(screen.instanceRecordId)}
        >
          {itemLabel(back, "all")}
        </a>
      </nav>

      <section data-report-gated="true" className={CARD}>
        <h1 className="text-xl font-semibold text-foreground">{gate.heading}</h1>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(gate)}</p>
        <p className="mt-3 text-sm text-foreground" data-report-own-progress={answered}>
          {fillLabel(itemLabel(gate, "own-progress"), {
            answered,
            total: screen.aspects.length,
          })}
        </p>
        <p className={`mt-2 ${MUTED}`} data-report-no-leak="true">
          {itemLabel(gate, "no-leak")}
        </p>
        {/*
          The sheet, not the endpoint. `/answers` is the POST-only handler this party's form
          submits to (`lib/flow/paths.ts` keeps the two names side by side for exactly this
          reason), so an anchor pointed there is a GET that answers 405 — the one control the
          locked page offers a party, failing. `answerSheetPath()` is the page that draws their
          unfinished sheet; the form on it does the posting.
        */}
        <a
          className={`mt-4 ${PRIMARY}`}
          href={answerSheetPath(screen.instanceRecordId)}
          data-report-continue="true"
        >
          {itemLabel(gate, "continue")}
        </a>
      </section>
    </div>
  );
}

/**
 * The report, or the page that stands in its place.
 *
 * One exported component so the gate cannot be forgotten: the branch on `screen.report` is the
 * first thing this function does, and there is no path to the tables that does not go through it.
 */
export function RelationshipReport({
  screen,
  copy = relationshipReportPageCopy,
}: {
  screen: FlowScreen;
  copy?: typeof relationshipReportPageCopy;
}) {
  const report = screen.report;
  if (report === null) return <ReportGate screen={screen} copy={copy} />;

  const back = sectionOf(copy, "back");
  const header = sectionOf(copy, "header");
  const setting = SETTING_LABELS[report.setting];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <nav aria-label={itemLabel(back, "all")} className="mb-3">
        <a
          className="text-sm font-medium text-action hover:underline"
          href={instancePath(screen.instanceRecordId)}
        >
          {itemLabel(back, "all")}
        </a>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{report.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <span className={CHIP} data-report-mode={report.mode}>
            {MODE_LABELS[report.mode]}
          </span>
          <span className={CHIP} data-report-setting={report.setting}>
            {fillLabel(itemLabel(header, "setting"), { setting })}
          </span>
          <span className="text-xs text-muted-foreground" data-report-viewer={screen.viewer.role}>
            {fillLabel(itemLabel(header, "viewer"), {
              name:
                screen.viewer.role === "coach" ? itemLabel(header, "coach") : screen.viewer.name,
            })}
          </span>
        </p>
        <p className={`mt-2 ${MUTED}`}>{report.summary}</p>
        <p className="mt-2 text-xs text-muted-foreground">{itemLabel(header, "read-only")}</p>
      </header>

      <VerdictBand report={report} copy={copy} />

      <div className="mt-4 space-y-4">
        {report.rows.map((row) => (
          <AspectCard key={row.itemId} row={row} report={report} mode={screen.mode} copy={copy} />
        ))}
      </div>
    </div>
  );
}

export default RelationshipReport;
