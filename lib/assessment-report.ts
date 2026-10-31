/**
 * The assessment report — the one projection `/assessment/[slug]` renders.
 *
 * The screen is a read of two records and two functions:
 *
 *   the instance  holds the copy of the Aspects and both parties' Opinions;
 *   the template  holds the title and summary the reader sees above them;
 *   `gapOf()`     is the one subtraction (`content/record.ts`);
 *   `gapKindsOf()` is which two Opinions each of the eight glossary Gaps subtracts
 *                 (`content/gaps.ts`) — this module does not re-derive a pair inline.
 *
 * There is no `gap` field to read, and this module does not add one: every number in a
 * row is computed here from the pair of Opinions beside it, so a rendered Gap cannot
 * disagree with the two scores it sits between. That is the whole reason the projection
 * is a function and not a fixture — a stored Gap would be a second authored value that
 * no schema could compare against the first.
 *
 * Pure, and free of React and Next: the view model is testable in a node environment,
 * and `components/assessment/assessment-report.tsx` is the only thing that draws it.
 */
import type {
  AlignmentSetting,
  Assessment,
  AssessmentInstance,
  AssessmentMode,
  AspectOpinions,
  Opinions,
  Party,
  PartyRole,
} from "@/content/assessment";
import {
  gapKindsIn,
  gapKindsOf,
  instanceAlignment,
  type AlignmentVerdict,
  type GapKind,
  type GapKinds,
} from "@/content/gaps";
import type { Gap, Score } from "@/content/record";

/** One party's answers on one Aspect, narrowed to the four opinion kinds. */
export interface ReportedOpinions {
  readonly feel: Score;
  readonly wish: Score;
  readonly think?: Score;
  readonly guess?: Score;
}

/** A party as the row names them: the fixture's own name, and their answers. */
export interface ReportedParty {
  readonly role: PartyRole;
  readonly name: string;
  readonly opinions: ReportedOpinions;
}

/**
 * The Gaps of one Aspect, keyed by kind: `content/gaps.ts` computes all eight, so the
 * four Basic kinds are always numbers and the four prediction kinds are there exactly
 * when the instance was played in Advanced Mode.
 */
export type ReportedGaps = GapKinds;

/** One Aspect, as a row: what is asked, the two ends of the scale, both parties, the Gaps. */
export interface AspectReportRow {
  /** The Aspect's id — the join key between the instance's items and each party's answers. */
  readonly itemId: string;
  readonly prompt: string;
  /** Notch 1 of the 1..5 band. */
  readonly leftValue: string;
  /** Notch 5 of the 1..5 band. */
  readonly rightValue: string;
  readonly min: Score;
  readonly max: Score;
  /** The Initiator: the left-hand answers. */
  readonly left: ReportedParty;
  /** The Counterparty: the right-hand answers. */
  readonly right: ReportedParty;
  readonly gaps: ReportedGaps;
}

/**
 * The widest Gap the Setting does not tolerate, named by the Aspect it sits on — what the
 * verdict band's second sentence needs ("the widest is a Gap of 4 on …").
 *
 * Ties are broken by the glossary order (`GAP_KINDS`), then by the instance's own Aspect
 * order, so the same frozen numbers always name the same Gap: the report is read by two
 * people from two devices, and a "widest" that moved between reads would be a different
 * sentence about the same data.
 */
export interface WidestGap {
  readonly itemId: string;
  readonly prompt: string;
  readonly kind: GapKind;
  readonly gap: Gap;
}

/** The instance, ready to draw: the template's words, the parties' names, one row per Aspect. */
export interface AssessmentReport {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /**
   * The mode the instance was played in. Copied from `instance.mode`, so a report **knows**
   * which sheet it is drawing and can say so — the next card's eight gap kinds read this
   * before drawing any cross-party comparison, and a Basic report has no Think/Guess rows
   * to draw because the schema never let them exist.
   */
  readonly mode: AssessmentMode;
  /**
   * The Setting the instance is read under, and the widest Gap it tolerates.
   *
   * `settingLimit` is carried rather than re-imported by the view, because
   * `content/gaps.ts::gapMeetsSetting` is the one comparison in the codebase that reads the
   * threshold: a bar with its tolerance tick drawn from a second copy of the table could
   * disagree with the verdict about the same numbers.
   */
  readonly setting: AlignmentSetting;
  readonly settingLimit: Gap;
  /**
   * The verdict — `instanceAlignment()` over exactly the Gaps above, so the band and the
   * rows cannot say different things. Derived on every projection, never stored and never
   * an argument: "aligned" is arithmetic over the finished Gap, not a state a caller sets.
   */
  readonly verdict: AlignmentVerdict;
  /** The widest unmet Gap, or `null` when every Gap meets the Setting. */
  readonly widest: WidestGap | null;
  readonly rows: readonly AspectReportRow[];
}

function partyOf(instance: AssessmentInstance, role: PartyRole): Party {
  const party = instance.parties.find((entry) => entry.role === role);
  if (party === undefined) {
    // The schema guarantees one of each role, so this is unreachable on valid data —
    // say which instance broke the rule rather than drawing an empty column.
    throw new Error(`instance "${instance.id}" has no ${role}`);
  }
  return party;
}

function answersFor(party: Party, itemId: string): AspectOpinions {
  const answers = party.opinions.find((entry) => entry.itemId === itemId);
  if (answers === undefined) {
    // Also schema-guaranteed: every party answers every Aspect of the instance.
    throw new Error(`party "${party.name}" answers no Aspect "${itemId}"`);
  }
  return answers;
}

function reportedOpinions(opinions: Opinions): ReportedOpinions {
  return {
    feel: opinions.feel,
    wish: opinions.wish,
    ...(opinions.think === undefined ? {} : { think: opinions.think }),
    ...(opinions.guess === undefined ? {} : { guess: opinions.guess }),
  };
}

/**
 * The Gaps between two parties' answers, all eight kinds of them.
 *
 * `content/gaps.ts` owns the arithmetic and the pairs: eight calls of `gapOf()`, one per
 * glossary kind, and a kind one party never answered is absent because
 * `abs(score, nothing)` is not a number. Nothing here re-derives a pair inline — the
 * view model would otherwise be a second, silently different definition of a Gap.
 */
export function gapsBetween(left: ReportedOpinions, right: ReportedOpinions): ReportedGaps {
  return gapKindsOf(left, right);
}

/**
 * Project an instance and the template it names into what the screen draws.
 *
 * The title and summary are the **template's**: an instance is a copy of it, and the copy's
 * own `summary` ("Relationship Basics, answered by Avery and Rowan.") is a caption for a
 * list, not the description of the assessment. Reading them off `template` is also what
 * makes the instance's `templateId` load-bearing on screen instead of only in `data:check`.
 */
export function assessmentReport(
  instance: AssessmentInstance,
  template: Assessment,
): AssessmentReport {
  const initiator = partyOf(instance, "initiator");
  const counterparty = partyOf(instance, "counterparty");

  const rows = instance.items.map((item): AspectReportRow => {
    const left = reportedOpinions(answersFor(initiator, item.id).opinions);
    const right = reportedOpinions(answersFor(counterparty, item.id).opinions);
    return {
      itemId: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
      min: item.scale.min,
      max: item.scale.max,
      left: { role: initiator.role, name: initiator.name, opinions: left },
      right: { role: counterparty.role, name: counterparty.name, opinions: right },
      gaps: gapsBetween(left, right),
    };
  });

  // The verdict is the same `instanceAlignment()` the schematic in `content/gaps.ts`
  // defines — read over the rows just built, with the instance's own Setting. Nothing is
  // passed in: an "aligned" flag from a caller would be a second authored copy of a
  // subtraction, and the one thing this report may never do is disagree with its own numbers.
  const verdict = instanceAlignment(
    rows.map((row) => ({ itemId: row.itemId, gaps: row.gaps })),
    instance.setting,
  );

  // The widest unmet Gap, in the rows' own order (Aspect, then glossary order) so a tie
  // always resolves the same way — see `WidestGap`.
  const unmet = new Set(verdict.unmet.map((entry) => `${entry.itemId}:${entry.kind}`));
  let widest: WidestGap | null = null;
  for (const row of rows) {
    for (const kind of gapKindsIn(row.gaps)) {
      const gap = row.gaps[kind];
      if (gap === undefined || !unmet.has(`${row.itemId}:${kind}`)) continue;
      if (widest === null || gap > widest.gap) {
        widest = { itemId: row.itemId, prompt: row.prompt, kind, gap };
      }
    }
  }

  return {
    slug: instance.slug,
    title: template.title,
    summary: template.summary,
    mode: instance.mode,
    setting: instance.setting,
    settingLimit: verdict.limit,
    verdict,
    widest,
    rows,
  };
}

/** The instance a slug names, or `undefined` — the page turns that into `notFound()`. */
export function instanceBySlug(
  slug: string,
  instances: readonly AssessmentInstance[],
): AssessmentInstance | undefined {
  return instances.find((instance) => instance.slug === slug);
}
