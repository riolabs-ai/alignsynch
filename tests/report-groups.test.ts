/**
 * The report's presentation (#274), as markup: three headings, real tables, numbers in text,
 * a bar with the Setting's tick, and one verdict band above the cards.
 *
 * The report used to be eight flat lines per Aspect. What this file pins is the change the
 * issue asks for and the four things it forbids:
 *
 *   groups    the spec's own three headings, two on a Basic instance and three on an
 *             Advanced one — and **no** empty Prediction table on a Basic instance;
 *   tables    a real `<table>` per group, with a `<caption>` and a `<th scope="row">` per Gap,
 *             so a row announces as row-header + cells rather than as a paragraph of numbers;
 *   numbers   every Gap is text in its cell, a 0 prints "In Synch" beside it, and the bar is a
 *             second channel that also carries the number in its own label (WCAG 1.4.1);
 *   tick      the Setting's tolerance drawn on every bar, 1 for Soft and 0 for Full, so the
 *             same numbers read differently under the two Settings;
 *   verdict   one band, "Aligned under Soft" or "{n} Gaps exceed Soft …", derived from the same
 *             Gaps the rows below print;
 *   no score  no total, average, composite or percentage anywhere in the markup — the model
 *             has no such number, and inventing one is the failure this card exists to avoid.
 *
 * The fixtures are the two the acceptance names: `avery-rowan` (Basic, five Aspects, no
 * prediction rows) and `noor-iris` (Advanced, five Aspects, four prediction rows each), plus
 * `ruth-sam` (every Gap 0 under Soft — the aligned verdict) and `marco-priya` (Gaps 1–4 — the
 * unmet sentence and the widest Gap).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { assessments, assessmentInstances } from "@/data/assessments";
import {
  ADVANCED_GAP_KINDS,
  BASIC_GAP_KINDS,
  GAP_GROUPS,
  GAP_KINDS,
  GAP_KIND_LABELS,
  gapKindsIn,
  type GapKind,
} from "@/content/gaps";
import type { AssessmentReport } from "@/lib/assessment-report";
import { assessmentReport, instanceBySlug } from "@/lib/assessment-report";

/** The projection and its markup for one fixture slug. */
function render(slug: string): { report: AssessmentReport; html: string } {
  const instance = instanceBySlug(slug, assessmentInstances);
  if (instance === undefined) throw new Error(`no instance fixture "${slug}"`);
  const template = assessments.find((entry) => entry.id === instance.templateId);
  if (template === undefined) throw new Error(`no template for "${slug}"`);
  const report = assessmentReport(instance, template);
  return { report, html: renderToStaticMarkup(createElement(AssessmentReportView, { report })) };
}

/** One Aspect card's markup, from its `<section` to the close of that card. */
function aspectSection(html: string, itemId: string): string {
  const match = html.match(new RegExp(`<section data-aspect="${itemId}"[\\s\\S]*?</section>`));
  if (match === null) throw new Error(`no aspect section "${itemId}" in the render`);
  return match[0];
}

const basic = render("avery-rowan");
const advanced = render("noor-iris");
const aligned = render("ruth-sam");
const unmet = render("marco-priya");

describe("the gap groups", () => {
  it("is the specification's three headings, in its order", () => {
    expect(GAP_GROUPS.map((group) => group.heading)).toEqual([
      "Feelings and Wishes Differ",
      "Desires To Change",
      "Prediction Gaps and Analysis",
    ]);
  });

  it("draws three groups on an Advanced Aspect and two on a Basic one", () => {
    const advancedCard = aspectSection(advanced.html, "aspect-check-ins");
    for (const group of GAP_GROUPS) {
      expect(advancedCard).toContain(`>${group.heading}</h3>`);
    }

    const basicCard = aspectSection(basic.html, "aspect-time-together");
    expect(basicCard).toContain(">Feelings and Wishes Differ</h3>");
    expect(basicCard).toContain(">Desires To Change</h3>");
    // The Basic instance has no prediction, so no third heading and no empty table under one.
    expect(basicCard).not.toContain("Prediction Gaps and Analysis");
    expect(basicCard).not.toContain('data-gap-group="prediction-gaps"');
  });

  it("draws exactly one table per group, and never one with no rows", () => {
    const advancedCard = aspectSection(advanced.html, "aspect-check-ins");
    expect((advancedCard.match(/<table/g) ?? []).length).toBe(GAP_GROUPS.length);

    const basicCard = aspectSection(basic.html, "aspect-time-together");
    expect((basicCard.match(/<table/g) ?? []).length).toBe(GAP_GROUPS.length - 1);
    // Five Aspects, two tables each, on the Basic report.
    expect((basic.html.match(/<table/g) ?? []).length).toBe(
      (GAP_GROUPS.length - 1) * basic.report.rows.length,
    );
  });

  it("gives every table a caption and every row a row header", () => {
    for (const slug of [basic, advanced]) {
      for (const row of slug.report.rows) {
        const card = aspectSection(slug.html, row.itemId);
        const tables = (card.match(/<table/g) ?? []).length;
        const kinds = gapKindsIn(row.gaps).length;
        expect(card).toContain("<caption");
        // One caption per table, one row header per Gap, and three column headers per table.
        expect((card.match(/<caption/g) ?? []).length).toBe(tables);
        expect((card.match(/<th scope="row"/g) ?? []).length).toBe(kinds);
        expect((card.match(/<th scope="col"/g) ?? []).length).toBe(3 * tables);
      }
    }
  });

  it("keeps the glossary order inside a group, so positions are stable across visits", () => {
    const card = aspectSection(advanced.html, "aspect-check-ins");
    const rowHeaders = [...card.matchAll(/<th scope="row"[^>]*>([^<]+)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(rowHeaders).toEqual([
      ...["feel", "wish", "initiator", "counterparty"].map(
        (kind) => GAP_KIND_LABELS[kind as GapKind],
      ),
      ...ADVANCED_GAP_KINDS.map((kind) => GAP_KIND_LABELS[kind]),
    ]);
  });
});

describe("the numbers", () => {
  it("prints every Gap as text in its own cell, never only as a bar", () => {
    for (const rendered of [basic, advanced]) {
      for (const row of rendered.report.rows) {
        const card = aspectSection(rendered.html, row.itemId);
        const printed = [...card.matchAll(/data-gap-number="(\d)"[^>]*>\1<\/span>/g)].map((match) =>
          Number(match[1]),
        );
        expect(printed, row.itemId).toEqual(gapKindsIn(row.gaps).map((kind) => row.gaps[kind]));
      }
    }
  });

  it("prints In Synch beside a Gap of 0, so an empty bar is not an unrendered one", () => {
    const card = aspectSection(basic.html, "aspect-money");
    expect(card).toContain('data-feel-gap="0"');
    expect(card).toContain(
      '0</span><span class="text-xs text-gray-600 dark:text-gray-300">In Synch</span>',
    );
  });

  it("draws no prediction number on a Basic instance — not a zero, not a dash", () => {
    for (const row of basic.report.rows) {
      const card = aspectSection(basic.html, row.itemId);
      for (const kind of ADVANCED_GAP_KINDS) {
        expect(card).not.toContain(`data-${kind}-gap`);
        expect(card).not.toContain(GAP_KIND_LABELS[kind]);
      }
    }
    // And the twenty Basic numbers the card's schema allows are the twenty that print.
    expect((basic.html.match(/data-gap-number=/g) ?? []).length).toBe(
      BASIC_GAP_KINDS.length * basic.report.rows.length,
    );
    expect((advanced.html.match(/data-gap-number=/g) ?? []).length).toBe(
      GAP_KINDS.length * advanced.report.rows.length,
    );
  });

  it("labels the bar with the number and the Setting's tolerance, not with colour alone", () => {
    const card = aspectSection(basic.html, "aspect-time-together");
    expect(card).toContain(
      'aria-label="Feel Gap: a Gap of 3 out of 4. Soft tolerates a Gap of 1."',
    );
    // Every bar carries the tick of the Setting it was read under.
    expect((card.match(/data-tolerance-tick="1"/g) ?? []).length).toBe(
      gapKindsIn(basic.report.rows[0].gaps).length,
    );

    const fullCard = aspectSection(advanced.html, "aspect-check-ins");
    expect((fullCard.match(/data-tolerance-tick="0"/g) ?? []).length).toBe(
      gapKindsIn(advanced.report.rows[0].gaps).length,
    );
    expect(fullCard).toContain("Full tolerates a Gap of 0.");
  });

  it("draws the bar's length from the Gap: 0, a quarter, a half, three quarters, full", () => {
    const widths = new Map<string, string>();
    // `marco-priya` is the only fixture with a Gap of 4, so all five lengths need it in the set.
    for (const rendered of [basic, advanced, unmet]) {
      for (const row of rendered.report.rows) {
        const card = aspectSection(rendered.html, row.itemId);
        for (const match of card.matchAll(/data-bar-fill="(\d)"[^>]*style="width:([\d.]+%)"/g)) {
          widths.set(match[1], match[2]);
        }
      }
    }
    expect(Object.fromEntries(widths)).toEqual({
      "0": "0%",
      "1": "25%",
      "2": "50%",
      "3": "75%",
      "4": "100%",
    });
  });
});

describe("the verdict band", () => {
  it("is drawn once, above the cards, and names the Setting it was read under", () => {
    for (const rendered of [basic, advanced, aligned, unmet]) {
      expect((rendered.html.match(/data-verdict=/g) ?? []).length).toBe(1);
      // Above the first card: the band's attribute precedes the first `data-aspect`.
      expect(rendered.html.indexOf("data-verdict=")).toBeLessThan(
        rendered.html.indexOf('data-aspect="'),
      );
    }
    expect(aligned.html).toContain('data-setting="soft"');
    expect(advanced.html).toContain('data-setting="full"');
  });

  it("says Aligned under the Setting when every Gap meets it", () => {
    expect(aligned.report.verdict.aligned).toBe(true);
    expect(aligned.html).toContain('data-verdict="aligned"');
    expect(aligned.html).toContain("Aligned under Soft — every Gap on this report meets it.");
    expect(aligned.html).toContain("Soft Setting: Small Gap (1) OK – a satisfactory Setting.");
  });

  /** The Advanced fixture under Full: 34 unmet Gaps, the widest a Gap of 3 on house rules. */
  it("says how many Gaps exceed the Setting, and which is widest, when they do", () => {
    expect(advanced.report.verdict.aligned).toBe(false);
    expect(advanced.html).toContain('data-verdict="unmet"');
    expect(advanced.html).toContain('data-unmet-gaps="34"');
    expect(advanced.html).toContain(
      "34 Gaps exceed Full. The widest is a Gap of 3 on How are the house rules agreed?",
    );
    expect(advanced.html).toContain("Full Setting: No Gap OK – an exceptional Setting.");
  });

  it("uses the singular sentence for exactly one unmet Gap", () => {
    // `marco-priya` has twelve; the singular branch is what a one-Gap instance draws, and the
    // copy fixture holds both because no placeholder can pluralise an English noun.
    expect(unmet.html).toContain('data-unmet-gaps="12"');
    expect(unmet.html).toContain("12 Gaps exceed Soft. The widest is a Gap of 4 on How is the");
    expect(unmet.html).not.toContain("1 Gap exceeds");
  });

  it("derives the verdict from the rows it draws, so the two cannot disagree", () => {
    for (const rendered of [basic, advanced, aligned, unmet]) {
      const unmetFromRows = rendered.report.rows
        .flatMap((row) => gapKindsIn(row.gaps).map((kind) => row.gaps[kind] ?? 0))
        .filter((gap) => gap > rendered.report.settingLimit).length;
      expect(rendered.report.verdict.unmet.length, rendered.report.slug).toBe(unmetFromRows);
      expect(rendered.report.verdict.aligned).toBe(unmetFromRows === 0);
    }
  });

  it("names the widest Gap the rows actually contain", () => {
    // Marco and Priya disagree by 4 on the workload Aspect, which is the widest on that report.
    expect(unmet.report.widest).toEqual({
      itemId: "aspect-workload",
      prompt: "How is the workload split between the two of you?",
      kind: "feel",
      gap: 4,
    });
    expect(aligned.report.widest).toBeNull();
  });
});

describe("what the report never adds", () => {
  it("has no total, average, composite or percentage score in the markup", () => {
    for (const rendered of [basic, advanced, aligned, unmet]) {
      expect(rendered.html).not.toMatch(/average|composite|overall score|percent/i);
      // "total" only ever appears inside a class name ("tabular-nums" is not it) — this asserts
      // the word is not printed as a metric anywhere on the page.
      expect(rendered.html).not.toMatch(/>[^<]*\btotal\b[^<]*</i);
    }
  });

  it("keeps Doubt out: the eight kinds are the glossary's, and no ninth was added", () => {
    expect(GAP_KINDS).toHaveLength(8);
    expect(basic.html).not.toMatch(/Doubt/);
    expect(advanced.html).not.toMatch(/Doubt/);
  });
});
