"use client";

// template-ancestor: components/assessment-flow/report-view.tsx   (variation: the v2.0 Align surface — a Soft/Full Alignment Tolerance that re-scores in place, a summary that counts the Aspects each tolerance accepts, and one numbered card per Aspect on the locked 1–5 answer scale, where 1.21 drew a table of every Gap kind per Aspect)

/**
 * Stage 6, **Align** — "Where You Agree, and Where You Differ" (#1122).
 *
 * The visual authority is the v2.0 handoff bundle
 * `docs/specs/v2-bundles/04-spec-design-page-align-v2/` (`align.html` + `reference/align-*`),
 * ported rather than redesigned. `docs/specs/flow-stages.md` keeps Align on the relationship's
 * own screen and never in the rail, so this file still replaces the *content* of stage 6 instead
 * of adding a page: `components/assessment-flow/session-view.tsx` draws it in the report state
 * and the route (`/assessment/instances/[instanceId]`) is unchanged.
 *
 * ## What the surface is
 *
 *   tolerance   Soft / Full, re-scoring in place. It is a **lens, not a setting**: the
 *               session's own `setting` seeds the toggle and nothing is written back, exactly
 *               as the prototype's `proto.js` behaves. A per-reader choice would need a column,
 *               and #1122 puts a migration out of scope.
 *   summary     one segment per Aspect in template order, then the legend's three counts. The
 *               counts are Aspects, never Gaps: a composite score is what
 *               `docs/specs/ux-report.md` forbids, and the previous band refused it too.
 *   aspects     one numbered card per Aspect (`01`…) with a Feel row and a Wish row — five equal
 *               cells of `bg-scale-1…5`, the chosen numbers bold and underlined, the parties'
 *               markers above and below, and the Gap drawn as an outline over the cells between
 *               the two answers.
 *
 * ## The one rule the tolerance changes
 *
 * `content/gaps.ts::alignmentStatusOf` decides how a Gap reads under a tolerance, and it is the
 * only place the 1-step case is decided: under Full a Small Gap **keeps its word and its ≈** and
 * takes the Gap's colour ("Small Gap · Not OK under Full"). No status is ever colour alone —
 * every chip, segment and legend entry carries an icon and a word, which is the epic's locked
 * rule (#1119 D-E) and the reason the word survives the colour change.
 *
 * ## The Gap stays a function
 *
 * Every number here is `report.rows[].gaps[kind]`, which `lib/assessment-report.ts` computes from
 * the two `opinion` rows at read time. Nothing is stored and nothing is summed, and a kind one
 * party never answered is absent — that row draws no band rather than a zero, because `0` is the
 * glossary's *In Synch* and printing it about a question nobody asked is the defect the Gap model
 * exists to prevent.
 *
 * ## Two states, and the empty one is a sentence
 *
 * Before both parties have answered and accepted the report is `null` (the blind rule), and this
 * surface draws the waiting sentence instead of a summary: no counts, no zeroed alignment, no
 * empty bars. A screen that filled those in would be the product asserting agreement it never
 * measured — the card's third requirement, and why the old "draw nothing" behaviour is gone.
 *
 * ## Why this is a client component
 *
 * The tolerance and the filter are two pieces of view state that repaint the surface in place.
 * No value import from `lib/flow/**` or `lib/db/**` crosses into this file (`FlowScreen` is a
 * type-only import, erased), so `data:check` E34 — which walks every `"use client"` module's
 * runtime imports — stays green. Every string is `data/pages/assessment-instance.ts`'s
 * `alignment` section (E23, budget 0): the view owns no words.
 */
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flag,
  GitCompare,
  HelpCircle,
  MessageSquare,
  Target,
} from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/ui/badge";
import { OPINION_LABELS, SETTING_LABELS, type AlignmentSetting } from "@/content/assessment";
import { type AlignmentStatus, alignmentStatusOf } from "@/content/gaps";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { Gap, Score } from "@/content/record";
import type { AspectReportRow, AssessmentReport } from "@/lib/assessment-report";
import { relationshipPath } from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The two rows the surface draws. Advanced Mode's Think/Guess rows are #1128's scope. */
const ROWS = ["feel", "wish"] as const;

type RowKind = (typeof ROWS)[number];

/**
 * The locked 1–5 scale, one class per cell.
 *
 * A map rather than `bg-scale-${n}`: Tailwind's scanner reads source text, not runtime values, so
 * an interpolated class produces no rule and every cell would render unpainted. `tests/
 * alignment-view.test.tsx` checks each of the five appears in the rendered markup.
 */
const SCALE_PAINT: Record<Score, string> = {
  1: "bg-scale-1",
  2: "bg-scale-2",
  3: "bg-scale-3",
  4: "bg-scale-4",
  5: "bg-scale-5",
};

/** The filter the toggle group drives. */
type AspectFilter = "all" | "talk" | "aligned";

/**
 * The legend's three entries, in the bundle's order, and the count each one prints.
 *
 * A table rather than three call sites: a `status="in-synch"` written as a JSX attribute is a
 * page-copy literal to E23 (budget 0), and the three statuses are model vocabulary rather than
 * prose. The counts are keyed here so the legend cannot pair a mark with another status's number.
 */
const LEGEND_ORDER: readonly {
  status: AlignmentStatus;
  count: "synch" | "small" | "gap";
}[] = [
  { status: "in-synch", count: "synch" },
  { status: "small-gap-ok", count: "small" },
  { status: "gap", count: "gap" },
];

/**
 * The paint, per status — the bundle's own class strings, one row per status rather than a
 * ternary per element, so a chip, a segment and a band cannot disagree about a colour.
 *
 * `-mark` is the vivid channel (a bar, a ring, a dot) and `DEFAULT` is the ink the word is set
 * in. The small-gap mark is 1.82:1 on white and always travels with its 1 px edge, which is why
 * `small-gap-ok` carries the `outline` pair where the others carry a `ring-offset`.
 */
const STATUS_PAINT: Record<
  AlignmentStatus,
  { chip: string; segment: string; band: string; icon: "check" | "approx" | "flag" }
> = {
  "in-synch": {
    chip: "border-synch-mark bg-synch-tint text-synch",
    segment: "bg-synch-mark text-white",
    band: "ring-2 ring-offset-1 ring-offset-background ring-synch-mark",
    icon: "check",
  },
  "small-gap-ok": {
    chip: "border-small-gap-mark bg-small-gap-tint text-small-gap",
    segment: "bg-small-gap-mark text-foreground ring-1 ring-inset ring-small-gap",
    band: "ring-2 ring-small-gap-mark outline outline-1 outline-offset-2 outline-small-gap",
    icon: "approx",
  },
  "small-gap-tight": {
    chip: "border-gap-mark bg-gap-tint text-gap",
    segment: "bg-gap-mark text-white",
    band: "ring-2 ring-offset-1 ring-offset-background ring-gap-mark",
    icon: "approx",
  },
  gap: {
    chip: "border-gap-mark bg-gap-tint text-gap",
    segment: "bg-gap-mark text-white",
    band: "ring-2 ring-offset-1 ring-offset-background ring-gap-mark",
    icon: "flag",
  },
};

/**
 * The status glyph, 14 px and `aria-hidden` — the word beside it is the accessible fact.
 *
 * The ≈ is two waves, not a font glyph: `lucide` has no "approximately" mark, and a typed "≈"
 * would render at a different weight in every fallback font. The path is the bundle's, so the
 * mark is one shape on the chip, the legend and the segment.
 */
function StatusIcon({ icon }: { icon: "check" | "approx" | "flag" }) {
  if (icon === "check") return <Check className="size-3.5 shrink-0" aria-hidden />;
  if (icon === "flag") return <Flag className="size-3.5 shrink-0" aria-hidden />;
  return (
    <svg
      className="size-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 9.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0" />
      <path d="M5 15.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0" />
    </svg>
  );
}

/** The status word — the label plus, for a 1-step Gap, the tolerance's own qualifier. */
function statusWord(section: PageCopySection, status: AlignmentStatus): string {
  if (status === "in-synch" || status === "gap") {
    return itemLabel(section, status === "gap" ? "chip-gap" : "chip-synch");
  }
  const qualifier = itemLabel(section, status === "small-gap-ok" ? "chip-ok" : "chip-not-ok");
  return `${itemLabel(section, "chip-small")} ${qualifier}`;
}

/** The same word on a summary segment, where the bundle states the qualifier in one string. */
function segmentWord(section: PageCopySection, status: AlignmentStatus): string {
  const id =
    status === "in-synch"
      ? "segment-synch"
      : status === "small-gap-ok"
        ? "segment-small-ok"
        : status === "small-gap-tight"
          ? "segment-small-tight"
          : "segment-gap";
  return itemLabel(section, id);
}

/** The verdict sentence a row's footer carries, from the same status the chip drew. */
function verdictWord(section: PageCopySection, status: AlignmentStatus): string {
  const id =
    status === "in-synch"
      ? "verdict-synch"
      : status === "small-gap-ok"
        ? "verdict-small-ok"
        : status === "small-gap-tight"
          ? "verdict-small-tight"
          : "verdict-gap";
  return itemLabel(section, id);
}

/** One status chip: icon, word, tone. Colour is the third cue, never the first. */
function StatusChip({
  section,
  status,
  scope,
}: {
  section: PageCopySection;
  status: AlignmentStatus;
  scope: "aspect" | "row";
}) {
  return (
    <span
      data-alignment-status={status}
      data-status-chip={scope}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_PAINT[status].chip}`}
    >
      <StatusIcon icon={STATUS_PAINT[status].icon} />
      {statusWord(section, status)}
    </span>
  );
}

/** Where one answer's cell starts on the track, as a percentage. */
function offsetOf(score: Score, row: AspectReportRow): number {
  const cells = row.max - row.min + 1;
  if (cells <= 0) return 0;
  // A cell is `100 / cells` wide, and score `s` owns the cell at index `s - min`. Dividing by the
  // **cell count** (not by `max - min`) is what puts a score of 2 in cell 2 of 5, at 20%.
  return ((score - row.min) / cells) * 100;
}

/** The centre of one scale cell, as a percentage — where a party's marker is pinned. */
function centreOf(score: Score, row: AspectReportRow): number {
  const cells = row.max - row.min + 1;
  return offsetOf(score, row) + 100 / cells / 2;
}

/**
 * One line's answers: the numbered cells, a marker pinned to each chosen cell, and the Gap drawn
 * as an outline over the cells between the two answers.
 *
 * The band outlines *cells*, not a line between points: `left` is the lower answer's cell and
 * `width` counts from it to the higher one inclusive, so a Gap of 1 covers two cells and an In
 * Synch covers the single cell both parties chose. Gap 0, gap 1 and gap ≥2 are drawn by three
 * different rules (`STATUS_PAINT`), and the tolerance selects which of the first two applies.
 */
function AnswerBar({
  row,
  kind,
  left,
  right,
  status,
}: {
  row: AspectReportRow;
  kind: RowKind;
  left: Score;
  right: Score;
  status: AlignmentStatus | null;
}) {
  const cells = row.max - row.min + 1;
  const lower = Math.min(left, right);
  const higher = Math.max(left, right);

  const numbers: Score[] = [];
  for (let score = row.min; score <= row.max; score += 1) numbers.push(score as Score);

  return (
    <span data-scale-track={kind} className="relative mx-1 block h-20" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 grid h-6 -translate-y-1/2 grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
        {numbers.map((number) => (
          <span
            key={number}
            className={`flex items-center justify-center ${SCALE_PAINT[number]} text-xs leading-none text-foreground ${
              number === left || number === right
                ? "font-bold underline decoration-deep-calm decoration-2 underline-offset-2"
                : "font-medium"
            }`}
          >
            {number}
          </span>
        ))}
      </span>
      {status === null ? null : (
        <span
          data-alignment-band={status}
          data-alignment-band-gap={higher - lower}
          className={`absolute top-1/2 h-6 -translate-y-1/2 rounded-md ${STATUS_PAINT[status].band}`}
          style={{
            left: `${offsetOf(lower, row)}%`,
            width: `${((higher - lower + 1) / cells) * 100}%`,
          }}
        />
      )}
      <span
        data-party-marker="initiator"
        className="absolute top-0 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-initiator-solid text-xs font-semibold text-white shadow-sm ring-2 ring-background"
        style={{ left: `${centreOf(left, row)}%` }}
      >
        {row.left.name.slice(0, 1).toUpperCase()}
      </span>
      <span
        data-party-marker="counterparty"
        className="absolute bottom-0 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-counterparty-solid text-xs font-semibold text-white shadow-sm ring-2 ring-background"
        style={{ left: `${centreOf(right, row)}%` }}
      >
        {row.right.name.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

/** One Aspect's line: what it asks, both answers, and how far apart they are. */
function AnswerRow({
  section,
  row,
  kind,
  tolerance,
}: {
  section: PageCopySection;
  row: AspectReportRow;
  kind: RowKind;
  tolerance: AlignmentSetting;
}) {
  const gap: Gap | undefined = row.gaps[kind];
  const left = row.left.opinions[kind];
  const right = row.right.opinions[kind];
  if (left === undefined || right === undefined) return null;

  const status = gap === undefined ? null : alignmentStatusOf(gap, tolerance);

  return (
    <div
      data-alignment-row={kind}
      data-alignment-gap={gap === undefined ? "unscored" : String(gap)}
      className="grid grid-cols-answer-sm items-center gap-x-4 gap-y-1 md:grid-cols-answer"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{OPINION_LABELS[kind]}</p>
        <p className="text-xs text-muted-foreground">
          {itemLabel(section, kind === "feel" ? "row-feel-note" : "row-wish-note")}
        </p>
      </div>
      <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
        <div
          role="img"
          aria-label={fillLabel(itemLabel(section, "row-image"), {
            opinion: OPINION_LABELS[kind],
            initiator: row.left.name,
            initiatorScore: left,
            counterparty: row.right.name,
            counterpartyScore: right,
            max: row.max,
            leftValue: row.leftValue,
            rightValue: row.rightValue,
            steps: gap ?? "",
          })}
        >
          <AnswerBar row={row} kind={kind} left={left} right={right} status={status} />
          <span className="mx-0 mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{row.leftValue}</span>
            <span>{row.rightValue}</span>
          </span>
        </div>
      </div>
      <div className="col-start-2 row-start-1 flex flex-col items-end gap-0.5 md:col-start-auto md:row-start-auto">
        {status === null ? null : <StatusChip section={section} status={status} scope="row" />}
        {gap === undefined || gap === 0 ? null : (
          <span className="text-xs text-muted-foreground">
            {gap === 1
              ? itemLabel(section, "steps-apart-one")
              : fillLabel(itemLabel(section, "steps-apart"), { steps: gap })}
          </span>
        )}
      </div>
    </div>
  );
}

/** One Aspect's card — numbered, chipped, and read in one sentence. */
function AspectCard({
  section,
  row,
  position,
  tolerance,
  status,
  conversationHref,
}: {
  section: PageCopySection;
  row: AspectReportRow;
  position: number;
  tolerance: AlignmentSetting;
  status: AlignmentStatus | null;
  conversationHref: string;
}) {
  const gaps = ROWS.map((kind) => row.gaps[kind]).filter((gap): gap is Gap => gap !== undefined);
  const widest = gaps.length === 0 ? 0 : Math.max(...gaps);

  return (
    <article
      id={`aspect-${row.itemId}`}
      data-alignment-aspect={row.itemId}
      data-alignment-aspect-status={status ?? "unscored"}
      data-alignment-worst={widest}
      className="scroll-mt-24 rounded-lg border border-border bg-card"
    >
      <header className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-mist text-sm font-semibold text-primary">
            {String(position + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{row.prompt}</h3>
          </div>
        </div>
        {status === null ? null : (
          <span className="shrink-0 pl-11 sm:pl-0">
            <StatusChip section={section} status={status} scope="aspect" />
          </span>
        )}
      </header>

      <div className="space-y-3 px-4">
        {ROWS.map((kind, index) => (
          <div key={kind}>
            {index === 0 ? null : <div className="border-t border-dashed" />}
            <AnswerRow section={section} row={row} kind={kind} tolerance={tolerance} />
          </div>
        ))}
      </div>

      <footer className="mt-4 flex flex-col gap-3 rounded-b-lg border-t bg-mist px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-foreground">
          <span className="font-semibold">{itemLabel(section, "reading")}</span>{" "}
          {fillLabel(itemLabel(section, widest === 0 ? "reading-aligned" : "reading-apart"), {
            initiator: row.left.name,
            counterparty: row.right.name,
            steps: widest,
          })}{" "}
          {status === null ? null : (
            <span data-alignment-verdict={status} className="text-muted-foreground">
              {verdictWord(section, status)}
            </span>
          )}
        </p>
        <a
          href={conversationHref}
          data-alignment-discuss={row.itemId}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
        >
          <MessageSquare className="size-4 shrink-0" aria-hidden />
          {itemLabel(section, "discuss")}
        </a>
      </footer>
    </article>
  );
}

/** The summary's one segment: an Aspect's status, as a bar with its icon and its word. */
function SummarySegment({
  section,
  row,
  status,
}: {
  section: PageCopySection;
  row: AspectReportRow;
  status: AlignmentStatus;
}) {
  const word = segmentWord(section, status);
  return (
    <a
      href={`#aspect-${row.itemId}`}
      data-alignment-segment={status}
      aria-label={`${row.prompt}: ${word}`}
      className="group flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex-1 md:flex-col md:items-stretch md:gap-1.5"
    >
      <span
        className={`flex h-8 w-14 shrink-0 items-center justify-center rounded-md transition-opacity group-hover:opacity-90 md:w-auto ${STATUS_PAINT[status].segment}`}
      >
        <StatusIcon icon={STATUS_PAINT[status].icon} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-foreground group-hover:underline">
          {row.prompt}
        </span>
        <span className="block text-xs text-muted-foreground">{word}</span>
      </span>
    </a>
  );
}

/** One legend entry: a vivid mark, the count, and the word. */
function LegendEntry({
  section,
  status,
  count,
}: {
  section: PageCopySection;
  status: AlignmentStatus;
  count: number;
}) {
  const id =
    status === "in-synch" ? "legend-synch" : status === "gap" ? "legend-gap" : "legend-small";
  return (
    <div className="flex items-center gap-2" data-alignment-legend={status}>
      <span
        className={`flex size-8 items-center justify-center rounded-full ${STATUS_PAINT[status].segment}`}
      >
        <StatusIcon icon={STATUS_PAINT[status].icon} />
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-foreground" data-alignment-count={count}>
          {count}
        </p>
        <p className="text-xs text-muted-foreground">{itemLabel(section, id)}</p>
      </div>
    </div>
  );
}

/** The waiting state: a sentence, and deliberately no numbers. */
function WaitingState({
  section,
  otherName,
  names,
}: {
  section: PageCopySection;
  otherName: string;
  names: string;
}) {
  return (
    <div data-alignment-waiting="true" className="mt-6">
      <section className="rounded-lg border border-status-line bg-status p-5">
        <h3 className="text-lg font-semibold text-primary">
          {fillLabel(itemLabel(section, "waiting-heading"), { other: otherName })}
        </h3>
        <p className="mt-2 text-sm text-foreground">{itemLabel(section, "waiting-body")}</p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {fillLabel(itemLabel(section, "waiting-note"), { names })}
        </p>
      </section>
    </div>
  );
}

/**
 * The Align surface. `report === null` is the waiting state — never a zeroed one.
 *
 * `screen.waiting` names the seats still to answer, so the sentence says who it is waiting on
 * rather than "someone"; both names come from the screen's own fields, never from the report,
 * which does not exist in this state.
 */
export function AlignmentView({ screen, copy }: { screen: FlowScreen; copy: PageCopy }) {
  const section = sectionOf(copy, "alignment");
  const report: AssessmentReport | null = screen.report;

  const [tolerance, setTolerance] = useState<AlignmentSetting>(report?.setting ?? screen.setting);
  const [filter, setFilter] = useState<AspectFilter>("all");

  const pending = screen.waiting.map((role) =>
    role === "initiator" ? screen.initiatorName : (screen.counterpartyName ?? ""),
  );

  if (report === null) {
    return (
      <section data-alignment="waiting" className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep-calm">
            <GitCompare className="size-4 shrink-0" aria-hidden />
            {itemLabel(section, "eyebrow")}
          </p>
          <Chip variant="tint">{itemLabel(section, "live-badge")}</Chip>
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-primary">{section.heading}</h2>
        <p className="text-base text-foreground">{sectionBody(section)}</p>
        <WaitingState section={section} otherName={pending[0] ?? ""} names={pending.join(", ")} />
      </section>
    );
  }

  /*
   * One verdict per Aspect over the two rows the surface draws — Feel and Wish, the cross-party
   * pairs. Advanced Mode's prediction kinds are #1128's scope and the bundle draws no row for
   * them, so a chip here never counts a Gap the reader cannot see.
   */
  const aspects = report.rows.map((row) => {
    const gaps = ROWS.map((kind) => row.gaps[kind]).filter((gap): gap is Gap => gap !== undefined);
    if (gaps.length === 0) {
      return { row, status: null as AlignmentStatus | null, worst: 0, talk: false };
    }
    // `Math.max` over Gaps is a Gap (0..4); the widen-to-`number` is narrowed here rather than at
    // the call site, so `alignmentStatusOf` keeps its total signature.
    const worst = Math.max(...gaps) as Gap;
    const status = alignmentStatusOf(worst, tolerance);
    return { row, status, worst, talk: status === "gap" || status === "small-gap-tight" };
  });

  const talk = aspects.filter((entry) => entry.talk);
  const aligned = aspects.filter((entry) => !entry.talk);
  const oneStep = aspects.filter((entry) => entry.worst === 1).length;
  const counts = {
    synch: aspects.filter((entry) => entry.worst === 0).length,
    small: aspects.filter((entry) => entry.worst === 1).length,
    gap: aspects.filter((entry) => entry.worst >= 2).length,
  };

  const conversationHref = relationshipPath(screen.relationshipId);
  const widest = talk.reduce<{ row: AspectReportRow; worst: number } | null>((best, entry) => {
    if (best === null || entry.worst > best.worst) return { row: entry.row, worst: entry.worst };
    return best;
  }, null);

  const visible =
    filter === "all"
      ? aspects
      : filter === "talk"
        ? aspects.filter((entry) => entry.talk)
        : aspects.filter((entry) => !entry.talk);

  return (
    <section data-alignment="true" data-alignment-tolerance={tolerance} className="mb-6">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex h-1" aria-hidden>
          <span className="flex-1 bg-action" />
          <span className="w-1/4 bg-deep-calm/60" />
          <span className="w-1/6 bg-accent/50" />
        </div>

        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep-calm">
                <GitCompare className="size-4 shrink-0" aria-hidden />
                {itemLabel(section, "eyebrow")}
              </p>
              <Chip variant="tint">{itemLabel(section, "live-badge")}</Chip>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-primary">{section.heading}</h2>
            <p className="text-base text-foreground">{sectionBody(section)}</p>
          </div>

          <fieldset className="shrink-0 space-y-1.5">
            <legend className="text-xs font-semibold text-muted-foreground">
              {itemLabel(section, "tolerance-label")}
            </legend>
            <div className="inline-flex h-9 items-center rounded-md bg-muted p-0.5 text-muted-foreground">
              {(["soft", "full"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  data-alignment-tolerance-option={option}
                  aria-pressed={tolerance === option}
                  onClick={() => setTolerance(option)}
                  className={`inline-flex h-8 items-center rounded-sm px-3 text-xs font-semibold transition-all ${
                    tolerance === option
                      ? "bg-background text-foreground shadow-sm"
                      : "hover:text-foreground"
                  }`}
                >
                  {SETTING_LABELS[option]}
                </button>
              ))}
            </div>
            <p className="max-w-56 text-xs text-muted-foreground" data-alignment-tolerance-note>
              {itemLabel(
                section,
                tolerance === "soft" ? "tolerance-note-soft" : "tolerance-note-full",
              )}
            </p>
          </fieldset>
        </div>

        {/* The summary band: what the tolerance accepts, how many, and where to start. */}
        <div className="grid grid-cols-1 gap-6 border-t border-status-line bg-status p-5 lg:grid-cols-3 lg:p-6">
          <div className="space-y-4 lg:col-span-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep-calm">
              <span className="flex size-7 items-center justify-center rounded-md bg-status-chip">
                <Target className="size-4 shrink-0" aria-hidden />
              </span>
              {itemLabel(section, "summary")}
            </p>
            <div>
              <p
                data-alignment-summary-aligned={aligned.length}
                data-alignment-summary-total={aspects.length}
                className="text-3xl font-bold tracking-tight text-primary"
              >
                {fillLabel(itemLabel(section, "summary-count"), {
                  aligned: aligned.length,
                  total: aspects.length,
                })}{" "}
                <span className="text-base font-medium text-muted-foreground">
                  {itemLabel(section, "summary-count-unit")}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground" data-alignment-headline>
                {fillLabel(
                  itemLabel(section, tolerance === "soft" ? "headline-soft" : "headline-full"),
                  { talk: talk.length, total: aspects.length, oneStep },
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:gap-2">
              {aspects.map((entry) =>
                entry.status === null ? null : (
                  <SummarySegment
                    key={entry.row.itemId}
                    section={section}
                    row={entry.row}
                    status={entry.status}
                  />
                ),
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {LEGEND_ORDER.map((entry) => (
                <LegendEntry
                  key={entry.status}
                  section={section}
                  status={entry.status}
                  count={counts[entry.count]}
                />
              ))}
            </div>
          </div>

          {/* The one action: the widest Gap, and the conversation it starts. */}
          <div className="rounded-lg bg-action p-4 text-action-foreground" data-alignment-next-step>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-action-foreground/80">
              <ArrowRight className="size-4 shrink-0" aria-hidden />
              {itemLabel(section, "next-step")}
            </p>
            <h3 className="mt-1 text-base font-semibold">
              {widest === null ? itemLabel(section, "aspect-list-heading") : widest.row.prompt}
            </h3>
            <p className="mt-1 text-sm text-action-foreground/90">
              {widest === null
                ? fillLabel(itemLabel(section, "next-step-body-aligned"), {
                    tolerance: SETTING_LABELS[tolerance],
                  })
                : fillLabel(
                    itemLabel(
                      section,
                      widest.worst === 1 ? "next-step-body-one" : "next-step-body",
                    ),
                    { aspect: widest.row.prompt, steps: widest.worst },
                  )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={conversationHref}
                data-alignment-start-conversation="true"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-mist lg:h-9"
              >
                <MessageSquare className="size-4 shrink-0" aria-hidden />
                {itemLabel(section, "start-conversation")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-primary">
            {itemLabel(section, "aspect-list-heading")}
          </h2>
        </div>

        <details className="group rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <HelpCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {itemLabel(section, "how-to-read")}
            </span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="grid gap-4 border-t px-4 py-4 text-sm md:grid-cols-3">
            <p>
              <span className="font-semibold text-foreground">
                {itemLabel(section, "read-opinions")}
              </span>{" "}
              <span className="text-muted-foreground">
                {itemLabel(section, "read-opinions-body")}
              </span>
            </p>
            <p>
              <span className="font-semibold text-foreground">
                {itemLabel(section, "read-markers")}
              </span>{" "}
              <span className="text-muted-foreground">
                {fillLabel(itemLabel(section, "read-markers-body"), {
                  initiator: screen.initiatorName,
                  counterparty: screen.counterpartyName ?? "",
                })}
              </span>
            </p>
            <p>
              <span className="font-semibold text-foreground">
                {itemLabel(section, "read-status")}
              </span>{" "}
              <span className="text-muted-foreground">
                {itemLabel(section, "read-status-body")}
              </span>
            </p>
          </div>
        </details>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <fieldset className="inline-flex h-9 items-center rounded-md bg-muted p-0.5 text-muted-foreground">
            <legend className="sr-only">{itemLabel(section, "filter-label")}</legend>
            {(
              [
                ["all", itemLabel(section, "filter-all")],
                ["talk", itemLabel(section, "filter-talk")],
                ["aligned", itemLabel(section, "filter-aligned")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-alignment-filter={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-medium transition-all ${
                  filter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground"
                }`}
              >
                {fillLabel(label, {
                  total: aspects.length,
                  talk: talk.length,
                  aligned: aligned.length,
                })}
              </button>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-initiator-solid text-xs font-semibold text-white">
                {screen.initiatorName.slice(0, 1).toUpperCase()}
              </span>
              {fillLabel(itemLabel(section, "party-initiator"), { name: screen.initiatorName })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-counterparty-solid text-xs font-semibold text-white">
                {(screen.counterpartyName ?? "").slice(0, 1).toUpperCase()}
              </span>
              {fillLabel(itemLabel(section, "party-counterparty"), {
                name: screen.counterpartyName ?? "",
              })}
            </span>
          </div>
        </div>

        <div className="space-y-4" data-alignment-aspect-list={filter}>
          {visible.map((entry) => (
            <AspectCard
              key={entry.row.itemId}
              section={section}
              row={entry.row}
              position={aspects.findIndex((candidate) => candidate.row.itemId === entry.row.itemId)}
              tolerance={tolerance}
              status={entry.status}
              conversationHref={conversationHref}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default AlignmentView;
