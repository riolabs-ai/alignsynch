/**
 * The report as a **document** — the JSON an operator exports, and the source every other
 * rendering of the same report (the PDF, the screen's own numbers) is built from (#504).
 *
 * Two things this module is, and one it deliberately is not:
 *
 *   it is **pure**          no React, no Next, no `pg`, no clock. Every number is read out of
 *                           `lib/assessment-report.ts`'s projection, which reads them out of the
 *                           opinion rows; nothing here computes a Gap a second time.
 *   it is **round-trippable** `record` is the instance exactly as the model has it, so
 *                           `zAssessmentInstance.safeParse(JSON.parse(reportJson(doc)).record)`
 *                           answers the source record, deep-equal. That is the card's
 *                           acceptance, and `tests/report-document.test.ts` pins it.
 *   it is **not a second model**  the derived half is a *projection* (names for the reader,
 *                           snake_case keys for a file), never an authored value. There is no
 *                           stored report, no `report` table and no `gap` column, so a document
 *                           cannot drift from the rows: it is rebuilt from them every time.
 *
 * **The instant is the fixture clock, and that is the point.** `generated_at` is
 * `DEMO_NOW_ISO` (`content/core.ts`) — the same instant every fixture label is a pure function
 * of — and not `new Date()`. Three consequences, all wanted: the PDF names the instant it was
 * generated from without a clock read in a render path (the hydration-mismatch defect this repo
 * has a rule about), regenerating the same complete instance twice produces byte-identical JSON
 * (the card's `sha256sum` acceptance), and `db:verify`/a reviewer can recompute every number in
 * the document from the rows it carries. A live timestamp would make the second one false for
 * no gain: what a reader needs is *which* report this is, and that is the record plus the
 * template version.
 *
 * **What cannot be computed is part of the document, not an omission.** Step-3 **Doubt** is the
 * specification's third gap step and this build cannot answer it: `opinion` stores one value per
 * kind with no history, and opinions are frozen at completion (`docs/SPEC-DRIFT.md` §4.1), so
 * there is no "after the reveal" reading to compare against the prediction. A report that simply
 * printed the eight kinds would read as "there are eight kinds and all are here"; carrying
 * `not_computable` says the ninth thing out loud, with the reason, in the file and on the page.
 */
import type { AssessmentInstance } from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import {
  flagCountsOf,
  GAP_KINDS,
  type FlagCounts,
  type GapKind,
  type GapKinds,
} from "@/content/gaps";
import type { AssessmentReport, AspectReportRow, ReportedOpinions } from "@/lib/assessment-report";
import type { AlignmentSetting, AssessmentMode } from "@/content/assessment";
import type { Gap } from "@/content/record";

/**
 * The document's own format tag. A file somebody exported is read by a tool that was not in the
 * room when it was written, so it says which shape it is — the same rule `content/bundle.ts`
 * follows for the bundle (#147). Bumping this is a deliberate act, and the round-trip test reads
 * the constant rather than a literal.
 */
export const REPORT_FORMAT = "alignsynch.report/1";

/**
 * One thing a reader of this report is owed an answer about and cannot have.
 *
 * `id` is the glossary's own step name (`doubt`), never a gap kind: adding it to `GAP_KINDS`
 * would put a ninth row in every table the eight kinds drive, and
 * `tests/report-groups.test.ts` pins that the party-facing report still shows exactly eight.
 */
export interface NotComputable {
  readonly id: "doubt";
  readonly label: string;
  /** Why, in the product's own words — the same sentence the screen and the PDF print. */
  readonly reason: string;
}

/**
 * The gap steps this build cannot compute, stated once.
 *
 * Doubt is the only one: Surprise is the same four prediction kinds read at the *first* showing
 * (which is what `content/gaps.ts` computes today — the prediction kinds are already that
 * reading), so naming it separately would invent a distinction the data does not hold. The
 * reason is `docs/SPEC-DRIFT.md`'s finding, in the reader's words rather than the table's.
 */
export const NOT_COMPUTABLE: readonly NotComputable[] = [
  {
    id: "doubt",
    label: "Doubt Gap",
    reason:
      "Doubt compares what a party predicted before the reveal with their view after it. The opinion rows store one value per kind and no history, and opinions are frozen when a session completes, so there is no second reading to compare against the prediction. Adding it needs an opinion history or a snapshot at unlock — a data-model decision, not a report.",
  },
];

/** One party's answers, named, in the four-opinion shape the model has. */
export interface DocumentedParty {
  readonly name: string;
  readonly feel: number;
  readonly wish: number;
  readonly think?: number;
  readonly guess?: number;
}

/** One Aspect of the report: what was asked, both answers behind every Gap, and the Gaps. */
export interface DocumentedAspect {
  readonly item_id: string;
  readonly prompt: string;
  readonly left_value: string;
  readonly right_value: string;
  readonly initiator: DocumentedParty;
  readonly counterparty: DocumentedParty;
  /** The kinds this Aspect has, in the glossary's order — four, or eight in Advanced Mode. */
  readonly gap_kinds: readonly GapKind[];
  /** `kind → Gap`. Absent kinds are absent, never 0. */
  readonly gaps: GapKinds;
}

/** The derived half: what the report says, with no field a stored row could drift from. */
export interface DocumentedReport {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  /** The widest Gap the Setting tolerates — `SETTING_GAP_LIMITS`, carried, never re-imported. */
  readonly setting_limit: number;
  readonly aspects: readonly DocumentedAspect[];
  readonly verdict: {
    readonly aligned: boolean;
    readonly unmet: readonly {
      readonly item_id: string;
      readonly kind: GapKind;
      readonly gap: Gap;
    }[];
  };
  readonly widest: {
    readonly item_id: string;
    readonly prompt: string;
    readonly kind: GapKind;
    readonly gap: Gap;
  } | null;
  /** How many Gaps sat at each flag severity, or `null` when nothing was scored. */
  readonly flags: FlagCounts | null;
  /** Every Aspect's Gaps counted — the denominators a reviewer checks the rows against. */
  readonly gap_count: number;
}

/** The exported document. `record` is the source; everything else is derived from it. */
export interface ReportDocument {
  readonly format: string;
  /** `package.json`'s version, as `next.config.mjs` inlines it (`APP_VERSION`). */
  readonly template_version: string;
  /** The fixture clock, never a wall clock — see the module comment. */
  readonly generated_at: string;
  readonly record: AssessmentInstance;
  readonly report: DocumentedReport;
  readonly not_computable: readonly NotComputable[];
}

/** A party's four opinions, named and copied — never a reference into the projection. */
function partyOf(row: AspectReportRow, side: "left" | "right"): DocumentedParty {
  const party = side === "left" ? row.left : row.right;
  return { name: party.name, ...opinionsOf(party.opinions) };
}

/** The four opinion kinds in the model's order, with the optional pair left out when absent. */
function opinionsOf(opinions: ReportedOpinions): {
  feel: number;
  wish: number;
  think?: number;
  guess?: number;
} {
  return {
    feel: opinions.feel,
    wish: opinions.wish,
    ...(opinions.think === undefined ? {} : { think: opinions.think }),
    ...(opinions.guess === undefined ? {} : { guess: opinions.guess }),
  };
}

/**
 * The Gaps of one Aspect, keyed in the glossary's order.
 *
 * Rebuilt rather than passed through so the JSON's key order is a property of this module and
 * not of the order `gapKindsOf()` happened to insert into an object — two regenerations of the
 * same instance have to be byte-identical, and `JSON.stringify` follows insertion order.
 */
function gapsOf(row: AspectReportRow): GapKinds {
  const gaps: { [K in GapKind]?: Gap } = {};
  for (const kind of GAP_KINDS) {
    if (row.gaps[kind] === undefined) continue;
    gaps[kind] = row.gaps[kind];
  }
  return gaps;
}

/**
 * Project a report and the record it was computed from into the exported document.
 *
 * `templateVersion` is an argument because this module is pure (the same reason
 * `content/bundle.ts` takes `appVersion`): the caller reads `process.env.APP_VERSION`, which the
 * bundler inlines, and a test passes a version nothing else carries.
 */
export function reportDocument(
  record: AssessmentInstance,
  report: AssessmentReport,
  templateVersion: string,
): ReportDocument {
  const aspects: DocumentedAspect[] = report.rows.map((row) => ({
    item_id: row.itemId,
    prompt: row.prompt,
    left_value: row.leftValue,
    right_value: row.rightValue,
    initiator: partyOf(row, "left"),
    counterparty: partyOf(row, "right"),
    gap_kinds: GAP_KINDS.filter((kind) => row.gaps[kind] !== undefined),
    gaps: gapsOf(row),
  }));

  return {
    format: REPORT_FORMAT,
    template_version: templateVersion,
    generated_at: DEMO_NOW_ISO,
    record,
    report: {
      slug: report.slug,
      title: report.title,
      summary: report.summary,
      mode: report.mode,
      setting: report.setting,
      setting_limit: report.settingLimit,
      aspects,
      verdict: {
        aligned: report.verdict.aligned,
        unmet: report.verdict.unmet.map((entry) => ({
          item_id: entry.itemId,
          kind: entry.kind,
          gap: entry.gap,
        })),
      },
      widest:
        report.widest === null
          ? null
          : {
              item_id: report.widest.itemId,
              prompt: report.widest.prompt,
              kind: report.widest.kind,
              gap: report.widest.gap,
            },
      flags: flagCountsOf(report.rows.map((row) => ({ itemId: row.itemId, gaps: row.gaps }))),
      gap_count: report.rows.reduce(
        (sum, row) => sum + GAP_KINDS.filter((kind) => row.gaps[kind] !== undefined).length,
        0,
      ),
    },
    not_computable: NOT_COMPUTABLE,
  };
}

/**
 * The document as the bytes an export writes.
 *
 * Two-space indent and a trailing newline, both fixed: the file is read by a person as often as
 * by a tool, and a diff of two exports of the same instance should be empty rather than a
 * re-flow. `JSON.stringify` preserves key order, and every object above is built in a fixed one,
 * which is what makes the byte-identity acceptance a property of the code and not of luck.
 */
export function reportJson(document: ReportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
