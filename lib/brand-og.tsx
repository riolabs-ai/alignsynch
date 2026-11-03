/**
 * The share card — the 1200x630 image a crawler puts beside a link to any route of this app.
 *
 * The failure this fixes: the tree had no open-graph image at all, so a link to any page previewed
 * as whatever a crawler invented from `<title>` and `<meta name=description>` — never the *wrong*
 * product, but never the product either: no mark, no brand ground, nothing a reader recognises
 * before reading.
 *
 * ## Why the card is data, and why it is here rather than in the route file
 *
 * `app/opengraph-image.tsx` is the Next file convention: it exports `size`, `contentType`, `alt`
 * and a default that returns an `ImageResponse`. That module is four lines of wiring around this
 * one, and this one holds the composition as a plain React element with no `next/og` import — so a
 * test can walk it, assert what is in it, and compare two brands without a rasteriser, a wasm
 * boundary or a build. `next/og` has no exports map entry (`import` resolves to `next/og.js`, which
 * does not exist), so a test that imported the route module could not even collect. Same split as
 * `lib/brand-theme.ts` (the decision) and `app/layout.tsx` (the `<html>` it paints): the route
 * always wires, the library always decides.
 *
 * ## The composition
 *
 * A white panel down the left, the deep brand field across the rest, one headline, one subhead, one
 * call to action, and the product drawn at the bottom — two answers that start together and part.
 *
 *   panel    x 0–340, `colors.background`. The AlignSynch lockup is black-and-gray ink drawn for a
 *            light ground (53.7% of its opaque pixels are pure black), so it cannot sit straight on
 *            the brand blue, and recolouring it would invent a brand variant nobody drew. The panel
 *            is how a light-ground mark keeps its own ground on a dark card — the asset is never
 *            touched.
 *   lockup   `brand.logo`, 300px wide, vertically centred, unmodified, at the aspect ratio its own
 *            bytes declare. The path comes from the record, so a brand swap moves the mark with it.
 *   field    `colors.primary`, full bleed behind everything else.
 *   headline 76px, `colors.primaryForeground`, two lines that are written, not wrapped.
 *   subhead  28px at 86%, the same sentence the product uses at `/login`.
 *   CTA      the record's `accent` pill with `accentForeground` type, naming the record's host.
 *   the Gap  two 5px strokes leaving one dot and parting to the right edge, the parting bracketed by
 *            a 6px `accent` bar and named "the Gap": two answers to the same questions, and the
 *            distance between them.
 *
 * Nothing else. No badge, no screenshot, no rating, no customer logo, no number this tree cannot
 * produce — a link preview is a claim about the product to someone who has not opened it, and it is
 * the claim nobody re-reads.
 *
 * ## The typeface, stated rather than swapped quietly
 *
 * The card is drawn in the one face `next/og` ships (Noto Sans regular, inside `@vercel/og`). The
 * app's own face is Inter via `next/font/google`, but `next/font` emits hashed `woff2` files and
 * satori parses only ttf/otf/woff, so there is no path from the loaded Inter to this raster; the
 * alternative is vendoring an Inter TTF in the repo, which is a second asset and a second licence
 * for a card whose whole job is one paragraph of type. Emphasis is carried by size and tracking
 * instead of a weight that would be a silent no-op: `fontWeight: 700` on a build with one face
 * renders regular and looks like a font that failed to load.
 *
 * ## No second hex, and no second palette
 *
 * Every colour below is read from the `Brand` record — there is no literal in this file, so the card
 * cannot drift from `data/brand.ts` the way a hand-drawn PNG would: re-point a brand's primary and
 * the next build's card is that colour, with no asset to re-export.
 *
 * ## The logo travels as the file, not as a copy
 *
 * `logoAsset` reads the path the record names out of `public/` and inlines those exact bytes, so the
 * card shows the same file the pages serve. Its intrinsic size is read from the bytes (a PNG's IHDR,
 * an SVG's `width`/`height` or `viewBox`) instead of being typed here, because a hardcoded aspect
 * ratio is a distorted mark the day the lockup is re-exported.
 *
 * `readFileSync` is safe here for the same reason `next/og` is: this module is server-only and the
 * route is prerendered at build time, so the bytes are baked into the PNG and no request ever
 * touches the filesystem. `/opengraph-image` reads no `DATABASE_URL`, no clock and no request.
 *
 * ## Why a route file and not a committed `public/brand/<id>-og.png`
 *
 * A committed PNG would give each brand a distinct *path* (`quizhub-og.png` versus
 * `alignsynch-og.png` under `public/brand/`), which is the pattern `brand.icon` uses — and it is the
 * wrong trade here, for one measured reason and one structural one.
 *
 * The measured one: a raster check has to be byte-exact to be a gate (`--check` re-draws and
 * compares, the way the icons do), and a PNG's bytes depend on the rasteriser and the font build on
 * the machine that drew it. An SVG icon is text and compares exactly on any box; a satori render on
 * a developer's machine and on CI is a coin flip, so the check would either be flaky or weaker than
 * "stale or not".
 *
 * The structural one: this surface does not need a distinct URL. Next hashes the *route file* into
 * the image URL, so both brands serve the same path — and they serve it from different origins
 * (`https://quizhub.com` vs `https://alignsynch.com`, `metadataBase` in the layout), which is
 * already a distinct cache key. There is no CDN and no shared origin in front of these builds
 * (`next.config.mjs`: no deploy target, `next start` on a dev box), so "the two URLs differ" buys
 * nothing an origin does not already give. The *bytes* differ per brand, and that is the claim worth
 * proving — see the handoff, which renders both.
 *
 * The file convention also keeps the second half of the win free: Next injects `og:image` (and, by
 * inheritance, `twitter:image`) for every route from this one file, so no page has to name an image
 * and no `metadata.openGraph.images` array is a second list to keep in step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Brand } from "@/content/brand";
import type React from "react";

/**
 * The box every crawler documents: 1200x630 is 1.91:1, which is Facebook's `og:image` size and
 * Twitter's `summary_large_image` — the one aspect ratio that is not cropped by either.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * The words on the card.
 *
 * Two lines of headline and two of subhead, each pair written out rather than wrapped: satori
 * measures no text, so a break left to a width is a break that moves when a font build moves. The
 * subhead is the product's own sentence — the one `/login` prints — because the Gap is the thing
 * being named here and a paraphrase would be a second description to keep true.
 *
 * What is deliberately absent: any number, rating, comparative or customer name. The card makes no
 * claim this repository cannot back.
 */
export const CARD_COPY = {
  headline: ["Two answers.", "One Gap."],
  subhead: ["The same questions for both people.", "Where their answers diverge is the Gap."],
  cta: "Start free",
} as const;

/** The left panel's width: the lockup's own ground, and the card's only light surface. */
const PANEL_WIDTH = 340;

/** The lockup's drawn width on the panel; its height follows the file's own aspect ratio. */
const LOGO_WIDTH = 300;

/** The right column's left edge — every element on the blue field starts here. */
const COLUMN_X = 392;

/**
 * The drawn Gap: a dot at (6, 73) and two strokes parting to the right edge at (758, 30) and
 * (758, 116), bracketed by a 6px accent bar. The canvas is 764x140 and sits at (392, 462), so the
 * local coordinates are the card's minus that origin.
 */
export const GAP_SIZE = { width: 764, height: 140 } as const;

/** An asset inlined for satori, with the intrinsic size its bytes declare. */
type Inlined = { dataUri: string; width: number; height: number };

/**
 * A PNG's size, from its IHDR chunk — the first chunk after the 8-byte signature, so the width and
 * height are always at bytes 16 and 20 of a big-endian stream.
 */
function pngSize(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * An SVG's size, from its root element: `width`/`height` when they are plain numbers (the icons and
 * the placeholder lockup both carry them), else the `viewBox` extents. A percentage width has no
 * intrinsic size, so it falls through and the caller decides.
 */
function svgSize(text: string): { width: number; height: number } | undefined {
  const root = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (root === undefined) return undefined;
  const attr = (name: string) => new RegExp(`\\b${name}="([\\d.]+)(?:px)?"`).exec(root)?.[1];
  const width = Number(attr("width"));
  const height = Number(attr("height"));
  if (width > 0 && height > 0) return { width, height };
  const box = /\bviewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(root);
  if (box === null) return undefined;
  const boxWidth = Number(box[1]);
  const boxHeight = Number(box[2]);
  return boxWidth > 0 && boxHeight > 0 ? { width: boxWidth, height: boxHeight } : undefined;
}

/** `public/` path -> the file's bytes, or a build-time failure that names the missing asset. */
function readPublic(src: string): Buffer {
  const path = join(process.cwd(), "public", src.replace(/^\/+/, ""));
  try {
    return readFileSync(path);
  } catch {
    throw new Error(
      `the share card cannot draw the brand logo: ${src} is not readable at ${path} (the record's \`logo\` must be a path into public/, per D-P2-1)`,
    );
  }
}

/**
 * The brand's own logo, inlined. The path comes from the record, so a brand swap moves the mark with
 * it, and the extension decides the media type rather than a second field in the schema.
 */
export function logoAsset(brand: Brand): Inlined {
  const bytes = readPublic(brand.logo);
  const isSvg = brand.logo.toLowerCase().endsWith(".svg");
  const size = isSvg ? svgSize(bytes.toString("utf8")) : pngSize(bytes);
  if (size === undefined) {
    throw new Error(
      `the share card cannot scale ${brand.logo}: its intrinsic size is not readable from the file (a PNG needs an IHDR, an SVG needs width/height or a viewBox), and guessing it would distort the mark`,
    );
  }
  const mime = isSvg ? "image/svg+xml" : "image/png";
  return {
    dataUri: `data:${mime};base64,${bytes.toString("base64")}`,
    width: size.width,
    height: size.height,
  };
}

/**
 * The Gap, drawn.
 *
 * As a data-URI SVG rather than a stack of divs because satori draws no `<svg>` element but does
 * render an `<img>` whose `src` is one, which is also why it stays byte-comparable in tests. The
 * strokes are the record's `primaryForeground` at 45% (the two paths begin as one and separate); the
 * bar is `accent`, and it is the only bright element on the card.
 */
export function gapDataUri(brand: Brand): string {
  const ink = brand.colors.primaryForeground;
  const accent = brand.colors.accent;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GAP_SIZE.width}" height="${GAP_SIZE.height}" viewBox="0 0 ${GAP_SIZE.width} ${GAP_SIZE.height}" fill="none">`,
    `<path d="M6 73 L752 30" stroke="${ink}" stroke-width="5"/>`,
    `<path d="M6 73 L752 116" stroke="${ink}" stroke-width="5"/>`,
    `<circle cx="6" cy="73" r="7" fill="${ink}"/>`,
    `<rect x="752" y="30" width="6" height="86" rx="3" fill="${accent}"/>`,
    "</svg>",
  ].join("");
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * The card, as an element tree satori can render.
 *
 * Inline styles only, absolutely positioned against the canvas, and `display: flex` stated on every
 * container: `ImageResponse` is not a browser — it has no stylesheet, no Tailwind and no cascade, so
 * a class name renders as nothing and a multi-child `<div>` without an explicit flex context throws.
 * The coordinates are the composition's, not a responsive layout's: this raster has exactly one size,
 * and the only reader that resizes it is a chat client showing it at about half scale.
 */
export function ogCard(brand: Brand): React.ReactElement {
  const logo = logoAsset(brand);
  const logoHeight = Math.round((LOGO_WIDTH * logo.height) / logo.width);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        // The brand's own primary, full bleed: the card is the product's ground, not a white box
        // with a logo in the corner of it.
        background: brand.colors.primary,
        color: brand.colors.primaryForeground,
      }}
    >
      {/*
        The lockup's own ground: the official file, unmodified, on the panel it was drawn for, with
        no border, shadow or effect of any kind on the mark.
      */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: PANEL_WIDTH,
          height: OG_SIZE.height,
          background: brand.colors.background,
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: satori has no next/image build, so the inlined logo renders only through an img. */}
        <img src={logo.dataUri} width={LOGO_WIDTH} height={logoHeight} alt="" />
      </div>

      {/*
        The headline. Two divs with a stated 80px line box, not one wrapping paragraph: the break is a
        decision, and satori measures no text to choose one. Size and tight tracking carry the
        emphasis — the one bundled face has no bold, so a `fontWeight: 700` here would be a request
        that never arrives.
      */}
      <div
        style={{
          position: "absolute",
          left: COLUMN_X,
          top: 120,
          display: "flex",
          flexDirection: "column",
          fontSize: 76,
          lineHeight: "80px",
          letterSpacing: -2.6,
        }}
      >
        {CARD_COPY.headline.map((line) => (
          <div key={line} style={{ display: "flex" }}>
            {line}
          </div>
        ))}
      </div>

      {/* The sentence the product uses, at 86% so it reads as a second voice. */}
      <div
        style={{
          position: "absolute",
          left: COLUMN_X,
          top: 306,
          display: "flex",
          flexDirection: "column",
          fontSize: 28,
          lineHeight: "36px",
          letterSpacing: -0.3,
          opacity: 0.86,
        }}
      >
        {CARD_COPY.subhead.map((line) => (
          <div key={line} style={{ display: "flex" }}>
            {line}
          </div>
        ))}
      </div>

      {/*
        The call to action, in the accent. Its width is its text plus its padding — a fixed width
        the type could outgrow is a pill with the label hanging out of it.
      */}
      <div
        style={{
          position: "absolute",
          left: COLUMN_X,
          top: 404,
          display: "flex",
          alignItems: "center",
          height: 52,
          padding: "0 30px",
          borderRadius: 26,
          background: brand.colors.accent,
          color: brand.colors.accentForeground,
          fontSize: 26,
          letterSpacing: -0.4,
        }}
      >
        {`${CARD_COPY.cta} · ${brand.domain}`}
      </div>

      {/* The idea, drawn. */}
      {/* biome-ignore lint/performance/noImgElement: satori renders an SVG only as an img data URI. */}
      <img
        src={gapDataUri(brand)}
        width={GAP_SIZE.width}
        height={GAP_SIZE.height}
        alt=""
        style={{ position: "absolute", left: COLUMN_X, top: 462 }}
      />

      {/*
        The bar's name. Right-aligned to the bar's own x (1150) rather than floating above the upper
        stroke, so the label names the thing it sits on.
      */}
      <div
        style={{
          position: "absolute",
          left: 940,
          top: 452,
          display: "flex",
          justifyContent: "flex-end",
          width: 210,
          fontSize: 26,
          letterSpacing: -0.2,
          color: brand.colors.accent,
        }}
      >
        the Gap
      </div>
    </div>
  );
}
