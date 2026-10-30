/**
 * The read boundary, proved without a connection (#145).
 *
 * `lib/db/rows.ts` maps rows to the content model and `safeParse`s the result. These cases do
 * two jobs:
 *
 *   1. **the mirror is exact** — the rows a seed would write for a fixture map back to an
 *      object deep-equal to that fixture, so the database cannot quietly disagree with
 *      `data/assessments.ts`;
 *   2. **the schema still decides** — a think without a guess, a party that skipped an Aspect,
 *      a drifted copy and an option-scale item on an assessment are each rejected, which is
 *      what makes the zod parse the boundary rather than decoration.
 *
 * No `DATABASE_URL`, no `pg`, no clock: this file is also the answer to "does the gate need a
 * database" — it runs inside `pnpm test` with none set.
 */
import { describe, expect, test } from "vitest";
import {
  assessmentInstanceFromRows,
  assessmentTemplateFromRows,
  copyDriftProblems,
  isoInstantOf,
  itemIdsOf,
  orderedItems,
  type AssessmentInstanceRows,
  type AssessmentTemplateRows,
} from "@/lib/db/rows";
import { assessmentInstances, assessments } from "@/data/assessments";
import type { Assessment, AssessmentInstance } from "@/content/assessment";

/** The rows the seed writes for an instance, written the way `db-seed.mjs` writes them. */
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
    instance: { record_id: instance.id, template_record_id: instance.templateId },
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

/** The rows the seed writes for a template. */
function templateRows(template: Assessment): AssessmentTemplateRows {
  return {
    record: {
      id: template.id,
      slug: template.slug,
      record_type: template.type,
      status: template.status,
      date: template.date,
      title: template.title,
      summary: template.summary,
    },
    items: template.items.map((item, position) => ({
      record_id: template.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    options: [],
  };
}

/** Replace the row at `index` — the row interfaces are `readonly`, so rows are rebuilt, not edited. */
function replacing<T>(rows: readonly T[], index: number, patch: Partial<T>): T[] {
  return rows.map((row, position) => (position === index ? { ...row, ...patch } : row));
}

describe("rows → model", () => {
  test.each(assessmentInstances.map((instance) => [instance.slug, instance] as const))(
    "the rows for %s map back to the fixture",
    (_slug, instance) => {
      expect(assessmentInstanceFromRows(instanceRows(instance))).toEqual(instance);
    },
  );

  test.each(assessments.map((template) => [template.slug, template] as const))(
    "the rows for template %s map back to the fixture",
    (_slug, template) => {
      expect(assessmentTemplateFromRows(templateRows(template))).toEqual(template);
    },
  );

  test("the parties come back initiator-first whatever order the rows arrive in", () => {
    const instance = assessmentInstances[0];
    const rows = instanceRows(instance);
    const reversed = { ...rows, parties: [...rows.parties].reverse() };

    expect(assessmentInstanceFromRows(reversed).parties).toEqual(instance.parties);
  });

  test("items are ordered by position, not by the query's row order", () => {
    const instance = assessmentInstances[0];
    const rows = instanceRows(instance);
    const shuffled = { ...rows, items: [...rows.items].reverse() };

    expect(assessmentInstanceFromRows(shuffled).items).toEqual(instance.items);
  });

  test("a TIMESTAMPTZ string with an offset becomes the model's UTC instant", () => {
    expect(isoInstantOf("2026-10-24T09:00:00+00:00")).toBe("2026-10-24T09:00:00.000Z");
    expect(isoInstantOf(new Date("2026-10-24T09:00:00.000Z"))).toBe("2026-10-24T09:00:00.000Z");
  });
});

describe("the schema still decides", () => {
  test("think without guess is rejected, and the error says so", () => {
    const rows = instanceRows(assessmentInstances[0]);
    const halfPair = { ...rows, opinions: replacing(rows.opinions, 0, { think: 4, guess: null }) };

    expect(() => assessmentInstanceFromRows(halfPair)).toThrow(/Think and Guess come together/);
  });

  test("a party that skipped an Aspect is rejected, naming the party and the field", () => {
    const rows = instanceRows(assessmentInstances[0]);
    // Row 5 is the counterparty's first answer: drop it and that party answers four Aspects.
    const unanswered = {
      ...rows,
      opinions: rows.opinions.filter((_row, index) => index !== 5),
    };

    expect(() => assessmentInstanceFromRows(unanswered)).toThrow(
      /parties\.1\.opinions\.0\.opinions\.feel/,
    );
  });

  test("a score item with no Left/Right Value is rejected", () => {
    const rows = instanceRows(assessmentInstances[0]);
    const noLeftValue = { ...rows, items: replacing(rows.items, 0, { left_value: null }) };

    expect(() => assessmentInstanceFromRows(noLeftValue)).toThrow(/leftValue/);
  });

  test("an option-scale item is not an Aspect", () => {
    const template = templateRows(assessments[0]);
    const withOptionItem = {
      ...template,
      items: replacing(template.items, 0, {
        scale_kind: "options",
        left_value: null,
        right_value: null,
      }),
    };

    expect(() => assessmentTemplateFromRows(withOptionItem)).toThrow(
      /record "relationship-basics"/,
    );
  });

  test("a record whose type is not `assessment` is rejected", () => {
    const template = templateRows(assessments[0]);
    const wrongType = {
      ...template,
      record: { ...template.record, record_type: "lesson" },
    };

    expect(() => assessmentTemplateFromRows(wrongType)).toThrow(/type/);
  });
});

describe("copy drift (the DB port of E31)", () => {
  const template = assessments[0];
  const instance = assessmentInstances[0];

  test("a copy that matches its template is not a problem", () => {
    expect(
      copyDriftProblems({
        instanceId: instance.id,
        templateId: template.id,
        copyIds: itemIdsOf(templateRows(instance).items),
        templateIds: itemIdsOf(templateRows(template).items),
      }),
    ).toEqual([]);
  });

  test("a renamed Aspect is named with both lists", () => {
    const drifted = templateRows(instance);
    const renamed = {
      ...drifted,
      items: replacing(drifted.items, 0, { item_id: "aspect-drifted" }),
    };

    const problems = copyDriftProblems({
      instanceId: instance.id,
      templateId: template.id,
      copyIds: itemIdsOf(renamed.items),
      templateIds: itemIdsOf(templateRows(template).items),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(instance.id);
    expect(problems[0]).toContain("aspect-drifted");
    expect(problems[0]).toContain(template.id);
  });

  test("the same Aspects in a different order is drift too", () => {
    const items = templateRows(instance).items;
    // Order is `position`, so a reordering is a changed position — not a reversed array.
    const reordered = items.map((item, index) => ({ ...item, position: items.length - 1 - index }));

    expect(
      copyDriftProblems({
        instanceId: instance.id,
        templateId: template.id,
        copyIds: itemIdsOf(reordered),
        templateIds: itemIdsOf(templateRows(template).items),
      }),
    ).toHaveLength(1);
  });
});

test("orderedItems is a sort, not a mutation", () => {
  const rows = [{ position: 2 }, { position: 0 }, { position: 1 }];
  expect(orderedItems(rows).map((row) => row.position)).toEqual([0, 1, 2]);
  expect(rows.map((row) => row.position)).toEqual([2, 0, 1]);
});
