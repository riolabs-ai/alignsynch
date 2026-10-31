/**
 * The Gap across completed relationships — the body of `/admin/gaps` (#289 follow-up).
 *
 * The generic surface is **response analytics**: stat cards, one distribution per measure, a
 * comparison axis. That shell is reusable by any expression — the quiz player's per-question
 * correct rates are the same screen with a different measure — and the only AlignSynch part is
 * what is measured: eight `gapOf` kinds, judged under each relationship's Setting. So the body
 * takes its numbers as props (`GapAggregate`) and knows no rule about what counts.
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

/** A stat card: the number over the words that say what it counts. */
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums text-card-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
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
      <tr data-gap-kind={row.kind} data-gap-state="unmeasured">
        <th scope="row" className="py-2 pr-3 text-left text-sm font-medium">
          {row.label}
        </th>
        <td colSpan={4} className="py-2 text-sm text-muted-foreground">
          {sentence}
        </td>
      </tr>
    );
  }
  const measured = row.reading;
  return (
    <tr data-gap-kind={row.kind} data-gap-state="measured">
      <th scope="row" className="py-2 pr-3 text-left text-sm font-medium">
        {row.label}
      </th>
      <td className="py-2 pr-3 text-right text-sm tabular-nums">{measured.count}</td>
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums">{measured.median}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums">
        {`${measured.min}–${measured.max}`}
      </td>
      <td className="py-2 text-right font-mono text-xs text-muted-foreground">
        {spreadOf(measured.histogram)}
      </td>
    </tr>
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

      <table className="w-full border-t">
        <caption className="pb-2 text-left text-sm font-semibold">{kinds.heading}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-1 pr-3 text-left text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-kind")}
            </th>
            <th scope="col" className="py-1 pr-3 text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-gaps")}
            </th>
            <th scope="col" className="py-1 pr-3 text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-median")}
            </th>
            <th scope="col" className="py-1 pr-3 text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-range")}
            </th>
            <th scope="col" className="py-1 text-right text-xs font-semibold uppercase">
              {itemLabel(kinds, "column-spread")}
            </th>
          </tr>
        </thead>
        <tbody>
          {reading.kinds.map((row) => (
            <KindTableRow
              key={row.kind}
              row={row}
              reading={reading}
              absence={absence}
              floor={aggregate.floor}
            />
          ))}
        </tbody>
      </table>
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
    <StatCard value={count} label={itemLabel(population, id)} />
  );

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

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
 */
export function AdminGapsUnreadable({ copy, reason }: { copy: PageCopy; reason: string }) {
  const section = sectionOf(copy, "unreadable");
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div
        data-gap-unreadable=""
        role="alert"
        className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
      >
        <h1 className="text-2xl font-bold">{section.heading}</h1>
        <p className="mt-2 text-sm">{reason}</p>
        <p className="mt-3 text-sm">{sectionBody(section)}</p>
      </div>
    </div>
  );
}
