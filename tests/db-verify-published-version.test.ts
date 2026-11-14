/**
 * V30 — a record the catalogue marks `published` is a template a relationship can start from
 * (#962).
 *
 * The defect this covers was measured on the demo branch and had no code in it: 28 templates read
 * `status = 'published'` with **zero** `template_version` rows, because `scripts/db-seed.mjs`
 * copied the fixture's status and only wrote a version for the templates an existing relationship
 * happened to name. So `/admin/templates` drew 29 green `published` badges over a catalogue that
 * could not start a single relationship, and every create answered "template has no published
 * version — publish it before a relationship can copy it". Every command stayed green: the refusal
 * is correct, the version genuinely is missing, and nothing measured the pair.
 *
 * The check is `publishedWithoutVersionProblems()` in `scripts/db-verify.mjs`, exported for the
 * same reason V21's is: the gate is database-free (`docs/operations/gate.md`), so the rule takes rows and
 * these cases feed it rows. The case worth reading first is "the demo branch's own shape" — it
 * rebuilds the measured 28-of-29 and fails if the rule ever stops biting.
 */
import { describe, expect, it } from "vitest";

import { publishedWithoutVersionProblems } from "../scripts/db-verify.mjs";

/** One row of V30's `record` read, as `pg` returns it. */
interface PublicationRow {
  slug: string;
  status: string;
  is_session: boolean;
  versions: number;
}

/** A template the seed has published: offered, and with the version a relationship binds to. */
function publishedTemplate(slug: string, versions = 1): PublicationRow {
  return { slug, status: "published", is_session: false, versions };
}

/** A template the fixture marks draft: not offered, and with no version on purpose. */
function draftTemplate(slug: string): PublicationRow {
  return { slug, status: "draft", is_session: false, versions: 0 };
}

/** An instance's own record — a played copy. It carries `published` and can never own a version. */
function sessionRecord(slug: string): PublicationRow {
  return { slug, status: "published", is_session: true, versions: 0 };
}

describe("V30 — a published template has a version", () => {
  it("names the template the seed marked published and never published", () => {
    const problems = publishedWithoutVersionProblems([
      publishedTemplate("relationship-basics"),
      { slug: "father-son", status: "published", is_session: false, versions: 0 },
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V30");
    expect(problems[0].message).toContain('"father-son"');
    expect(problems[0].message).toContain("has no template_version");
  });

  it("says which command writes the missing row", () => {
    const [problem] = publishedWithoutVersionProblems([
      { slug: "father-son", status: "published", is_session: false, versions: 0 },
    ]);

    expect(problem.message).toContain("pnpm db:seed");
    expect(problem.message).toContain("/admin/templates");
  });

  it("is silent for a published template that has its version", () => {
    expect(publishedWithoutVersionProblems([publishedTemplate("relationship-basics")])).toEqual([]);
  });

  it("is silent for a draft — no version is what 'not offered' means", () => {
    expect(publishedWithoutVersionProblems([draftTemplate("blank-template")])).toEqual([]);
  });

  it("is silent for an instance's own record, which is a copy and never a template", () => {
    expect(publishedWithoutVersionProblems([sessionRecord("avery-rowan")])).toEqual([]);
  });

  it("reports every template in the demo branch's measured shape", () => {
    // The branch as #962 found it: 28 published templates, none with a version, plus the four
    // instance records that are published and must not be counted. 29 rows answered the card's
    // own query; 28 of them were templates.
    const rows = [
      ...Array.from({ length: 28 }, (_, index) => ({
        slug: `catalogue-${String(index).padStart(2, "0")}`,
        status: "published",
        is_session: false,
        versions: 0,
      })),
      ...Array.from({ length: 4 }, (_, index) => sessionRecord(`instance-${index}`)),
    ];

    const problems = publishedWithoutVersionProblems(rows);

    expect(problems).toHaveLength(28);
    expect(problems.every((problem) => problem.code === "V30")).toBe(true);
  });

  it("reports nothing once the seed has published the catalogue", () => {
    const rows = [
      ...Array.from({ length: 28 }, (_, index) => publishedTemplate(`catalogue-${index}`)),
      draftTemplate("blank-template"),
      ...Array.from({ length: 4 }, (_, index) => sessionRecord(`instance-${index}`)),
    ];

    expect(publishedWithoutVersionProblems(rows)).toEqual([]);
  });
});
