/**
 * The assessment report — the one projection `/assessment/[slug]` renders.
 *
 * The screen is a read of two records and one function:
 *
 *   the instance  holds the copy of the Aspects and both parties' Opinions;
 *   the template  holds the title and summary the reader sees above them;
 *   `gapOf()`     is the only Gap there is (`content/record.ts`).
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
  Assessment,
  AssessmentInstance,
  AssessmentMode,
  AspectOpinions,
  OpinionKind,
  Opinions,
  Party,
  PartyRole,
} from "@/content/assessment";
import { gapOf, type Gap, type Score } from "@/content/record";

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
 * The Gaps of one Aspect. `feel` and `wish` are always there, because Basic Mode is the
 * floor; `think` and `guess` exist only when **both** parties answered them — an Advanced
 * instance answers all four on every Aspect and a Basic one answers neither, so the pair is
 * present or absent for the whole instance rather than per row.
 */
export interface ReportedGaps {
  readonly feel: Gap;
  readonly wish: Gap;
  readonly think?: Gap;
  readonly guess?: Gap;
}

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
 * The Gaps between two parties' answers.
 *
 * `gapOf()` is called once per opinion kind, on the pair it belongs to — the eight named
 * Gaps of the glossary are eight calls over eight pairs, not eight functions. A kind only
 * one party answered has no pair, so it has no Gap: abs(score, nothing) is not a number.
 */
export function gapsBetween(left: ReportedOpinions, right: ReportedOpinions): ReportedGaps {
  const gapFor = (kind: OpinionKind): Gap | undefined => {
    const [a, b] = [left[kind], right[kind]];
    return a === undefined || b === undefined ? undefined : gapOf(a, b);
  };
  const think = gapFor("think");
  const guess = gapFor("guess");
  return {
    feel: gapOf(left.feel, right.feel),
    wish: gapOf(left.wish, right.wish),
    ...(think === undefined ? {} : { think }),
    ...(guess === undefined ? {} : { guess }),
  };
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

  return {
    slug: instance.slug,
    title: template.title,
    summary: template.summary,
    mode: instance.mode,
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
