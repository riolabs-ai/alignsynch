/**
 * The project spec's reader (#1252) — the register, the submenu, the matrix, the story page and the
 * honest panel.
 *
 * **What these cases are for.** The card's acceptance names four behaviours and a set of rules that
 * a screenshot cannot check: the pinned group's `aria-expanded`, the four section counts, a story
 * page rendering its four bands, the missing-file panel, the absence of red, and the absence of
 * agreement quotes in the committed register. Each is a separate case below, and the counts are
 * read from `data/spec/validation.json` — the same file the page reads — so a regenerated register
 * that changes a figure fails here instead of silently rewriting the page.
 *
 * The register's own figures (28 / 20 / 13 / 27, 44 of 76 met, the four scope meters) are pinned
 * **here and not in `data:check`**: they are the agreement's numbers, they move when the agreement
 * moves, and a diff that changes them should be reviewed rather than blocked. `data:check` E42
 * pins the properties that must never change — schema, unique IDs, every group reachable,
 * quote-free — and this file pins today's totals.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpecFrame } from "@/components/admin/spec/spec-frame";
import { SpecNotice } from "@/components/admin/spec/spec-notice";
import { SpecSubmenu } from "@/components/admin/spec/spec-submenu";
import { StoryPage } from "@/components/admin/spec/story-page";
import { ValidationMatrix } from "@/components/admin/spec/validation-matrix";
import {
  SPEC_STATUS_MARKS,
  SPEC_STATUSES,
  SPEC_STORY_GROUPS,
  specBeyondRows,
  specSectionsOf,
  specStoryRows,
  specTotalsOf,
  type SpecValidation,
} from "@/content/spec";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import {
  readSpecValidation,
  readSpecValidationSafe,
  SpecUnreadable,
  SPEC_VALIDATION_SOURCE,
} from "@/lib/spec/file";
import { specEvidenceLink } from "@/lib/spec/evidence";

const copy = adminSpecPageCopy;

/** The committed register, through the same reader the page uses. */
function register(): SpecValidation {
  return readSpecValidation();
}

/** Every class token in a rendered tree — the surface's whole vocabulary of colour. */
function classes(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1].split(/\s+/));
}

describe("the register", () => {
  it("reads 88 rows, and the four section counts are the agreement's own", () => {
    const doc = register();
    expect(doc.rows.length).toBe(88);
    expect(specSectionsOf(doc.rows).map((section) => section.rows)).toEqual([28, 20, 13, 27]);
  });

  it("counts 44 of 76 met, over the eleven stories and not the twelve beyond them", () => {
    const doc = register();
    const storyRows = specStoryRows(doc);
    expect(specBeyondRows(doc).length).toBe(12);
    expect(storyRows.length).toBe(76);
    expect(specTotalsOf(storyRows)).toEqual({ met: 44, total: 76, percent: 58 });
  });

  it("carries the four scopes the status box meters", () => {
    const doc = register();
    const storyRows = specStoryRows(doc);
    const scopeOf = (prefix: string) =>
      specTotalsOf(storyRows.filter((row) => row.id.startsWith(`${prefix}-`)));
    expect(scopeOf("WEB")).toMatchObject({ met: 7, total: 13 });
    expect(scopeOf("APP")).toMatchObject({ met: 30, total: 50 });
    expect(scopeOf("ADMIN")).toMatchObject({ met: 5, total: 7 });
    expect(scopeOf("OPS")).toMatchObject({ met: 2, total: 6 });
  });

  it("gives every one of the eleven stories at least one row", () => {
    const doc = register();
    expect(SPEC_STORY_GROUPS.length).toBe(11);
    for (const story of SPEC_STORY_GROUPS) {
      expect(
        doc.rows.filter((row) => row.group === story.name).length,
        `${story.name} has no row`,
      ).toBeGreaterThan(0);
    }
  });

  it("is the quote-free projection — no quote value, and no file that could carry one", () => {
    const text = readFileSync(join(process.cwd(), SPEC_VALIDATION_SOURCE), "utf8");
    const doc = register();
    expect(doc.quotesIncluded).toBe(false);
    expect(doc.rows.every((row) => row.quote === null)).toBe(true);
    expect(text).toContain('"quotesIncluded": false');
    expect(text.match(/"quote": null/g)?.length).toBe(doc.rows.length);
    // The one shape that would mean somebody committed the private file.
    expect(text).not.toContain('"quotesIncluded": true');
  });
});

describe("the submenu", () => {
  it("pins Validation with aria-expanded and offers no control that could collapse it", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecSubmenu, { copy, doc: register(), current: { kind: "validation" } }),
    );
    const pinned = markup.slice(markup.indexOf("data-pinned"));
    expect(pinned).toContain('aria-expanded="true"');
    // The group, the rail and the page: no disclosure anywhere in this navigation.
    expect(markup).not.toContain("<button");
    expect(markup.match(/aria-expanded/g)?.length).toBe(1);
  });

  it("marks the current page, and only it", () => {
    const doc = register();
    const validation = renderToStaticMarkup(
      createElement(SpecSubmenu, { copy, doc, current: { kind: "validation" } }),
    );
    expect(validation.match(/aria-current="page"/g)?.length).toBe(1);
    expect(validation).toMatch(
      /aria-expanded="true"[^>]*aria-current="page"|aria-current="page"[^>]*aria-expanded="true"/,
    );

    const story = renderToStaticMarkup(
      createElement(SpecSubmenu, {
        copy,
        doc,
        current: { kind: "story", slug: "07-plans-and-billing" },
      }),
    );
    expect(story.match(/aria-current="page"/g)?.length).toBe(1);
    const current = story.split("<").find((tag) => tag.includes('aria-current="page"')) ?? "";
    expect(current).toContain("07-plans-and-billing");
  });

  it("lists the eleven stories in the agreement's order, each with its met/total", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecSubmenu, { copy, doc: register(), current: { kind: "overview" } }),
    );
    const order = [...markup.matchAll(/data-spec-story="([^"]+)"/g)].map((match) => match[1]);
    expect(order).toEqual(SPEC_STORY_GROUPS.map((story) => story.slug));
    // Validation's own count, then one row's — 44 of the 76 story rows, and 5 of Plans and Billing's 7.
    expect(markup).toContain("44/76");
    expect(markup).toContain("5/7");
  });
});

describe("the Validation matrix", () => {
  it("draws the four sections in order with 28 / 20 / 13 / 27 rows", () => {
    const markup = renderToStaticMarkup(createElement(ValidationMatrix, { copy, doc: register() }));
    const sections = [
      ...markup.matchAll(/data-spec-section="(\d+)" data-spec-section-rows="(\d+)"/g),
    ];
    expect(sections.map((match) => [match[1], match[2]])).toEqual([
      ["1", "28"],
      ["2", "20"],
      ["3", "13"],
      ["4", "27"],
    ]);
    expect(markup.match(/data-spec-row="/g)?.length).toBe(88);
  });

  it("draws every status as an icon plus a word, never colour alone", () => {
    const markup = renderToStaticMarkup(createElement(ValidationMatrix, { copy, doc: register() }));
    const chips = [...markup.matchAll(/data-spec-status="([^"]+)"/g)].map((match) => match[1]);
    // One chip per row, plus the six-status legend the matrix heads its right column with.
    expect(chips.length).toBe(register().rows.length + 6);
    for (const status of chips) {
      // A word, not a token: the chip carries the register's own status name, spaces and all.
      expect(status).toMatch(/^[A-Z][A-Za-z -]+$/);
      expect(SPEC_STATUSES).toContain(status);
    }
    // The mark and the word in the same chip: the glyphs are the fixture's record of them.
    for (const mark of Object.values(SPEC_STATUS_MARKS)) {
      expect(markup).toContain(mark);
    }
    // Review and approval are Pending, in words.
    expect(markup).toContain("Pending");
  });

  it("links every code citation to main at the register's recorded sha", () => {
    const doc = register();
    const markup = renderToStaticMarkup(createElement(ValidationMatrix, { copy, doc }));
    const cited = [...markup.matchAll(/href="(https:\/\/github\.com\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(cited.length).toBeGreaterThan(0);
    for (const href of cited) {
      expect(href).toContain(`/blob/${doc.main}/`);
    }
    // A citation with a line becomes an anchor, and one without stays a bare path.
    expect(specEvidenceLink({ kind: "code", ref: "lib/x.ts:12" }, doc.main).href).toBe(
      `https://github.com/riolabs-ai/alignsynch/blob/${doc.main}/lib/x.ts#L12`,
    );
    expect(specEvidenceLink({ kind: "code", ref: "lib/x.ts" }, doc.main).href).toBe(
      `https://github.com/riolabs-ai/alignsynch/blob/${doc.main}/lib/x.ts`,
    );
  });

  it("uses no red hue anywhere in the rendered tree", () => {
    const markup = renderToStaticMarkup(createElement(ValidationMatrix, { copy, doc: register() }));
    const red = classes(markup).filter((token) =>
      /\b(?:bg|text|border|ring|from|to)-(red|rose)\b/.test(token),
    );
    expect(red).toEqual([]);
  });
});

describe("a story page", () => {
  it("renders its four bands in the agreement's order", () => {
    const doc = register();
    const story = SPEC_STORY_GROUPS.find((group) => group.name === "Plans and Billing");
    expect(story).toBeDefined();
    const markup = renderToStaticMarkup(
      createElement(StoryPage, { copy, doc, story: story ?? null }),
    );
    expect(markup).toContain("Plans and Billing");
    const order = ["Agreed", "v2.0 Today", "Status", "Evidence"].map((heading) =>
      markup.indexOf(`>${heading}<`),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The group's own chips are its counts: Delivered 2 · Partial 1 · Offset 3 · Tentative 1.
    expect(markup).toContain("Delivered 2");
    expect(markup).toContain("Offset 3");
  });

  it("says the agreement holds no mockup rather than leaving the panel blank", () => {
    const doc = register();
    const story = SPEC_STORY_GROUPS[6];
    const markup = renderToStaticMarkup(createElement(StoryPage, { copy, doc, story }));
    expect(markup).toContain("No mockup in the agreement for this group.");
  });

  it("answers an unknown segment with a page, not the gate's 404", () => {
    const markup = renderToStaticMarkup(
      createElement(StoryPage, { copy, doc: register(), story: null }),
    );
    expect(markup).toContain("No story page is called");
    expect(markup).toContain("/admin/spec/validation");
  });
});

describe("the honest panel", () => {
  it("names the path and the reason, and offers a way on", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecNotice, {
        copy,
        path: SPEC_VALIDATION_SOURCE,
        reason: "Not Found — the file is not present in this tree",
      }),
    );
    expect(markup).toContain("data/spec/validation.json");
    expect(markup).toContain("Not Found");
    expect(markup).toContain("spec-scope-v2/VALIDATION.csv");
    expect(markup).toContain("/how-it-works");
  });

  it("is what a missing register produces, and a malformed one names the field", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-register-"));
    const missing = readSpecValidationSafe();
    expect(missing.doc).not.toBeNull();
    expect(missing.reason).toBeNull();

    expect(() => readSpecValidation(join(dir, "absent.json"))).toThrow(SpecUnreadable);
    const missingRead = (() => {
      try {
        readSpecValidation(join(dir, "absent.json"));
      } catch (error) {
        return error instanceof SpecUnreadable ? error.reason : "wrong error";
      }
      return "no throw";
    })();
    expect(missingRead).toContain("Not Found");

    const broken = join(dir, "broken.json");
    const doc = register();
    writeFileSync(broken, JSON.stringify({ ...doc, rows: [{ ...doc.rows[0], status: "Absent" }] }));
    const brokenRead = (() => {
      try {
        readSpecValidation(broken);
      } catch (error) {
        return error instanceof SpecUnreadable ? error.reason : "wrong error";
      }
      return "no throw";
    })();
    expect(brokenRead).toContain("rows.0.status");
  });
});

describe("the frame", () => {
  it("draws the confidentiality line on every depth", () => {
    for (const current of [
      { kind: "overview" as const },
      { kind: "validation" as const },
      { kind: "story" as const, slug: "07-plans-and-billing" },
    ]) {
      const markup = renderToStaticMarkup(
        createElement(SpecFrame, { copy, doc: register(), current }, createElement("p", null, "x")),
      );
      expect(markup).toContain("Consulting Agreement (NDA, Exhibit C)");
      expect(markup).toContain("data-spec-submenu=");
    }
  });

  it("draws no submenu when the register could not be read", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SpecFrame,
        { copy, doc: null, current: { kind: "overview" as const } },
        createElement("p", null, "x"),
      ),
    );
    expect(markup).not.toContain("data-spec-submenu=");
    expect(markup).toContain("Consulting Agreement (NDA, Exhibit C)");
  });
});
