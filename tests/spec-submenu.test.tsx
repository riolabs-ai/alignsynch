/**
 * The project spec's `Docs` row — the one submenu row that leaves the app (#1252 follow-up).
 *
 * **What these cases are for.** The row is a link to a *different origin*
 * (`https://alignsynch-v2-docs-preview.vercel.app/`), so four claims have to hold and none of
 * them is visible in a diff: it is the **last** row in both surfaces (the 208px column at `md`
 * and the shell's drawer below it), it leaves through `LeavingLink` — `target="_blank"`,
 * `rel="noopener noreferrer"`, and an accessible name that ends "opens in a new tab" — its
 * visible copy says the pages are drafts, and the destination is written **once**, in
 * `data/pages/admin-spec.ts`, never spelled in the component.
 *
 * The URL is imported from the fixture rather than typed here, so the two cannot drift: a card
 * that moves the preview moves one constant and both the row and this suite follow it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpecSubmenu, type SpecCurrent } from "@/components/admin/spec/spec-submenu";
import { SPEC_STORY_GROUPS } from "@/content/spec";
import { ADMIN_SPEC_DOCS_URL, adminSpecPageCopy } from "@/data/pages/admin-spec";
import { readSpecValidation } from "@/lib/spec/file";

const copy = adminSpecPageCopy;
const overview: SpecCurrent = { kind: "overview" };

/** The submenu as one surface renders it — the same call the frame makes. */
function submenu(surface: "column" | "sheet"): string {
  return renderToStaticMarkup(
    createElement(SpecSubmenu, { copy, doc: readSpecValidation(), current: overview, surface }),
  );
}

/** The one anchor whose `href` is the preview, with its start tag and its text. */
function docsAnchor(markup: string): string {
  const anchor = /<a\b[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/g;
  const found = [...markup.matchAll(anchor)].filter((match) => match[1] === ADMIN_SPEC_DOCS_URL);
  expect(found.length, `expected exactly one anchor to ${ADMIN_SPEC_DOCS_URL}`).toBe(1);
  return found[0][0];
}

describe.each(["column", "sheet"] as const)("the submenu's Docs row — %s surface", (surface) => {
  it("is the last row, after every story and the around-the-story group", () => {
    const markup = submenu(surface);
    expect(markup).toContain(`data-spec-submenu="${surface}"`);

    // Every story still renders, in the agreement's order, before the departing row.
    const order = [...markup.matchAll(/data-spec-story="([^"]+)"/g)].map((match) => match[1]);
    expect(order).toEqual(SPEC_STORY_GROUPS.map((story) => story.slug));

    const lastStory = markup.lastIndexOf(`data-spec-story="${SPEC_STORY_GROUPS.at(-1)?.slug}"`);
    expect(lastStory).toBeGreaterThan(-1);
    expect(markup.indexOf(ADMIN_SPEC_DOCS_URL)).toBeGreaterThan(lastStory);

    // Last of all: no anchor follows it in this navigation.
    const anchors = [...markup.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
    expect(anchors.at(-1)).toContain(ADMIN_SPEC_DOCS_URL);
  });

  it("leaves through LeavingLink — a new tab, no referrer, and a name that says so", () => {
    const anchor = docsAnchor(submenu(surface));
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener noreferrer"');
    expect(anchor).toMatch(/aria-label="[^"]*opens in a new tab"/);
    // The visible content is the fixture's label, not a literal in the component.
    expect(anchor).toContain(pageDocsLabel());
  });
});

/** The label the row prints, read from the fixture the way the component reads it. */
function pageDocsLabel(): string {
  const item = copy.items?.find((candidate) => candidate.id === "rail-docs");
  expect(item, "the fixture carries no `rail-docs` item").toBeDefined();
  return item?.label ?? "";
}

describe("the Docs row's copy and its one home", () => {
  it("says in its visible copy that these pages are drafts", () => {
    expect(pageDocsLabel()).toMatch(/draft/i);
    // The word is on screen, not only in the accessible name.
    expect(docsAnchor(submenu("column"))).toMatch(/draft/i);
  });

  it("spells the destination once — in the fixture, never in the component", () => {
    const source = readFileSync(
      join(process.cwd(), "components/admin/spec/spec-submenu.tsx"),
      "utf8",
    );
    const host = new URL(ADMIN_SPEC_DOCS_URL).host;
    expect(source).not.toContain(host);
    // And the render carries it once, so a second copy cannot hide in a sibling row.
    const markup = submenu("column");
    expect(markup.split(host).length - 1).toBe(1);
  });
});
