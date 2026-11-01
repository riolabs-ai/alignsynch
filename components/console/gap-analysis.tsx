/**
 * template-ancestor: none — approved #336
 *
 * The Gap across completed relationships — the body of `/admin/gaps` (#289 follow-up).
 *
 * The generic surface is **response analytics**: stat cards, one distribution per measure, a
 * comparison axis. That shell is reusable by any expression — the quiz player's per-question
 * correct rates are the same screen with a different measure — and the only AlignSynch part is
 * what is measured: eight `gapOf` kinds, judged under each relationship's Setting. So the body
 * takes its numbers as props (`GapAggregate`) and knows no rule about what counts.
 *
 * **What it composes** (`docs/UI-DIVERGENCE.md`, one row per divergence):
 *
 *   the title band  `components/ui/page-header.tsx` — `copy.heading` over `copy.subtitle`, the
 *                   primitive thirty files had hand-written before this one called it.
 *   the counts      `components/ui/card.tsx` at `components/console/stat-card-grid.tsx`'s rhythm
 *                   (`grid gap-4 md:grid-cols-2 lg:grid-cols-4`). The grid itself is *not* used:
 *                   its `href` is required and means "the list of exactly these rows", and a
 *                   population count on this screen has no such list — complete / excluded /
 *                   Soft / Full are partitions of the read, not filters over an operator's list.
 *                   `stat-card-grid.tsx` keeps its one job rather than growing a non-linking
 *                   variant for this caller.
 *   the kinds table `components/ui/table.tsx`, as `components/admin/instance-registry.tsx`
 *                   already composes it: the same eight rows, one `<TableRow>` per kind, the
 *                   five column labels still resolved from the fixture.
 *   the failure     `components/ui/alert.tsx` with the `warning` variant — the amber block is the
 *                   eleventh copy in this tree and this is the first caller of the variant.
 *
 * What it is *not* allowed to be, and how each refusal is structural rather than promised:
 *
 *   no names      `GapAggregate` has no field a party name could travel in, and the read that
 *                 builds it selects none. There is nothing to omit here because nothing arrives.
 *   no score      there is no total, no average, no health and no rank. A kind is a count, a
 *                 median and a range; a relationship is aligned or it carries a Gap wider than
 *                 its Setting. The model has no ninth number and this screen does not invent one.
 *   no lying zero a kind with no reading is a row that says why (withheld / no Advanced / no
 *                 both answers). Printing 0 would announce In Synch about a question nobody asked.
 *   no mixing     each Setting is its own section, charted from its own population. Soft
 *                 tolerates a Gap of 1 and Full does not, so an added-up figure would answer no
 *                 question either lens asks.
 *
 * The words all come from `data/pages/admin-gaps.ts` (`E23`: no sentence in a component), the
 * kind names come from `content/gaps.ts` (the glossary's own), and the numbers from the
 * aggregate — so each of the three can only be wrong in its own place.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { GapAggregate, KindRow, SettingReading } from "@/lib/admin/gap-aggregates";
import { itemLabel, sectionBody, sectionOf, fillLabel } from "@/lib/page-copy";
import { GapHistogram } from "@/components/console/gap-histogram";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * A population count: one figure over the words that say what it counts. `Card` at the stat-card
 * grid's rhythm, without the grid's link — see the header comment for why there is no list.
 */
function PopulationCard({ value, label }: { value: number; label: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

/** The five counts of one kind, as the table prints them: "2 / 5 / 9 / 3 / 1". */
function spreadOf(histogram: readonly number[]): string {
  return histogram.join(" / ");
}

/** One kind's row, whether it has a reading or a reason. */
function KindTableRow({
  row,
  reading,
  absence,
  floor,
}: {
  row: KindRow;
  reading: SettingReading;
  absence: PageCopySection;
  floor: number;
}) {
  if (row.reading.state === "unmeasured") {
    const reason = row.reading.reason;
    const sentence =
      reason === "withheld"
        ? fillLabel(itemLabel(absence, "withheld"), { count: reading.instances, floor })
        : reason === "no-advanced"
          ? itemLabel(absence, "no-advanced")
          : itemLabel(absence, "no-answer");
    return (
      <TableRow data-gap-kind={row.kind} data-gap-state="unmeasured">
        <TableHead scope="row" className="text-sm text-foreground">
          {row.label}
        </TableHead>
        <TableCell colSpan={4} className="text-sm text-muted-foreground">
          {sentence}
        </TableCell>
      </TableRow>
    );
  }
  const measured = row.reading;
  return (
    <TableRow data-gap-kind={row.kind} data-gap-state="measured">
      <TableHead scope="row" className="text-sm text-foreground">
        {row.label}
      </TableHead>
      <TableCell className="text-right text-sm tabular-nums">{measured.count}</TableCell>
      <TableCell className="text-right text-sm font-semibold tabular-nums">
        {measured.median}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {`${measured.min}–${measured.max}`}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {spreadOf(measured.histogram)}
      </TableCell>
    </TableRow>
  );
}

/** One Setting's section: its sentence, its chart (when the population carries one) and eight rows. */
function SettingSection({
  reading,
  copy,
  aggregate,
}: {
  reading: SettingReading;
  copy: PageCopy;
  aggregate: GapAggregate;
}) {
  const section = sectionOf(copy, reading.setting === "soft" ? "soft" : "full");
  const kinds = sectionOf(copy, "kinds");
  const absence = sectionOf(copy, "absence");

  const outcome =
    reading.instances === 0
      ? itemLabel(section, "none")
      : reading.aligned === null || reading.unmet === null
        ? fillLabel(itemLabel(section, "withheld"), {
            count: reading.instances,
            floor: aggregate.floor,
          })
        : fillLabel(itemLabel(section, "outcome"), {
            aligned: reading.aligned,
            unmet: reading.unmet,
            instances: reading.instances,
            limit: reading.limit,
          });

  const series = reading.kinds.flatMap((row) =>
    row.reading.state === "measured"
      ? [
          {
            kind: row.kind,
            label: row.label,
            sizes: row.reading.histogram as [number, number, number, number, number],
          },
        ]
      : [],
  );

  return (
    <section data-gap-setting={reading.setting} className="space-y-4">
      <h2 className="text-lg font-semibold">{section.heading}</h2>
      <p className="text-sm text-muted-foreground">
        {fillLabel(sectionBody(section), { limit: reading.limit })}
      </p>
      <p data-gap-outcome={reading.setting} className="text-sm font-medium">
        {outcome}
      </p>

      {reading.chartable ? (
        <figure className="space-y-2">
          <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {itemLabel(section, "chart")}
          </figcaption>
          <GapHistogram series={series} />
        </figure>
      ) : null}

      <Table>
        <TableCaption className="pb-2 text-left text-sm font-semibold">
          {kinds.heading}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-kind")}
            </TableHead>
            <TableHead scope="col" className="text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-gaps")}
            </TableHead>
            <TableHead scope="col" className="text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-median")}
            </TableHead>
            <TableHead scope="col" className="text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-range")}
            </TableHead>
            <TableHead scope="col" className="text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-spread")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reading.kinds.map((row) => (
            <KindTableRow
              key={row.kind}
              row={row}
              reading={reading}
              absence={absence}
              floor={aggregate.floor}
            />
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {/* Each id is a literal at its own `itemLabel` call so E23 can resolve it; one
            relationship is the case a plural noun would get wrong ("1 relationships"). */}
        {fillLabel(
          reading.instances === 1 ? itemLabel(kinds, "count-one") : itemLabel(kinds, "count"),
          { count: reading.gaps, instances: reading.instances },
        )}
      </p>
    </section>
  );
}

/** The screen. */
export function AdminGapsView({ copy, aggregate }: { copy: PageCopy; aggregate: GapAggregate }) {
  const population = sectionOf(copy, "population");
  const statistic = sectionOf(copy, "statistic");

  const card = (id: "complete" | "excluded" | "soft" | "full", count: number) => (
    <PopulationCard value={count} label={itemLabel(population, id)} />
  );

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <PageHeader title={copy.heading} description={copy.subtitle} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{population.heading}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{sectionBody(population)}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {card("complete", aggregate.complete)}
          {card("excluded", aggregate.excluded)}
          {card("soft", aggregate.settings.find((s) => s.setting === "soft")?.instances ?? 0)}
          {card("full", aggregate.settings.find((s) => s.setting === "full")?.instances ?? 0)}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{statistic.heading}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{sectionBody(statistic)}</p>
      </section>

      {aggregate.settings.map((reading) => (
        <SettingSection key={reading.setting} reading={reading} copy={copy} aggregate={aggregate} />
      ))}
    </div>
  );
}

/**
 * The database did not answer — a page, not a digest.
 *
 * Same rule as `components/assessment/assessment-unreadable.tsx`: no partial rows, no "last
 * known" numbers, no spinner. A Gap computed from half a read would be a lie about two people,
 * so the screen says it has nothing and offers the only real action, which is reading again.
 *
 * The panel is `Alert` + the `warning` variant; the heading stays an `<h1>` rather than
 * `AlertTitle`, because this is the whole document and `AlertTitle` renders an `<h5>` — a page
 * whose only heading is level five is a regression a screen reader reads out loud.
 */
export function AdminGapsUnreadable({ copy, reason }: { copy: PageCopy; reason: string }) {
  const section = sectionOf(copy, "unreadable");
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Alert variant="warning" className="p-6" data-gap-unreadable="">
        <h1 className="text-2xl font-bold">{section.heading}</h1>
        <AlertDescription className="mt-2 space-y-2">
          <p>{reason}</p>
          <p>{sectionBody(section)}</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
