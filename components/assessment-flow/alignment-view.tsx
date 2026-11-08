/**
 * template-ancestor: components/assessment-flow/report-view.tsx   (variation: stage 6 — the Alignment reached from the relationship itself rather than from a report route, with one row per Aspect carrying both sheets and their difference, where the report draws the eight Gaps group by group)
 *
 * #692 — **Alignment is dashboard functionality, not a stage.** Stage 6 is Ongoing: the live
 * relationship, whose screen is `/assessment/instances/[instanceId]` and whose status is one
 * sentence (`docs/specs/ux-stages.md`). This component is the *content* of that state — what the
 * relationship actually says — and it is deliberately not a seventh screen in the flow: no rail,
 * no stage number, no "finish". A couple reaches it from Sent (#691) by opening the relationship,
 * and it stays where it is for as long as the relationship does.
 *
 * ## The unit is the Aspect, and there are three facts per row
 *
 *   1. **both sheets** — each party's own answers, named by party and by Opinion kind, in two
 *      columns. Not a summary of them: the value each seat chose, or a dash when that seat gave
 *      none.
 *   2. **the difference** — every Gap the Aspect actually has, as a row that prints **the two
 *      Opinions it subtracts** (`content/gaps.ts`'s `GAP_KIND_SOURCES`) beside the number, so a
 *      reader cannot be handed a 3 with no way to see what was subtracted. A Basic instance is
 *      asked for four Opinions and carries four kinds; a prediction kind is absent, never a
 *      printed 0 (`gapKindsIn`).
 *   3. **this Aspect's verdict** — whether every Gap on it meets the Setting, from
 *      `gapMeetsSetting()`. That is the artifact's per-row chip (`docs/review/artifacts/
 *      prototype-relationship-lifecycle-v5.html`, `s10.*`), and it is a derived word, never a
 *      fifth score.
 *
 * ## Everything is an expression over a row, and the Gap stays a function
 *
 * There is no `gap` column, table, view or generated column anywhere in this tree, and this
 * component could not read one if there were: it is handed `FlowScreen.report`, a projection
 * `lib/assessment-report.ts::assessmentReport()` builds from the two parties' `opinion` rows at
 * read time, and every number below is that projection's `rows[].gaps[kind]`. The relationship's
 * verdict (`report.verdict`) is `instanceAlignment()`'s own `unmet` list, so this band and every
 * Aspect row count the same Gaps — they cannot disagree, because there is one list.
 *
 * ## No total, and no metric
 *
 * The artifact's card foot prints a "Total Gap". This does not, and the omission is the spec's:
 * `docs/specs/ux-report.md` names a total, an average or a composite "alignment score" as things
 * the product **does not show**, and its acceptance is a grep (`total gap|average gap|overall
 * score|compatibility` must return nothing). A sum over four Opinion kinds is not a fact about a
 * couple, so the band states how many Gaps are over the line and stops there.
 *
 * ## A dash, never a zero
 *
 * A seat that gave no Opinion on a kind prints `—` in its sheet, and an Aspect with nothing to
 * subtract says so rather than reporting a Gap: `0` is the glossary's *In Synch*, and printing it
 * about a question nobody answered would be the product claiming agreement it never measured.
 *
 * No client code: a screen that only reads has no handlers. The words are
 * `data/pages/assessment-instance.ts`'s `alignment` section (E23, budget 0); the glossary's own
 * vocabulary — `Aligned`, the four Opinion names, the eight Gap names, `Soft`/`Full` — is
 * `content/`'s, exactly as `report-view.tsx` carries "Aspect" and "Gap".
 */
import type { PageCopy } from "@/content/pages";
import type { OpinionKind } from "@/content/assessment";
import { OPINION_LABELS, SETTING_LABELS, opinionKindsFor } from "@/content/assessment";
import type { GapSource } from "@/content/gaps";
import { GAP_KIND_LABELS, GAP_KIND_SOURCES, gapKindsIn, gapMeetsSetting } from "@/content/gaps";
import { STAGE_LABELS } from "@/content/stages";
import type { AspectReportRow, AssessmentReport, ReportedParty } from "@/lib/assessment-report";
import { reportPath } from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The eight pairs by kind, so a row's Gap resolves to the two Opinions it subtracts. */
const SOURCE_BY_KIND = new Map<GapSource["kind"], GapSource>(
  GAP_KIND_SOURCES.map((source) => [source.kind, source]),
);

/** The one glyph an absent answer is drawn as — never `0`, never an empty cell. */
const ABSENT = "—";

const CARD = "rounded-lg border border-border bg-card p-4";
const MUTED = "text-sm text-muted-foreground";
const CHIP = "rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground";
const LINK = "text-sm font-medium text-action hover:underline";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const COLUMN =
  "py-1 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/** One Opinion named and valued: the party, the kind, the number — or a dash, never a zero. */
function SideScore({
  name,
  opinion,
  value,
  unscored,
}: {
  name: string;
  opinion: OpinionKind;
  value: number | undefined;
  unscored: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1" data-alignment-side={opinion}>
      <span className="font-medium text-foreground">{name}</span>
      <span className="text-muted-foreground">{OPINION_LABELS[opinion]}</span>
      <span className="font-semibold tabular-nums text-foreground">
        {value === undefined ? unscored : value}
      </span>
    </span>
  );
}

/** One party's own answers on one Aspect: the seat, then the value it gave for each kind. */
function Sheet({
  party,
  kinds,
  unscored,
}: {
  party: ReportedParty;
  kinds: readonly OpinionKind[];
  unscored: string;
}) {
  return (
    <div
      data-alignment-sheet={party.role}
      className="rounded-md border border-border bg-background p-2.5"
    >
      <p className="text-sm font-medium text-foreground" data-alignment-sheet-party={party.name}>
        {party.name}
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {kinds.map((kind) => {
          const value = party.opinions[kind];
          return (
            <li
              key={kind}
              data-alignment-opinion={kind}
              data-alignment-value={value === undefined ? "unscored" : String(value)}
              className="inline-flex items-baseline gap-1 text-sm"
            >
              <span className="text-muted-foreground">{OPINION_LABELS[kind]}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {value === undefined ? unscored : value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One Gap of an Aspect: its name, the two Opinions it subtracts, and the difference. */
function DifferenceRow({
  row,
  kind,
  inSynch,
  unscored,
}: {
  row: AspectReportRow;
  kind: GapSource["kind"];
  inSynch: string;
  unscored: string;
}) {
  const source = SOURCE_BY_KIND.get(kind);
  const gap = row.gaps[kind];
  if (source === undefined || gap === undefined) return null;

  const partyOf = (role: ReportedParty["role"]): ReportedParty =>
    row.left.role === role ? row.left : row.right;
  const leftParty = partyOf(source.left.party);
  const rightParty = partyOf(source.right.party);

  return (
    <tr data-alignment-gap-kind={kind} className="align-middle">
      <th scope="row" className="py-1.5 pr-3 text-left text-sm font-medium text-foreground">
        {GAP_KIND_LABELS[kind]}
      </th>
      <td className="py-1.5 pr-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SideScore
            name={leftParty.name}
            opinion={source.left.opinion}
            value={leftParty.opinions[source.left.opinion]}
            unscored={unscored}
          />
          <span aria-hidden className="text-xs text-muted-foreground">
            {ABSENT}
          </span>
          <SideScore
            name={rightParty.name}
            opinion={source.right.opinion}
            value={rightParty.opinions[source.right.opinion]}
            unscored={unscored}
          />
        </span>
      </td>
      <td className="py-1.5 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          <span
            data-alignment-gap={gap}
            className="text-sm font-semibold tabular-nums text-foreground"
          >
            {gap}
          </span>
          {gap === 0 ? <span className="text-xs text-muted-foreground">{inSynch}</span> : null}
        </span>
      </td>
    </tr>
  );
}

/** One Aspect: what is asked, both sheets, this Aspect's verdict, and every difference. */
function AspectAlignment({
  row,
  report,
  copy,
}: {
  row: AspectReportRow;
  report: AssessmentReport;
  copy: PageCopy;
}) {
  const alignment = sectionOf(copy, "alignment");
  const setting = SETTING_LABELS[report.setting];
  const kinds = opinionKindsFor(report.mode);
  const gaps = gapKindsIn(row.gaps);
  const unscored = itemLabel(alignment, "unscored");
  const over = gaps.filter((kind) => {
    const gap = row.gaps[kind];
    return gap !== undefined && !gapMeetsSetting(gap, report.setting);
  }).length;

  return (
    <section
      data-alignment-aspect={row.itemId}
      data-alignment-unmet={over}
      data-alignment-gaps={gaps.length}
      className={CARD}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{row.prompt}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span data-alignment-left-value={row.leftValue}>{row.leftValue}</span>
            <span aria-hidden className="mx-1.5">
              {ABSENT}
            </span>
            <span data-alignment-right-value={row.rightValue}>{row.rightValue}</span>
            <span aria-hidden className="mx-1.5" />
            <span className="tabular-nums">
              {fillLabel(itemLabel(alignment, "scale"), { min: row.min, max: row.max })}
            </span>
          </p>
        </div>
        {gaps.length === 0 ? null : (
          <span
            data-alignment-aspect-verdict={over === 0 ? "aligned" : "unmet"}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              over === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {over === 0
              ? STAGE_LABELS.aligned
              : fillLabel(itemLabel(alignment, "over"), { count: over, setting })}
          </span>
        )}
      </div>

      <p className={`mt-3 ${LABEL}`}>{itemLabel(alignment, "sheets")}</p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        <Sheet party={row.left} kinds={kinds} unscored={unscored} />
        <Sheet party={row.right} kinds={kinds} unscored={unscored} />
      </div>

      {gaps.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-alignment-unscored="true">
          {itemLabel(alignment, "no-gap")}
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse" data-alignment-differences="true">
          <caption className="sr-only">
            {`${row.prompt} — ${itemLabel(alignment, "difference")}`}
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={COLUMN}>
                {itemLabel(alignment, "gap")}
              </th>
              <th scope="col" className={COLUMN}>
                {itemLabel(alignment, "sheets")}
              </th>
              <th scope="col" className={`${COLUMN} text-right`}>
                {itemLabel(alignment, "difference")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {gaps.map((kind) => (
              <DifferenceRow
                key={kind}
                row={row}
                kind={kind}
                inSynch={itemLabel(alignment, "in-synch")}
                unscored={unscored}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * The Alignment, Aspect by Aspect — stage 6's content on the relationship screen.
 *
 * Draws nothing when `screen.report` is `null`: the blind rule means there is no partial version of
 * this band, and the screen that mounts it branches on the same field (a caller that forgot would
 * get an empty band rather than the other party's answers).
 */
export function AlignmentView({ screen, copy }: { screen: FlowScreen; copy: PageCopy }) {
  const report = screen.report;
  if (report === null) return null;

  const alignment = sectionOf(copy, "alignment");
  const setting = SETTING_LABELS[report.setting];
  const measured = report.rows.reduce((total, row) => total + gapKindsIn(row.gaps).length, 0);
  const unmet = report.verdict.unmet.length;
  const verdict = fillLabel(
    itemLabel(alignment, unmet === 0 ? "verdict-aligned" : "verdict-unmet"),
    { setting, count: unmet, measured },
  );

  return (
    <section data-alignment="true" className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-foreground">{alignment.heading}</h2>
        <span className={CHIP} data-alignment-scope="dashboard">
          {itemLabel(alignment, "scope")}
        </span>
      </div>
      <p className={`mt-1 ${MUTED}`}>{sectionBody(alignment)}</p>
      <p
        data-alignment-verdict={report.verdict.aligned ? "aligned" : "unmet"}
        data-alignment-unmet-gaps={unmet}
        data-alignment-measured-gaps={measured}
        className="mt-2 text-sm font-medium text-foreground"
      >
        {verdict}
      </p>

      <div className="mt-4 space-y-3">
        {report.rows.map((row) => (
          <AspectAlignment key={row.itemId} row={row} report={report} copy={copy} />
        ))}
      </div>

      <p className="mt-4">
        <a className={LINK} href={reportPath(screen.instanceRecordId)} data-alignment-report="true">
          {itemLabel(alignment, "report-link")}
        </a>
      </p>
    </section>
  );
}

export default AlignmentView;
