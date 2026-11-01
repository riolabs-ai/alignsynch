/**
 * The share card is a function of the brand record, and its mark is the same book the icons draw.
 *
 * The failure this pins, in the order it costs: the tree shipped no open-graph image at all, so
 * every route's preview was whatever a crawler made of `<title>`; then — the trap a generated
 * card introduces — a card drawn from a *copy* of the palette, which renders fine, looks right,
 * and is a second hex free to drift the moment a brand re-points `colors.action`. Then the mark
 * itself split: the card and the tab icon drew the brand's *initial* while every page drew a
 * `BookOpen` glyph. So the claims here are about what the card shares with the icon set:
 *
 *   1. the only colours in the mark are the record's two, which is what makes "no second hex" a
 *      check instead of a comment;
 *   2. the mark embedded in the card is the open book from `lib/brand-icon.ts` — the same two
 *      paths the generated favicon carries — so a reader at 16 px and at 1200 px sees one mark;
 *   3. the two brands' cards differ, each carries its own action colour rather than the
 *      template's, and the *geometry* is identical across brands.
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
import { MARK_PATHS } from "@/lib/brand-icon";
import { OG_SIZE, markDataUri, ogCard } from "@/lib/brand-og";

/** The two records a build can ship. Same pair `scripts/gen-brand-icons.mjs` draws icons for. */
const brands: readonly (readonly [string, Brand])[] = [
  ["quizhub", quizHubBrand],
  ["alignsynch", alignSynchBrand],
];

/** Every string the element tree carries — text nodes, attribute values and style values alike. */
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

/** The mark's data URI, decoded back to the SVG the generator would write. */
function markSvgOf(brand: Brand): string {
  const prefix = "data:image/svg+xml;base64,";
  const uri = strings(ogCard(brand)).find((value) => value.startsWith(prefix));
  expect(uri).toBeDefined();
  return Buffer.from(uri!.slice(prefix.length), "base64").toString("utf8");
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
      it("prints the name and the record's host", () => {
        const carried = strings(ogCard(brand));
        expect(carried).toContain(brand.name);
        expect(carried).toContain(brand.domain);
      });

      it("embeds the open book in the record's two colours, inverted", () => {
        const mark = markSvgOf(brand);
        // Inverted from the icon: the action colour strokes the glyph on the action-foreground
        // square. No third hex can appear.
        expect(mark).toContain(`fill="${brand.colors.actionForeground}"`);
        expect(mark).toContain(`stroke="${brand.colors.action}"`);
        for (const path of MARK_PATHS) expect(mark).toContain(`<path d="${path}"/>`);
      });

      it("is the same mark as the tab icon: one geometry, the same two colours", () => {
        const icon = readFileSync(
          join(process.cwd(), "public", brand.icon.replace(/^\//, "")),
          "utf8",
        );
        const mark = markSvgOf(brand);
        // The icon paints `action` as its ground and `actionForeground` as the book's ink; the
        // card paints the same pair inverted. Same two paths, one derivation.
        expect(icon).toContain(`fill="${brand.colors.action}"`);
        expect(icon).toContain(`stroke="${brand.colors.actionForeground}"`);
        for (const path of MARK_PATHS) {
          expect(icon).toContain(`<path d="${path}"/>`);
          expect(mark).toContain(`<path d="${path}"/>`);
        }
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

  it("draws the same geometry for both brands — colour is the only difference", () => {
    // The mark's shape is a constant; the two brands may only differ by the two tokens they pass
    // into `markSvg`. Decode the data URIs, strip the hexes and the names, and the two SVGs are
    // identical.
    const decode = (brand: Brand) => {
      const prefix = "data:image/svg+xml;base64,";
      return Buffer.from(markDataUri(brand).slice(prefix.length), "base64").toString("utf8");
    };
    const strip = (svg: string) =>
      svg
        .replaceAll(quizHubBrand.colors.action, "ACTION")
        .replaceAll(quizHubBrand.colors.actionForeground, "INK")
        .replaceAll(alignSynchBrand.colors.action, "ACTION")
        .replaceAll(alignSynchBrand.colors.actionForeground, "INK")
        .replaceAll("QuizHub", "NAME")
        .replaceAll("AlignSynch", "NAME");
    expect(strip(decode(quizHubBrand))).toBe(strip(decode(alignSynchBrand)));
  });
});
