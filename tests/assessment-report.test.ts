/**
 * The assessment screen's claims, in one file:
 *
 *   1. the Gap is computed, not stored — the row where Avery's Feel is 2 and Rowan's is 5
 *      shows 3, and it is `gapOf(2, 5)` rather than a number written next to them;
 *   2. the eight Gap *kinds* are the glossary's, computed by `content/gaps.ts` — so the
 *      Think and Guess kinds are a prediction against the other party's **actual**, never
 *      the same-kind difference (`|I.think − C.think|`) the screen used to print;
 *   3. the render shows them — a Basic row carries four `data-<kind>-gap` attributes and an
 *      Advanced one carries eight, each named by the kind it computes.
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
import { gapOf } from "@/content/record";
import { MODE_LABELS } from "@/content/assessment";
import {
  ADVANCED_GAP_KINDS,
  BASIC_GAP_KINDS,
  GAP_KINDS,
  GAP_KIND_LABELS,
  GAP_KIND_SOURCES,
  gapKindsOf,
  type GapKind,
} from "@/content/gaps";
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

/** The render of one fixture: the projection, then the static markup of it. */
function renderInstance(slug: string): {
  report: ReturnType<typeof assessmentReport>;
  html: string;
} {
  const entry = instanceBySlug(slug, assessmentInstances);
  const own =
    entry === undefined
      ? undefined
      : assessments.find((candidate) => candidate.id === entry.templateId);
  if (entry === undefined || own === undefined) throw new Error(`no fixture "${slug}"`);
  const projection = assessmentReport(entry, own);
  return {
    report: projection,
    html: renderToStaticMarkup(createElement(AssessmentReportView, { report: projection })),
  };
}

/** The opening `<section …>` tag of one Aspect, where the Gap attributes live. */
function sectionOf(html: string, itemId: string): string {
  const tag = html.match(new RegExp(`<section[^>]*data-aspect="${itemId}"[^>]*>`))?.[0];
  if (tag === undefined) throw new Error(`no section for ${itemId}`);
  return tag;
}

/** How many `data-<kind>-gap` attributes a piece of markup carries. */
function gapAttributes(aHtml: string): string[] {
  return aHtml.match(/data-[a-z]+(?:-[a-z]+)*-gap=/g) ?? [];
}

const advancedSpec = renderInstance("noor-iris");

describe("the report's Gaps", () => {
  const rowOf = (from: ReturnType<typeof assessmentReport>, itemId: string) => {
    const row = from.rows.find((entry) => entry.itemId === itemId);
    if (row === undefined) throw new Error(`no row for ${itemId}`);
    return row;
  };

  it("shows a Feel Gap of 3 on aspect-time-together, because 2 against 5 is 3", () => {
    const row = rowOf(report, "aspect-time-together");

    expect(row.left.opinions.feel).toBe(2);
    expect(row.right.opinions.feel).toBe(5);
    expect(row.gaps.feel).toBe(3);
    expect(row.gaps.feel).toBe(gapOf(2, 5));
  });

  it("computes the four Basic kinds from the glossary's pairs, and stores none", () => {
    for (const row of report.rows) {
      // Feel and Wish compare the two parties; Initiator and Counterparty compare one
      // party's Feel with that same party's Wish ("desires to change").
      expect(row.gaps.feel).toBe(gapOf(row.left.opinions.feel, row.right.opinions.feel));
      expect(row.gaps.wish).toBe(gapOf(row.left.opinions.wish, row.right.opinions.wish));
      expect(row.gaps.initiator).toBe(gapOf(row.left.opinions.feel, row.left.opinions.wish));
      expect(row.gaps.counterparty).toBe(gapOf(row.right.opinions.feel, row.right.opinions.wish));
      const four = [row.gaps.feel, row.gaps.wish, row.gaps.initiator, row.gaps.counterparty];
      for (const gap of four) expect(gap).toBeGreaterThanOrEqual(0);
      for (const gap of four) expect(gap).toBeLessThanOrEqual(4);
    }
  });

  it("is gapKindsOf over the same two parties — the projection re-derives no pair inline", () => {
    for (const row of report.rows) {
      expect(row.gaps).toEqual(gapKindsOf(row.left.opinions, row.right.opinions));
    }
    for (const row of advancedSpec.report.rows) {
      expect(row.gaps).toEqual(gapKindsOf(row.left.opinions, row.right.opinions));
    }
  });

  it("carries the mode it was played in, and a Basic report has exactly four kinds", () => {
    expect(report.mode).toBe("basic");
    for (const row of report.rows) {
      expect(Object.keys(row.gaps).sort()).toEqual([...BASIC_GAP_KINDS].sort());
      for (const kind of ADVANCED_GAP_KINDS) expect(row.gaps[kind]).toBeUndefined();
      expect(row.left.opinions.think).toBeUndefined();
      expect(row.right.opinions.think).toBeUndefined();
    }
  });

  /**
   * The Advanced fixture, through the same projection: eight kinds on every Aspect, and
   * these are the numbers this card quotes (hand-computed from the fixture, and pinned a
   * second time under plain node by `scripts/__tests__/gaps.test.ts`).
   */
  it("gives an Advanced instance eight kinds on every Aspect, and these are the numbers", () => {
    expect(advancedSpec.report.mode).toBe("advanced");
    expect(advancedSpec.report.rows).toHaveLength(5);

    const expected: Record<string, Record<GapKind, number>> = {
      "aspect-check-ins": {
        feel: 1,
        wish: 2,
        initiator: 2,
        counterparty: 1,
        "initiator-think": 0,
        "initiator-guess": 1,
        "counterparty-think": 0,
        "counterparty-guess": 1,
      },
      "aspect-house-rules": {
        feel: 3,
        wish: 2,
        initiator: 2,
        counterparty: 3,
        "initiator-think": 2,
        "initiator-guess": 1,
        "counterparty-think": 2,
        "counterparty-guess": 1,
      },
      "aspect-trust": {
        feel: 1,
        wish: 2,
        initiator: 0,
        counterparty: 1,
        "initiator-think": 0,
        "initiator-guess": 2,
        "counterparty-think": 0,
        "counterparty-guess": 3,
      },
      "aspect-one-to-one": {
        feel: 2,
        wish: 3,
        initiator: 3,
        counterparty: 2,
        "initiator-think": 1,
        "initiator-guess": 2,
        "counterparty-think": 3,
        "counterparty-guess": 3,
      },
      "aspect-privacy": {
        feel: 1,
        wish: 3,
        initiator: 1,
        counterparty: 1,
        "initiator-think": 2,
        "initiator-guess": 1,
        "counterparty-think": 0,
        "counterparty-guess": 3,
      },
    };

    for (const row of advancedSpec.report.rows) {
      expect({ ...row.gaps }, row.itemId).toEqual(expected[row.itemId]);
    }

    const first = rowOf(advancedSpec.report, "aspect-check-ins");
    expect(first.left.opinions).toEqual({ feel: 3, wish: 5, think: 4, guess: 2 });
    expect(first.right.opinions).toEqual({ feel: 4, wish: 3, think: 3, guess: 4 });
    expect({ ...first.gaps }).toEqual({
      feel: 1,
      wish: 2,
      initiator: 2,
      counterparty: 1,
      "initiator-think": 0,
      "initiator-guess": 1,
      "counterparty-think": 0,
      "counterparty-guess": 1,
    });
  });

  /**
   * The card's central claim, stated with the three numbers it asks for: the prediction,
   * the actual, and the kind they make — beside the same-kind difference that is a
   * different number and is not a glossary kind at all.
   */
  it("measures a prediction against the other party's actual, not against their prediction", () => {
    /** Every fixture that reaches this case answers Think on both sides. */
    const score = (value: number | undefined): number => {
      if (value === undefined) throw new Error("this fixture has no Think to compare");
      return value;
    };

    // aspect-privacy: Iris thought 3 about how Noor feels; Noor actually feels 3.
    const privacy = rowOf(advancedSpec.report, "aspect-privacy");
    expect(privacy.right.opinions.think).toBe(3);
    expect(privacy.left.opinions.feel).toBe(3);
    expect(privacy.gaps["counterparty-think"]).toBe(0);

    // The same-kind difference the screen used to print —
    // |Iris's think − Noor's think| = |3 − 2| = 1 — is a number the glossary never defines.
    expect(privacy.left.opinions.think).toBe(2);
    expect(gapOf(score(privacy.right.opinions.think), score(privacy.left.opinions.think))).toBe(1);
    expect(privacy.gaps["counterparty-think"]).not.toBe(1);

    // And the Initiator Think Gap on aspect-check-ins: Noor thought 4, Iris felt 4 → 0,
    // while Noor's think against Iris's think (3) is 1.
    const checkIns = rowOf(advancedSpec.report, "aspect-check-ins");
    expect(checkIns.left.opinions.think).toBe(4);
    expect(checkIns.right.opinions.feel).toBe(4);
    expect(checkIns.gaps["initiator-think"]).toBe(0);
    expect(gapOf(score(checkIns.left.opinions.think), score(checkIns.right.opinions.think))).toBe(
      1,
    );
  });

  it("pairs every kind with the two Opinions the glossary names", () => {
    // The screen draws from this table, so this case is what keeps a line labelled
    // "Initiator Think Gap" from subtracting two Think scores.
    expect(
      GAP_KIND_SOURCES.map(
        (source) =>
          `${source.kind}: ${source.left.party}.${source.left.opinion} vs ${source.right.party}.${source.right.opinion}`,
      ),
    ).toEqual([
      "feel: initiator.feel vs counterparty.feel",
      "wish: initiator.wish vs counterparty.wish",
      "initiator: initiator.feel vs initiator.wish",
      "counterparty: counterparty.feel vs counterparty.wish",
      "initiator-think: initiator.think vs counterparty.feel",
      "initiator-guess: initiator.guess vs counterparty.wish",
      "counterparty-think: counterparty.think vs initiator.feel",
      "counterparty-guess: counterparty.guess vs initiator.wish",
    ]);
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

  it("carries all four Basic Gaps on the aspect-time-together row", () => {
    const tag = sectionOf(markup, "aspect-time-together");
    expect(tag).toContain('data-feel-gap="3"');
    expect(tag).toContain('data-wish-gap="2"');
    // Initiator: Avery feels 2, wishes 5 → 3. Counterparty: Rowan feels 5, wishes 3 → 2.
    expect(tag).toContain('data-initiator-gap="3"');
    expect(tag).toContain('data-counterparty-gap="2"');
    expect(gapAttributes(tag)).toHaveLength(4);
  });

  it("draws four Gap lines on a Basic Aspect and never a Think or a Guess one", () => {
    const section = markup.match(
      /<section[^>]*data-aspect="aspect-time-together"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    if (section === undefined) throw new Error("the Basic fixture draws no row");
    const tags = section;
    expect(tags).toContain(">Feel Gap<");
    expect(tags).toContain(">Wish Gap<");
    expect(tags).toContain(">Initiator Gap<");
    expect(tags).toContain(">Counterparty Gap<");
    for (const label of [
      "Initiator Think Gap",
      "Initiator Guess Gap",
      "Counterparty Think Gap",
      "Counterparty Guess Gap",
    ]) {
      expect(tags).not.toContain(label);
    }
    expect(tags).not.toContain("data-initiator-think-gap");
    expect(tags).not.toContain("data-counterparty-think-gap");
    // Every attribute is named by the kind it computes, so the set is exactly the four
    // Basic kinds — there is no leftover attribute meaning "two Think scores differ".
    expect([...tags.matchAll(/data-([a-z-]+)-gap=/g)].map((match) => match[1])).toEqual([
      ...BASIC_GAP_KINDS,
    ]);

    expect(markup).toContain('data-mode="basic"');
    expect(markup).toContain(MODE_LABELS.basic);
    expect(markup).not.toContain(MODE_LABELS.advanced);
  });

  it("counts four gap attributes per Aspect on a Basic report, and twenty on the page", () => {
    for (const row of report.rows) {
      expect(gapAttributes(sectionOf(markup, row.itemId)), row.itemId).toHaveLength(
        BASIC_GAP_KINDS.length,
      );
    }
    expect(gapAttributes(markup)).toHaveLength(BASIC_GAP_KINDS.length * report.rows.length);
    expect(report.rows).toHaveLength(5);
  });

  it("draws all eight Gap lines and names Advanced Mode on the Advanced fixture", () => {
    expect(advancedSpec.html).toContain('data-mode="advanced"');
    expect(advancedSpec.html).toContain(MODE_LABELS.advanced);
    for (const kind of GAP_KINDS) {
      expect(advancedSpec.html, kind).toContain(`${GAP_KIND_LABELS[kind]}<`);
    }

    // aspect-check-ins: feel gapOf(3,4)=1, wish gapOf(5,3)=2, initiator |3−5|=2,
    // counterparty |4−3|=1, Noor's think 4 vs Iris's feel 4 → 0, Noor's guess 2 vs
    // Iris's wish 3 → 1, Iris's think 3 vs Noor's feel 3 → 0, Iris's guess 4 vs
    // Noor's wish 5 → 1.
    const tag = sectionOf(advancedSpec.html, "aspect-check-ins");
    expect(tag).toContain('data-feel-gap="1"');
    expect(tag).toContain('data-wish-gap="2"');
    expect(tag).toContain('data-initiator-gap="2"');
    expect(tag).toContain('data-counterparty-gap="1"');
    expect(tag).toContain('data-initiator-think-gap="0"');
    expect(tag).toContain('data-initiator-guess-gap="1"');
    expect(tag).toContain('data-counterparty-think-gap="0"');
    expect(tag).toContain('data-counterparty-guess-gap="1"');
    expect(gapAttributes(tag)).toHaveLength(GAP_KINDS.length);
  });

  it("counts eight gap attributes per Aspect on an Advanced report, and forty on the page", () => {
    for (const row of advancedSpec.report.rows) {
      expect(gapAttributes(sectionOf(advancedSpec.html, row.itemId)), row.itemId).toHaveLength(
        GAP_KINDS.length,
      );
    }
    expect(gapAttributes(advancedSpec.html)).toHaveLength(
      GAP_KINDS.length * advancedSpec.report.rows.length,
    );
  });

  it("names the two Opinions each line compares, so a prediction line is not two column scores", () => {
    const row = advancedSpec.html.match(
      /<section[^>]*data-aspect="aspect-check-ins"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    if (row === undefined) throw new Error("the Advanced fixture draws no row");
    // "Noor Think" against "Iris Feel" — the pair an Initiator Think Gap is.
    expect(row).toContain(
      '<span class="font-medium text-gray-700 dark:text-gray-300">Noor</span> <span>Think</span>',
    );
    expect(row).toContain(
      '<span class="font-medium text-gray-700 dark:text-gray-300">Iris</span> <span>Feel</span>',
    );
    // And an agreed Gap prints the glossary's word rather than a 0.
    expect(row).toContain("In synch");
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
      // Every instance draws four kinds per Aspect, or eight when it is Advanced.
      const perAspect = entry.mode === "advanced" ? GAP_KINDS.length : BASIC_GAP_KINDS.length;
      expect(gapAttributes(html), `${entry.slug} (${entry.mode})`).toHaveLength(
        perAspect * entry.items.length,
      );
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
