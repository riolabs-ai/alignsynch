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
 *
 * The page reads through `lib/db/assessments.ts` (#145). That module is mocked here — one
 * `readAssessmentScreenBySlug` — so this file stays a test of the **screen**: what it draws
 * for the rows it is given, and that a slug it cannot resolve is a 404. The read layer's own
 * behaviour (a row set that fails the schema) is `tests/db-rows.test.ts`, and the live rows are
 * `pnpm db:verify`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { screenFor } = vi.hoisted(() => ({ screenFor: vi.fn() }));

vi.mock("@/lib/db/assessments", () => ({
  readAssessmentScreenBySlug: screenFor,
}));

import AssessmentPage, {
  dynamic as routeDynamic,
  generateMetadata,
} from "@/app/(mainlayout)/assessment/[slug]/page";
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { gapOf, type Gap } from "@/content/record";
import { assessmentInstances, assessments } from "@/data/assessments";
import { assessmentReport, instanceBySlug } from "@/lib/assessment-report";

/** React escapes the characters it writes as markup; a title carrying `&` arrives escaped. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const instance = instanceBySlug("avery-rowan", assessmentInstances);
const template = instance
  ? assessments.find((entry) => entry.id === instance.templateId)
  : undefined;

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

  /**
   * The fixture grew four instances after this screen was written (three Relationship
   * Types, one template with no instances). A projection that only draws the record its
   * test was written for would pass every case above and blank `/assessment/ruth-sam`,
   * so every instance is rendered here and counted against its own Aspects.
   */
  it("renders every instance in the fixture, not only the one this file names", () => {
    expect(assessmentInstances.length).toBeGreaterThan(1);
    for (const entry of assessmentInstances) {
      const own = assessments.find((candidate) => candidate.id === entry.templateId);
      expect(own, `${entry.slug} names no template`).toBeDefined();
      if (own === undefined) continue;

      const html = renderToStaticMarkup(
        createElement(AssessmentReportView, { report: assessmentReport(entry, own) }),
      );
      // React escapes the markup it writes, so a title with an `&` in it ("Parent & Child")
      // is the escaped string on the wire; compare against the same escaping.
      expect(html).toContain(escapeHtml(own.title));
      for (const party of entry.parties) expect(html).toContain(escapeHtml(party.name));
      expect((html.match(/<section /g) ?? []).length).toBe(entry.items.length);
    }
  });
});

describe("the slug", () => {
  it("resolves to the instance whose slug matches", () => {
    expect(instanceBySlug("avery-rowan", assessmentInstances)?.id).toBe(instance.id);
  });

  /** The read is a request-time database read: no `generateStaticParams`, no prerender (#145). */
  it("is request-time, so a build never needs a database", () => {
    expect(routeDynamic).toBe("force-dynamic");
  });

  it("404s an unknown slug instead of rendering an empty assessment", async () => {
    screenFor.mockResolvedValue(undefined);

    await expect(
      AssessmentPage({ params: Promise.resolve({ slug: "no-such-assessment" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s an instance whose template no longer resolves", async () => {
    // What the read layer returns for that case is `undefined`: the page has no second source
    // for the title, so a broken copy is a 404 rather than a report with no words above it.
    screenFor.mockResolvedValue(undefined);

    await expect(
      AssessmentPage({ params: Promise.resolve({ slug: "avery-rowan" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders both names from the rows it is handed, for the slug it asked for", async () => {
    screenFor.mockResolvedValue({ instance, template });

    const html = renderToStaticMarkup(
      await AssessmentPage({ params: Promise.resolve({ slug: "avery-rowan" }) }),
    );

    expect(screenFor).toHaveBeenCalledWith("avery-rowan");
    expect(html).toContain(escapeHtml(instance.parties[0].name));
    expect(html).toContain(escapeHtml(instance.parties[1].name));
    expect(html).toContain(escapeHtml(template.title));
  });
});

/**
 * The third answer (#204): the database did not answer.
 *
 * Before this, that state reached the browser as Next's `<h1>500</h1>` and a digest — no
 * sentence, no slug, nothing a reader could act on, on the one screen that proves the product
 * works. The panel is the fix, and these cases are what keep it from regressing into a spinner,
 * an empty report, or a swallowed defect.
 */
describe("when the database does not answer (#204)", () => {
  const reason =
    "The assessment database did not answer within 4s. This page reads it on every request, so there is nothing to show until it answers — reload in a moment.";

  it("renders the unreadable panel instead of a 500 with a digest", async () => {
    screenFor.mockRejectedValueOnce(new DatabaseUnavailableError(reason));

    const html = renderToStaticMarkup(
      await AssessmentPage({ params: Promise.resolve({ slug: "avery-rowan" }) }),
    );

    // The panel names the slug it could not read and prints the database layer's sentence.
    expect(html).toContain('data-assessment-unreadable="avery-rowan"');
    expect(html).toContain(reason);
    // No assessment is drawn from a failed read: not a row, and not the "In synch" a Gap of 0
    // prints, which is what an empty report would have said about two people's answers.
    expect(html).not.toContain("data-aspect=");
    expect(html).not.toContain("In synch");
    // And no spinner: the page is not still coming.
    expect(html).not.toContain("animate-spin");
  });

  it("says the same thing in the metadata, instead of claiming the assessment does not exist", async () => {
    screenFor.mockRejectedValueOnce(new DatabaseUnavailableError(reason));

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "avery-rowan" }) });

    expect(metadata.title).toBe("This assessment could not be read");
    expect(metadata.description).toBe(reason);
  });

  it("still throws a row that does not parse — a defect is not an outage", async () => {
    screenFor.mockRejectedValueOnce(new Error("assessment instance row failed the model"));

    await expect(
      AssessmentPage({ params: Promise.resolve({ slug: "avery-rowan" }) }),
    ).rejects.toThrow("failed the model");
  });
});
