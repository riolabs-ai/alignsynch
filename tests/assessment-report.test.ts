/**
 * The assessment screen's two claims, in one file:
 *
 *   1. the Gap is computed, not stored — the row where Avery's Feel is 2 and Rowan's is 5
 *      shows 3, and it is `gapOf(2, 5)` rather than a number written next to them;
 *   2. the render shows it — the row's markup carries that Gap, and the screen names both
 *      parties, so "nothing renders it" cannot come back quietly.
 *
 * "Renders" means `renderToStaticMarkup` over the projection, not a DOM: the component is a
 * server component with no state, so the markup *is* the screen, and a node environment can
 * read every attribute on it. The page's own `notFound()` is exercised separately, because
 * an unknown slug is a status code, not a text the reader can see.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import AssessmentPage from "@/app/(mainlayout)/assessment/[slug]/page";
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { gapOf, type Gap } from "@/content/record";
import { assessmentInstances, assessments } from "@/data/assessments";
import { assessmentReport, instanceBySlug } from "@/lib/assessment-report";

const instance = assessmentInstances[0];
const template = assessments.find((entry) => entry.id === instance.templateId);

if (instance === undefined || template === undefined) {
  throw new Error("the Avery/Rowan fixture and its template are the test's subject");
}

const report = assessmentReport(instance, template);
const markup = renderToStaticMarkup(createElement(AssessmentReportView, { report }));

describe("the report's Gaps", () => {
  it("shows a Feel Gap of 3 on aspect-time-together, because 2 against 5 is 3", () => {
    const row = report.rows.find((entry) => entry.itemId === "aspect-time-together");
    expect(row).toBeDefined();

    expect(row?.left.opinions.feel).toBe(2);
    expect(row?.right.opinions.feel).toBe(5);
    expect(row?.gaps.feel).toBe(3);
    expect(row?.gaps.feel).toBe(gapOf(2, 5));
  });

  it("computes every Gap from the two Opinions beside it, and stores none", () => {
    expect(report.rows.length).toBeGreaterThan(0);
    for (const row of report.rows) {
      expect(row.gaps.feel).toBe(gapOf(row.left.opinions.feel, row.right.opinions.feel));
      expect(row.gaps.wish).toBe(gapOf(row.left.opinions.wish, row.right.opinions.wish));
      if (row.gaps.think !== undefined) {
        expect(row.gaps.think).toBe(
          gapOf(row.left.opinions.think ?? 0, row.right.opinions.think ?? 0),
        );
      }
      if (row.gaps.guess !== undefined) {
        expect(row.gaps.guess).toBe(
          gapOf(row.left.opinions.guess ?? 0, row.right.opinions.guess ?? 0),
        );
      }
    }
    // A Gap is a difference of two scores, so it is 0..4 and never negative.
    const gaps: Gap[] = report.rows.flatMap((row) => [row.gaps.feel, row.gaps.wish]);
    expect(gaps.every((gap) => gap >= 0 && gap <= 4)).toBe(true);
  });

  it("gives Think and Guess a Gap only where both parties answered them", () => {
    const advanced = report.rows.filter((row) => row.gaps.think !== undefined);
    expect(advanced.map((row) => row.itemId)).toEqual(["aspect-time-together", "aspect-conflict"]);
    for (const row of report.rows) {
      expect(row.gaps.guess === undefined).toBe(row.gaps.think === undefined);
    }
    expect(report.rows.filter((row) => row.gaps.guess !== undefined)).toHaveLength(advanced.length);
  });
});

describe("the rendered screen", () => {
  it("renders the template's title and summary, and both parties' names", () => {
    expect(markup).toContain(template.title);
    expect(markup).toContain(template.summary);
    expect(markup).toContain(instance.parties[0].name);
    expect(markup).toContain(instance.parties[1].name);
    expect(markup).toContain("aspect-time-together");
  });

  it("carries the Feel Gap of 3 on the aspect-time-together row", () => {
    const row = markup.match(/<section[^>]*data-aspect="aspect-time-together"[^>]*>/);
    expect(row).not.toBeNull();
    expect(row?.[0]).toContain('data-feel-gap="3"');
    expect(row?.[0]).toContain('data-wish-gap="2"');
  });

  it("draws Think and Guess only on the Aspects that carry them", () => {
    const rowOf = (aspect: string) =>
      markup.match(
        new RegExp(`<section[^>]*data-aspect="${aspect}"[^>]*>[\\s\\S]*?</section>`),
      )?.[0] ?? "";

    const advanced = rowOf("aspect-time-together");
    expect(advanced).toContain(">think<");
    expect(advanced).toContain(">guess<");
    expect(advanced).toContain('data-think-gap="1"');

    const basicOnly = rowOf("aspect-housework");
    expect(basicOnly).toContain(">feel<");
    expect(basicOnly).toContain(">wish<");
    expect(basicOnly).not.toContain(">think<");
    expect(basicOnly).not.toContain(">guess<");
    expect(basicOnly).not.toContain("data-think-gap");
  });
});

describe("the slug", () => {
  it("resolves to the instance whose slug matches", () => {
    expect(instanceBySlug("avery-rowan", assessmentInstances)?.id).toBe(instance.id);
  });

  it("404s an unknown slug instead of rendering an empty assessment", async () => {
    expect(instanceBySlug("no-such-assessment", assessmentInstances)).toBeUndefined();
    await expect(
      AssessmentPage({ params: Promise.resolve({ slug: "no-such-assessment" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
