/**
 * The share card is the brand record, drawn: the record's logo file, the record's palette, one true
 * sentence and a drawing of the Gap — and nothing a preview cannot back.
 *
 * The failure this pins, in the order it costs: the tree shipped no open-graph image at all, so every
 * route's preview was whatever a crawler made of `<title>`; then — the trap a generated card
 * introduces — a card drawn from a *copy* of the palette, which renders fine, looks right, and is a
 * second hex free to drift the moment a brand re-points `colors.primary`; then the mark itself: the
 * card drew the template's open book while the AlignSynch pages drew the real lockup, so the
 * AlignSynch card was the shape of a product that brand does not sell.
 *
 * So the claims here are the ones a raster cannot make and a build will not:
 *
 *   1. the only colours in the tree are the record's, which is what makes "no second hex" a check
 *      instead of a comment;
 *   2. the mark inlined on the card is the bytes of `public/<brand.logo>` — the file the pages
 *      serve, at the aspect ratio that file declares — so a re-exported lockup moves with it;
 *   3. the card carries the product sentence and no number, rating, comparative or other brand's
 *      name, because a link preview is a claim about the product to someone who has not opened it.
 *
 * The route itself no longer draws: `app/opengraph-image.png` is the owner's supplied card,
 * committed byte-identical and served by the file convention. `lib/brand-og` is retained for the
 * cases below (and for a future brand that wants a drawn card), not as what the route serves.
 *
 * What this file cannot prove is the one thing the handoff has to: that satori *renders* it. A raster
 * needs `next/og` (which imports a wasm build of resvg and is not resolvable from a node process —
 * `next/og` has no exports map entry, so plain ESM asks for `next/og.js`), so the pixels are checked
 * against a real build of both brands rather than here. This file is the cheap half: the tree it
 * renders is the record's, or the gate fails before a pixel is drawn.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { CARD_COPY, GAP_SIZE, OG_SIZE, gapDataUri, logoAsset, ogCard } from "@/lib/brand-og";

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

/** The card's strings with every data URI removed — i.e. the copy, the paths and the style values. */
function prose(brand: Brand): string[] {
  return strings(ogCard(brand)).filter((value) => !value.startsWith("data:"));
}

/** Every data URI in the tree, decoded back to the file it was read from or the SVG it was written as. */
function dataUris(brand: Brand): string[] {
  return strings(ogCard(brand))
    .filter((value) => value.startsWith("data:"))
    .map((value) => Buffer.from(value.slice(value.indexOf(",") + 1), "base64").toString("utf8"));
}

/** The PNG on the card, as bytes. */
function logoPngOn(brand: Brand): Buffer {
  const uri = strings(ogCard(brand)).find((value) => value.startsWith("data:image/png;base64,"));
  expect(uri).toBeDefined();
  if (uri === undefined) throw new Error("card has no PNG logo");
  return Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
}

describe("the share card", () => {
  it("is the box a crawler documents: 1200x630, the ratio og:image and summary_large_image share", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("is served from the framework's file convention: the committed PNG, 1200x630", () => {
    // Next injects og:image into every route's head from `opengraph-image.*` in `app/` and from
    // nothing else, so a missing file is the whole feature going quiet rather than a build error.
    // The bytes here are the owner's supplied card, committed as-is: checked for existence and box,
    // never re-derived — an adjusted share card is the defect this replaced.
    const png = readFileSync(join(process.cwd(), "app", "opengraph-image.png"));
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(OG_SIZE.width);
    expect(png.readUInt32BE(20)).toBe(OG_SIZE.height);
  });

  for (const [id, brand] of brands) {
    describe(`${id} (${brand.name})`, () => {
      it("inlines the record's logo file byte for byte, at the aspect ratio the file declares", () => {
        const record = readFileSync(join(process.cwd(), "public", brand.logo.replace(/^\/+/, "")));
        const asset = logoAsset(brand);
        if (brand.logo.endsWith(".png")) {
          expect(logoPngOn(brand).equals(record)).toBe(true);
          // 818x127 for the AlignSynch lockup: a card that typed an aspect ratio would show a
          // distorted mark the day the lockup is re-exported, so the file is the only source.
          expect(asset.width).toBe(record.readUInt32BE(16));
          expect(asset.height).toBe(record.readUInt32BE(20));
        } else {
          // SVG: the root element's own width/height.
          const text = record.toString("utf8");
          expect(asset.dataUri).toBe(
            `data:image/svg+xml;base64,${Buffer.from(text, "utf8").toString("base64")}`,
          );
          expect(text).toContain(`width="${asset.width}"`);
          expect(text).toContain(`height="${asset.height}"`);
        }
      });

      it("paints the record's colours and no other", () => {
        const ours = Object.values(brand.colors).map((value) => value.toLowerCase());
        const painted = prose(brand)
          .flatMap((value) => value.match(/#[0-9a-fA-F]{3,8}|hsla?\([^)]*\)|rgba?\([^)]*\)/g) ?? [])
          .map((value) => value.toLowerCase());
        expect(painted.length).toBeGreaterThan(0);
        for (const value of painted) expect(ours).toContain(value);
        // And the card is *painted*: the field is the record's primary, not a default white box.
        expect(painted).toContain(brand.colors.primary.toLowerCase());
        expect(painted).toContain(brand.colors.accent.toLowerCase());
      });

      it("draws the Gap: two strokes from one dot, the parting bracketed in the accent", () => {
        const gap = dataUris(brand).find((value) => value.includes('stroke-width="5"'));
        expect(gap).toBeDefined();
        if (gap === undefined) throw new Error("card has no Gap drawing");
        expect(gap).toContain(`width="${GAP_SIZE.width}" height="${GAP_SIZE.height}"`);
        // Two answers, two strokes, in the record's ink.
        expect(gap.split(`stroke="${brand.colors.primaryForeground}"`).length - 1).toBe(2);
        // One bright element: the gap itself.
        expect(gap).toContain(
          `<rect x="752" y="30" width="6" height="86" rx="3" fill="${brand.colors.accent}"/>`,
        );
        expect(gapDataUri(brand)).toBe(
          `data:image/svg+xml;base64,${Buffer.from(gap, "utf8").toString("base64")}`,
        );
      });

      it("carries the product sentence and the record's host, and no claim it cannot back", () => {
        const text = prose(brand).join("\n");
        for (const line of CARD_COPY.headline) expect(text).toContain(line);
        for (const line of CARD_COPY.subhead) expect(text).toContain(line);
        expect(text).toContain(`${CARD_COPY.cta} · ${brand.domain}`);
        const words = [
          ...CARD_COPY.headline,
          ...CARD_COPY.subhead,
          CARD_COPY.cta,
          brand.domain,
        ].join(" ");
        expect(words).not.toMatch(
          /\d|%|\btrusted by\b|\brated\b|\brating\b|\bstars?\b|\bcheaper\b|\breviews?\b/i,
        );
      });
    });
  }

  it("never names the other brand — the template's mark stays off the AlignSynch card", () => {
    const alignsynch = [
      ...prose(alignSynchBrand),
      ...dataUris(alignSynchBrand).filter((value) => value.startsWith("<svg")),
    ].join("\n");
    expect(alignsynch).not.toMatch(/quizhub/i);
    expect(alignsynch).toContain(alignSynchBrand.colors.accent);
  });

  it("is a different card per brand, each with its own primary", () => {
    const quizhub = prose(quizHubBrand).join("\n");
    const alignsynch = prose(alignSynchBrand).join("\n");
    expect(quizhub).not.toBe(alignsynch);
    expect(quizhub).toContain(quizHubBrand.colors.primary);
    expect(quizhub).not.toContain(alignSynchBrand.colors.primary);
    expect(alignsynch).toContain(alignSynchBrand.colors.primary);
    expect(alignsynch).not.toContain(quizHubBrand.colors.primary);
  });
});
