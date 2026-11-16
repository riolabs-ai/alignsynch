/**
 * The additive template import's decisions, without a branch (#1099).
 *
 * Three things this file is here to keep true, because each one is a way the fix could be wrong
 * while looking right:
 *
 *   1. **Production's actual shape is a create, not a no-op.** A branch holding only the four
 *      fixture-era templates must plan 25 creates and one status correction (`blank-template`,
 *      which the fixture publishes and the branch still calls `draft`) — that is the measured
 *      before-census in the issue, so a planner that answered "nothing to do" would be the bug.
 *   2. **A converged branch is silent.** A second run writes nothing, which is what makes
 *      `templates:import` safe to re-run after a partial failure.
 *   3. **The two refusals that protect authorship.** A slug an account authored, and a slug that
 *      names an instance (a record with a `session` row), are both *refused*, never rewritten —
 *      the card forbids reassigning authorship and the import has no delete statement at all.
 *
 * Plus the guard: `nonTemplateDrift` is what the importer commits on, so its two answers (silent
 * on an unchanged census, named on a moved one) are asserted rather than trusted.
 */
import { describe, expect, it } from "vitest";
import { platformTemplates } from "@/lib/platform-templates";
import {
  NON_TEMPLATE_TABLES,
  censusLine,
  guardLine,
  nonTemplateDrift,
  planTemplateImport,
} from "../scripts/db-templates-plan.mjs";

/** One `existing` row for a fixture template, the shape the importer's query returns. */
function rowFor(slug: string, overrides: Record<string, unknown> = {}) {
  const template = platformTemplates.find((candidate) => candidate.slug === slug);
  if (template === undefined) throw new Error(`no fixture template "${slug}"`);
  return {
    slug,
    id: template.id,
    status: template.status,
    authorUserId: null,
    sessions: 0,
    itemIds: template.items.map((item) => item.id),
    versionCount: 1,
    ...overrides,
  };
}

/**
 * The four templates production had on 2026-11-15, as the census printed them: three published
 * with a version, and `blank-template` still `draft` with none.
 */
const PRODUCTION_ROWS = [
  rowFor("relationship-basics", { versionCount: 3 }),
  rowFor("staff-manager"),
  rowFor("parent-child"),
  rowFor("blank-template", { status: "draft", versionCount: 0 }),
];

describe("the plan against production's measured shape", () => {
  const plan = planTemplateImport({ templates: platformTemplates, existing: PRODUCTION_ROWS });

  it("creates every template the branch is missing, and nothing else", () => {
    const served = platformTemplates.map((template) => template.slug);
    expect(plan.create).toEqual(
      served.filter((slug) => !PRODUCTION_ROWS.some((row) => row.slug === slug)),
    );
    expect(plan.create).toContain("colleagues");
    expect(plan.create).toContain("spouses");
    expect(plan.create).toHaveLength(platformTemplates.length - PRODUCTION_ROWS.length);
  });

  it("corrects the one drifted platform row, and names both reasons", () => {
    expect(plan.update.map((entry) => entry.slug)).toEqual(["blank-template"]);
    const reasons = plan.update[0]?.reasons.join(" ");
    expect(reasons).toContain("draft → published");
    expect(reasons).toContain("no template_version");
  });

  it("leaves the three already-correct templates alone", () => {
    expect(plan.unchanged).toEqual(["relationship-basics", "staff-manager", "parent-child"]);
    expect(plan.refuse).toEqual([]);
    expect(plan.strays).toEqual([]);
    expect(plan.writes).toBe(plan.create.length + plan.update.length);
  });
});

describe("the plan is idempotent", () => {
  it("writes nothing against a converged branch", () => {
    const converged = platformTemplates.map((template) => rowFor(template.slug));
    const plan = planTemplateImport({ templates: platformTemplates, existing: converged });
    expect(plan.writes).toBe(0);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.unchanged).toHaveLength(platformTemplates.length);
  });

  it("re-asks an unchanged row with a missing item as an update", () => {
    const rows = platformTemplates.map((template) => rowFor(template.slug));
    const index = rows.findIndex((row) => row.slug === "team");
    rows[index] = { ...rows[index], itemIds: rows[index]?.itemIds.slice(1) ?? [] };
    const plan = planTemplateImport({ templates: platformTemplates, existing: rows });
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0]?.reasons.join(" ")).toContain("items missing:");
  });
});

describe("the two refusals that protect what is not ours", () => {
  it("refuses a slug an account authored, rather than reassigning it", () => {
    const rows = [
      ...PRODUCTION_ROWS.filter((row) => row.slug !== "parent-child"),
      rowFor("parent-child", { authorUserId: "user-abc" }),
    ];
    const plan = planTemplateImport({ templates: platformTemplates, existing: rows });
    expect(plan.refuse.map((entry) => entry.slug)).toEqual(["parent-child"]);
    expect(plan.refuse[0]?.reason).toContain("authored by user user-abc");
    // Not created either: the slug exists, it is just not ours, so the import must not duplicate it.
    expect(plan.create).not.toContain("parent-child");
    expect(plan.update.map((entry) => entry.slug)).not.toContain("parent-child");
  });

  it("refuses a slug that names an instance, rather than overwriting a relationship's record", () => {
    const rows = [
      ...PRODUCTION_ROWS.filter((row) => row.slug !== "team"),
      rowFor("team", { sessions: 2 }),
    ];
    const plan = planTemplateImport({ templates: platformTemplates, existing: rows });
    expect(plan.refuse.map((entry) => entry.slug)).toEqual(["team"]);
    expect(plan.refuse[0]?.reason).toContain("instance");
  });

  it("reports a platform row the fixtures dropped without touching it", () => {
    const rows = [
      ...PRODUCTION_ROWS,
      {
        slug: "a-retired-template",
        id: "assessment-a-retired-template",
        status: "published",
        authorUserId: null,
        sessions: 0,
        itemIds: [],
        versionCount: 1,
      },
    ];
    const plan = planTemplateImport({ templates: platformTemplates, existing: rows });
    // A slug with no fixture row is not even "existing" for the plan — but the row is not deleted,
    // and `strays` is what says so.
    expect(plan.strays).toContain("a-retired-template");
    expect(plan.create).not.toContain("a-retired-template");
    // 25 creates and the one status correction: every fixture template the four rows do not
    // already satisfy correctly.
    expect(plan.writes).toBe(platformTemplates.length - 3);
  });

  it("does not call an instance a stray template", () => {
    // The import's `existing` query reads every assessment record so it can see a slug an instance
    // holds; those rows are relationships, not retired templates, and the report must not name them.
    const rows = [
      ...PRODUCTION_ROWS,
      {
        slug: "avery-rowan-flat",
        id: "relationship-avery-rowan-flat",
        status: "published",
        authorUserId: null,
        sessions: 1,
        itemIds: [],
        versionCount: 1,
      },
    ];
    const plan = planTemplateImport({ templates: platformTemplates, existing: rows });
    expect(plan.strays).toEqual([]);
  });
});

describe("the guard the importer commits on", () => {
  const census = Object.fromEntries(NON_TEMPLATE_TABLES.map((table, index) => [table, index + 1]));

  it("says nothing when only the write's own tables moved", () => {
    expect(
      nonTemplateDrift(census, {
        ...census,
        record: 60,
        template: 43,
        served: 29,
        item: 340,
        template_version: 42,
      }),
    ).toEqual([]);
  });

  it("names every guarded table that moved", () => {
    const drifted = nonTemplateDrift(census, { ...census, relationship: 0, opinion: 40 });
    expect(drifted).toEqual(["relationship 2 → 0", "opinion 3 → 40"]);
  });

  it("treats a table it could not measure as drifted", () => {
    const missing = { ...census };
    delete (missing as Record<string, unknown>).party;
    expect(nonTemplateDrift(census, missing)).toEqual(["party 4 → undefined"]);
  });

  it("prints the template census and the guard line", () => {
    const measured = {
      record: 38,
      template: 14,
      served: 3,
      item: 194,
      template_version: 13,
      ...census,
    };
    expect(censusLine(measured)).toBe(
      "record 38 · templates 14 · served 3 · item 194 · template_version 13",
    );
    expect(guardLine(measured)).toBe(
      NON_TEMPLATE_TABLES.map((table) => `${table} ${census[table]}`).join(" · "),
    );
  });
});
