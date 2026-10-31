/**
 * The share card is a function of the brand record, and it is the same mark as the tab icon.
 *
 * The failure this pins, in the order it costs: the tree shipped no open-graph image at all, so
 * every route's preview was whatever a crawler made of `<title>`; then — the trap a generated
 * card introduces — a card drawn from a *copy* of the palette, which renders fine, looks right,
 * and is a second hex free to drift the moment a brand re-points `colors.action`. So the claims
 * here are mostly about what is *not* in the card:
 *
 *   1. the only colours in the element tree are the record's two, which is what makes "no second
 *      hex" a check instead of a comment;
 *   2. the letter and the two colours are the same three values the tab icon's own file carries,
 *      so the mark a reader sees at 16 px and at 1200 px is one mark;
 *   3. the two brands' cards differ, and each carries its own action colour rather than the
 *      template's.
 *
 * What this file cannot prove is the one thing the handoff has to: that satori *renders* it. A
 * raster needs `next/og` (which imports a wasm build of resvg and is not resolvable from a node
 * process — `next/og` has no exports map entry, so plain ESM asks for `next/og.js`), so the
 * pixels are checked against a real build of both brands rather than here. This file is the
 * cheap half: the tree it renders is the record's, or the gate fails before a pixel is drawn.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { brandInitial } from "@/lib/brand-initial";
import { OG_SIZE, ogCard } from "@/lib/brand-og";

/** The two records a build can ship. Same pair `scripts/gen-brand-icons.mjs` draws icons for. */
const brands: readonly (readonly [string, Brand])[] = [
  ["quizhub", quizHubBrand],
  ["alignsynch", alignSynchBrand],
];

/** Every string the element tree carries — text nodes and style values alike. */
function strings(value: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (node && typeof node === "object") {
      // A React element is props plus a type; a style object is just values.
      const props = (node as { props?: unknown }).props;
      if (props) walk(props);
      else for (const entry of Object.values(node)) walk(entry);
    }
  };
  walk(value);
  return out;
}

/** The colours a string carries, in the two forms `content/brand.ts` accepts. */
function colours(values: readonly string[]): string[] {
  return values.filter((value) => /^#[0-9a-fA-F]{3,8}$/.test(value) || /^hsla?\(/.test(value));
}

describe("the share card", () => {
  it("is the box a crawler documents: 1200x630, the ratio og:image and summary_large_image share", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("has a route-file convention to be served from", () => {
    // Next only injects og:image into a route's head when the file exists; the module next to it
    // is the wiring, so its absence is the whole feature going quiet rather than a build error.
    expect(readFileSync(join(process.cwd(), "app", "opengraph-image.tsx"), "utf8")).toContain(
      "ImageResponse",
    );
  });

  for (const [id, brand] of brands) {
    describe(`${id} (${brand.name})`, () => {
      it("draws the record's two colours and no third", () => {
        const found = colours(strings(ogCard(brand)));
        expect(new Set(found)).toEqual(
          new Set([brand.colors.action, brand.colors.actionForeground]),
        );
      });

      it("prints the name, the initial and the record's host", () => {
        const carried = strings(ogCard(brand));
        expect(carried).toContain(brand.name);
        expect(carried).toContain(brandInitial(brand.name));
        expect(carried).toContain(brand.domain);
      });

      it("is the same mark as the tab icon: one letter, the same two colours", () => {
        const icon = readFileSync(
          join(process.cwd(), "public", brand.icon.replace(/^\//, "")),
          "utf8",
        );
        // The icon paints `action` as its ground and `actionForeground` as the type over the
        // letter; the card paints the same pair inverted. Same three values, one derivation.
        expect(icon).toContain(`fill="${brand.colors.action}"`);
        expect(icon).toContain(`fill="${brand.colors.actionForeground}"`);
        expect(icon).toContain(`>${brandInitial(brand.name)}<`);
      });
    });
  }

  it("is a different card per brand, each with its own action colour", () => {
    const quizhub = strings(ogCard(quizHubBrand)).join("\n");
    const alignsynch = strings(ogCard(alignSynchBrand)).join("\n");
    expect(quizhub).not.toBe(alignsynch);
    expect(quizhub).toContain(quizHubBrand.colors.action);
    expect(quizhub).not.toContain(alignSynchBrand.colors.action);
    expect(alignsynch).toContain(alignSynchBrand.colors.action);
    expect(alignsynch).not.toContain(quizHubBrand.colors.action);
  });
});

describe("brandInitial", () => {
  it("is the first letter of the name the record prints, upper-cased", () => {
    expect(brandInitial("QuizHub")).toBe("Q");
    expect(brandInitial("AlignSynch")).toBe("A");
    expect(brandInitial("  two words")).toBe("T");
  });

  it("refuses a name it cannot draw, instead of rendering an empty badge", () => {
    expect(() => brandInitial("123")).toThrow(/has no letters/);
  });
});
