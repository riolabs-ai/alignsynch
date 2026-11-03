/**
 * The exported report document (#504) — the round trip, the clock, and the arithmetic.
 *
 * Three claims the card makes that a comment cannot carry:
 *
 *   1. **the JSON round-trips through the model.** `record` is the instance as the model has it, so
 *      `zAssessmentInstance.safeParse(JSON.parse(reportJson(doc)).record)` answers the source
 *      record, deep-equal. A hand-built projection that "looks like" a record would fail here.
 *   2. **two regenerations are byte-identical.** The instant is the fixture clock, not a wall
 *      clock, so the same instance produces the same string every time — which is what makes the
 *      card's `sha256sum` acceptance a property of the code.
 *   3. **every number is recomputable from the rows it carries.** Each Aspect's Gaps are compared
 *      with `gapKindsOf()` over the two parties' answers the document itself prints, and the
 *      verdict's count is compared with the rows — the "no number in a report that `db:verify`
 *      cannot recompute" rule, proved as arithmetic rather than promised.
 *
 * And the fourth thing this file is for: **Doubt is stated, not omitted.** The document carries
 * `not_computable`, and the eight kinds a report can measure are unchanged.
 */
import { describe, expect, test } from "vitest";

import { zAssessmentInstance } from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import { GAP_KINDS, gapKindsOf } from "@/content/gaps";
import { assessmentInstances, assessments } from "@/data/assessments";
import { assessmentReport } from "@/lib/assessment-report";
import {
  NOT_COMPUTABLE,
  REPORT_FORMAT,
  reportDocument,
  reportJson,
  type ReportDocument,
} from "@/lib/report/document";

/** The version a test passes — nothing in the tree contains it. */
const VERSION = "9.9.9";

const instance = assessmentInstances[0];
if (instance === undefined) throw new Error("data/assessments.ts carries no instance");
const template = assessments.find((candidate) => candidate.id === instance.templateId);
if (template === undefined) throw new Error(`no template "${instance.templateId}"`);

/** The document under test, built the way the page and the export build it. */
function documentFor(source = instance): ReportDocument {
  const templateOf = assessments.find((candidate) => candidate.id === source.templateId);
  if (templateOf === undefined) throw new Error(`no template "${source.templateId}"`);
  return reportDocument(source, assessmentReport(source, templateOf), VERSION);
}

describe("the report document round-trips through the model", () => {
  test("the exported record parses back to the source instance, deep-equal", () => {
    const document = documentFor();
    const exported = JSON.parse(reportJson(document)) as { record: unknown };
    const parsed = zAssessmentInstance.safeParse(exported.record);

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data : null).toEqual(instance);
  });

  test("the format tag and the version are the document's own", () => {
    const document = documentFor();

    expect(document.format).toBe(REPORT_FORMAT);
    expect(document.template_version).toBe(VERSION);
  });
});

describe("two regenerations are byte-identical", () => {
  test("the same instance produces the same bytes twice", () => {
    expect(reportJson(documentFor())).toBe(reportJson(documentFor()));
  });

  test("the instant is the fixture clock, never a wall clock", () => {
    const document = documentFor();

    expect(document.generated_at).toBe(DEMO_NOW_ISO);
    // A wall clock would put today's year in the file. The fixture clock is 2026-10-29; a test
    // that only compared with `DEMO_NOW_ISO` would still pass if the constant moved, so the
    // stronger claim is that the document reads no clock at all — the second build is identical.
    expect(reportJson(document)).toBe(reportJson(documentFor()));
  });
});

describe("every number is recomputable from the rows the document carries", () => {
  test.each(instance.items.map((item) => [item.id] as const))(
    "the Gaps on %s are gapKindsOf() over the two printed answers",
    (itemId) => {
      const document = documentFor();
      const aspect = document.report.aspects.find((entry) => entry.item_id === itemId);
      expect(aspect).toBeDefined();
      if (aspect === undefined) return;

      // The two answers the document prints, re-subtracted. A Gap that is not this is a number
      // nothing can recompute.
      expect(aspect.gaps).toEqual(gapKindsOf(aspect.initiator, aspect.counterparty));
    },
  );

  test("the gap count is the number of present kinds on the rows", () => {
    const document = documentFor();
    const counted = document.report.aspects.reduce(
      (sum, aspect) => sum + GAP_KINDS.filter((kind) => aspect.gaps[kind] !== undefined).length,
      0,
    );

    expect(document.report.gap_count).toBe(counted);
  });

  test("the verdict agrees with its own unmet list", () => {
    const document = documentFor();

    expect(document.report.verdict.aligned).toBe(document.report.verdict.unmet.length === 0);
    for (const unmet of document.report.verdict.unmet) {
      const aspect = document.report.aspects.find((entry) => entry.item_id === unmet.item_id);
      expect(aspect?.gaps[unmet.kind]).toBe(unmet.gap);
      expect(unmet.gap).toBeGreaterThan(document.report.setting_limit);
    }
  });

  test("the widest unmet Gap is the widest one in the unmet list", () => {
    const document = documentFor();
    const widest = document.report.widest;
    if (widest === null) {
      expect(document.report.verdict.unmet).toHaveLength(0);
      return;
    }
    const highest = Math.max(...document.report.verdict.unmet.map((entry) => entry.gap));
    expect(widest.gap).toBe(highest);
  });
});

describe("what cannot be computed is stated", () => {
  test("Doubt is carried, with the reason, and is not one of the eight kinds", () => {
    const document = documentFor();

    expect(document.not_computable.map((entry) => entry.id)).toEqual(["doubt"]);
    expect(GAP_KINDS).not.toContain("doubt");
    expect(NOT_COMPUTABLE[0]?.label).toBe("Doubt Gap");
    expect(NOT_COMPUTABLE[0]?.reason).toMatch(/no history/);
  });

  test("the JSON an operator downloads carries the sentence", () => {
    const json = reportJson(documentFor());

    expect(json).toContain("not_computable");
    expect(json).toContain("Doubt Gap");
    expect(json).toContain("no history");
  });
});
