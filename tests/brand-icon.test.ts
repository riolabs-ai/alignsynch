/**
 * The generated icon set — one geometry across both brands, and the maskable mark inside the
 * safe zone.
 *
 * The shape rule the card states is "identical geometry, different token": QuizHub and AlignSynch
 * may differ only by the two colours they hand `markSvg`, never by the book's size, position or
 * radius. The files are written by `scripts/gen-brand-icons.mjs` and held to the record by
 * `pnpm data:check --check`, so this test pins the two claims the generator *cannot* fail on by
 * construction — that a brand cannot grow or shrink the mark, and that the maskable mark is
 * inside the 80 % circle the OS is allowed to crop to.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { MARK_SIZE, MASKABLE_GLYPH_FRACTION } from "@/lib/brand-icon";

const BRANDS = [
  { id: "quizhub", brand: quizHubBrand },
  { id: "alignsynch", brand: alignSynchBrand },
] as const;

function icon(id: string, surface: string): string {
  return readFileSync(join(process.cwd(), "public", "brand", `${id}${surface}`), "utf8");
}

/** The SVG with the two brands' hexes and names normalised, so shape is the only thing compared. */
function shapeOnly(svg: string): string {
  return svg
    .replaceAll(quizHubBrand.colors.action, "ACTION")
    .replaceAll(quizHubBrand.colors.actionForeground, "INK")
    .replaceAll(alignSynchBrand.colors.action, "ACTION")
    .replaceAll(alignSynchBrand.colors.actionForeground, "INK")
    .replaceAll(quizHubBrand.name, "NAME")
    .replaceAll(alignSynchBrand.name, "NAME");
}

/** The glyph scale a file applies, read out of its `<g transform="… scale(N) …">`. */
function glyphScale(svg: string): number {
  const match = /scale\(([\d.]+)\)/.exec(svg);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

describe("the generated icon set", () => {
  it("draws the same geometry for both brands on every surface", () => {
    for (const surface of [
      "-icon.svg",
      "-apple-touch-icon.svg",
      "-icon-192.svg",
      "-icon-512.svg",
    ]) {
      expect(shapeOnly(icon("quizhub", surface))).toBe(shapeOnly(icon("alignsynch", surface)));
    }
  });

  it("is full bleed on the maskable set — no rounded corners, no transparency", () => {
    for (const surface of ["-apple-touch-icon.svg", "-icon-192.svg", "-icon-512.svg"]) {
      const quizhub = icon("quizhub", surface);
      const alignsynch = icon("alignsynch", surface);
      // The maskable square fills the whole canvas: no `rx`, so no transparent corners to
      // double-round under the OS mask.
      expect(quizhub).not.toMatch(/<rect[^>]*rx=/);
      expect(alignsynch).not.toMatch(/<rect[^>]*rx=/);
      expect(quizhub).toContain(`<rect width="${MARK_SIZE}" height="${MARK_SIZE}" fill=`);
    }
  });

  it("keeps the maskable mark inside the 80 % safe circle", () => {
    // The book's farthest point from its centre is ~14.87 in the 24-unit box (the outline's
    // corner, at (1,2) from the (12,12) centre). Scaled by the maskable fraction, it must stay
    // within the safe radius the OS may crop to: 40 % of the canvas.
    const safeRadius = 0.4 * MARK_SIZE;
    const scale = glyphScale(icon("quizhub", "-icon-512.svg"));
    expect(scale).toBeCloseTo((MASKABLE_GLYPH_FRACTION * MARK_SIZE) / 24, 1);
    expect(scale * 14.87).toBeLessThanOrEqual(safeRadius);
  });

  it("keeps the app mark rounded, like the chrome's box", () => {
    for (const id of ["quizhub", "alignsynch"]) {
      expect(icon(id, "-icon.svg")).toMatch(/<rect[^>]*rx=/);
    }
  });
});
