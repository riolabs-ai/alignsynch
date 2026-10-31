/**
 * The Setting — the column, the vocabulary, and the mirror (#259).
 *
 * The glossary defines a Setting as "Box in Relationship Maintenance that changes the
 * requirement to be In Synch. Soft or Full", with two values: Soft ("Small Gap (1) OK — a
 * satisfactory Setting") and Full ("No Gap OK — an exceptional Setting"). Until this card
 * `content/assessment.ts` said plainly that the Soft/Full setting "is not modelled
 * anywhere yet". These cases pin the four claims that make it real:
 *
 *   the vocabulary   two settings, their glossary labels, their sentences, and the two
 *                    thresholds (Soft 1, Full 0) — constants, never columns;
 *   the schema       `setting` is **required**: an instance that omits it or names a third
 *                    value does not parse, so "Soft ⇔ the author forgot" is unrepresentable;
 *   the fixtures     all four seeded instances author a setting, and noor-iris is the
 *                    exceptional one;
 *   the mirror       a DB-shaped row maps back to the fixture it was seeded from, so the
 *                    column cannot quietly disagree with `data/assessments.ts`.
 *
 * The negative cases spread the **real** fixtures and change one thing, the way
 * `tests/assessment-mode.test.ts` does: a mutated copy that still parses would mean the
 * field is decoration.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALIGNMENT_SETTING,
  SETTING_DEFINITIONS,
  SETTING_GAP_LIMITS,
  SETTING_LABELS,
  zAlignmentSetting,
  zAssessmentInstance,
} from "@/content/assessment";
import { assessmentInstanceFromRows, type AssessmentInstanceRows } from "@/lib/db/rows";
import { assessmentInstances } from "@/data/assessments";
import type { AssessmentInstance } from "@/content/assessment";

/** The feature example: Basic Mode, Soft. */
const avery = assessmentInstances.find((instance) => instance.slug === "avery-rowan");
/** The Advanced demonstration: the one instance authored under Full. */
const noor = assessmentInstances.find((instance) => instance.slug === "noor-iris");

if (avery === undefined || noor === undefined) {
  throw new Error("the Avery/Rowan and Noor/Iris fixtures are this file's subject");
}

/** The rows `db:seed` writes for an instance, for the mirror cases. */
function instanceRows(instance: AssessmentInstance): AssessmentInstanceRows {
  return {
    record: {
      id: instance.id,
      slug: instance.slug,
      record_type: instance.type,
      status: instance.status,
      date: instance.date,
      title: instance.title,
      summary: instance.summary,
    },
    items: instance.items.map((item, position) => ({
      record_id: instance.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    options: [],
    instance: {
      record_id: instance.id,
      template_record_id: instance.templateId,
      mode: instance.mode,
      setting: instance.setting,
    },
    parties: instance.parties.map((party) => ({
      instance_record_id: instance.id,
      role: party.role,
      name: party.name,
    })),
    opinions: instance.parties.flatMap((party) =>
      party.opinions.map((answer) => ({
        instance_record_id: instance.id,
        role: party.role,
        item_id: answer.itemId,
        feel: answer.opinions.feel,
        wish: answer.opinions.wish,
        think: answer.opinions.think ?? null,
        guess: answer.opinions.guess ?? null,
      })),
    ),
  };
}

describe("the vocabulary", () => {
  it("defines exactly two settings, soft and full", () => {
    expect(zAlignmentSetting.options).toEqual(["soft", "full"]);
    expect(zAlignmentSetting.safeParse("soft").success).toBe(true);
    expect(zAlignmentSetting.safeParse("full").success).toBe(true);
    expect(zAlignmentSetting.safeParse("lenient").success).toBe(false);
    expect(zAlignmentSetting.safeParse("Soft").success).toBe(false);
  });

  it("carries the glossary's own word and sentence for each setting", () => {
    expect(SETTING_LABELS).toEqual({ soft: "Soft", full: "Full" });
    expect(SETTING_DEFINITIONS).toEqual({
      soft: "Small Gap (1) OK – a satisfactory Setting.",
      full: "No Gap OK – an exceptional Setting.",
    });
  });

  it("tolerates a Gap of 1 under Soft and nothing above 0 under Full", () => {
    // Thresholds are constants in the schema, never columns — the same standing as SCORE_MIN.
    expect(SETTING_GAP_LIMITS).toEqual({ soft: 1, full: 0 });
  });

  it("reads a row that predates the column under Soft, the least-strict reading", () => {
    expect(DEFAULT_ALIGNMENT_SETTING).toBe("soft");
  });
});

describe("the instance's setting is a parse-time fact", () => {
  it("accepts every fixture, each under its authored setting", () => {
    for (const instance of assessmentInstances) {
      expect(zAssessmentInstance.safeParse(instance).success, instance.slug).toBe(true);
    }
  });

  it("rejects an instance that omits the setting — it is required, not defaulted", () => {
    const { setting: _omitted, ...withoutSetting } = avery;
    const parsed = zAssessmentInstance.safeParse(withoutSetting);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path.join(".") === "setting")).toBe(true);
  });

  it("rejects a setting the model does not define, naming the field", () => {
    const parsed = zAssessmentInstance.safeParse({ ...avery, setting: "nonsense" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path.join(".") === "setting")).toBe(true);
  });
});

describe("the fixtures author their setting", () => {
  it("gives every seeded instance an explicit setting", () => {
    const settings = assessmentInstances.map((instance) => [instance.slug, instance.setting]);
    expect(settings).toEqual([
      ["avery-rowan", "soft"],
      ["ruth-sam", "soft"],
      ["marco-priya", "soft"],
      ["noor-iris", "full"],
    ]);
  });

  it("keeps exactly one instance under Full, and it is the Advanced demonstration", () => {
    const full = assessmentInstances.filter((instance) => instance.setting === "full");
    expect(full.map((instance) => instance.slug)).toEqual(["noor-iris"]);
    expect(noor.mode).toBe("advanced");
  });
});

describe("the DB-shaped rows round-trip", () => {
  it("maps the alignment_setting column back to the fixture's setting", () => {
    for (const instance of assessmentInstances) {
      const parsed = assessmentInstanceFromRows(instanceRows(instance));
      expect(parsed.setting, instance.slug).toBe(instance.setting);
    }
  });

  it("rejects a row whose column says a third setting", () => {
    const rows = instanceRows(avery);
    const broken: AssessmentInstanceRows = {
      ...rows,
      instance: { ...rows.instance, setting: "lenient" },
    };
    expect(() => assessmentInstanceFromRows(broken)).toThrow(/setting/i);
  });
});
