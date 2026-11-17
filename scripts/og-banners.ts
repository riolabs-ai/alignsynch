/**
 * og-banners — draw the three committed release-comms rasters under `public/og/`.
 *
 *   node --import ./scripts/ts-modules.mjs scripts/og-banners.ts [--brand=alignsynch]
 *
 * ## Why a script and not three PNGs in a drawer
 *
 * A banner nobody can regenerate is unmaintainable: the brand's palette moves in
 * `data/brands/<id>.ts`, and a hand-exported PNG silently keeps the old blue. So every
 * colour below is read from the `Brand` record and every size is a number in this file —
 * re-run the command and the three files are re-drawn from the current palette.
 *
 * ## Why it is not `lib/brand-og.tsx`
 *
 * That module draws the 1200x630 share card, and it does it as JSX. Node strips types from
 * a `.ts` file but has no JSX transform, and this script has to run under plain `node` (it is
 * a `scripts/` entry point, not a bundler target), so the compositions here are built with
 * `createElement` and live in their own file. Lane A of #1169 owns `public/` and nothing
 * under `lib/` or `app/`: the card and these banners share the *palette* (`data/brand.ts` →
 * `brands`), not a module.
 *
 * ## The three compositions, and the one idea they share
 *
 * All three are the brand's own ground (`colors.primary`) with the lockup on its light panel
 * (`colors.background`) — the same rule `lib/brand-og.tsx` documents: the AlignSynch lockup is
 * black ink drawn for a white ground, so it keeps a white panel on a dark card rather than
 * being recoloured into a variant nobody drew. The accent (`colors.accent`) is a *surface* on
 * this brand, so it is a bar, a pill or a border here and never a text colour.
 *
 *   readme-banner.png   1280x400  the GitHub header: words left, a real screen right
 *   email-banner.png    1120x280  the release-note email hero (lane B embeds it): type only,
 *                                 because a 280px-tall hero is read at 560px in a mail client
 *   release-default.png 1200x630  a release's fallback social card: words, a chart, no claim
 *                                 this repository cannot back
 *
 * ## The screenshots are crops, not renders
 *
 * Each banner shows a region of a screen committed under `docs/specs/v2-bundles/` — the spec
 * imagery, at 1:1, cropped by `overflow: hidden` on a fixed-size window (satori clips the
 * child; there is no image library in this repo and no CDN). `docs/` is not served, so the
 * bytes are inlined into the raster here instead of being referenced from a runtime file.
 *
 * The words are this file's own: the share card's copy belongs to `lib/brand-og.tsx`, and a
 * banner reusing it verbatim would be a second copy of a sentence that is already the login
 * screen's. `BRAND_COPY` is deliberately short — a banner is read once, at a glance.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, type CSSProperties, type ReactElement } from "react";
import { brands } from "../data/brand";
import type { Brand } from "../content/brand";

/** `next/og` has no exports-map entry (`import` resolves to a `next/og.js` that does not exist),
 * so the packaged renderer is named by its path. The specifier is built from a variable on
 * purpose: a literal would be resolved through `next`'s exports map by `tsc` as well as by node,
 * and only node can follow it. */
const IMAGE_RESPONSE_SPECIFIER = "next/dist/compiled/@vercel/og/index.node.js";

/** The three surfaces, and the words each one carries. `lines` are written, never wrapped:
 * satori measures no text, so a break left to a width is a break that moves when the bundled
 * face moves. */
const BANNERS = [
  {
    file: "readme-banner.png",
    width: 1280,
    height: 400,
    headline: ["Two answers.", "One Gap."],
    subhead: ["The same questions for both people."],
    showScreenshot: true,
  },
  {
    file: "email-banner.png",
    width: 1120,
    height: 280,
    headline: ["Two answers. One Gap."],
    subhead: ["The same questions for both people. Where they diverge is the Gap."],
    showScreenshot: false,
  },
  {
    file: "release-default.png",
    width: 1200,
    height: 630,
    headline: ["Release notes.", "What changed, and why."],
    subhead: ["Every entry is generated from the commits that shipped it."],
    showScreenshot: true,
  },
] as const;

/**
 * The spec screen each banner crops, and the region it shows — top-left of the window in the
 * source image's own pixels. `rd-extended-live-1280.png` is the relationship-detail surface at
 * its extended interval: a live relationship, which is the state the product is *for*.
 */
const SCREENSHOT = {
  src: "docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/reference/rd-extended-live-1280.png",
  /** `crop` is the (x, y) the window's top-left corner sits at in the source image. */
  readme: { x: 300, y: 520 },
  release: { x: 300, y: 700 },
} as const;

/** The screenshot window's width, in the raster's own pixels: a crop, never a scale. */
const WINDOW_WIDTH = 400;

/** A PNG's size, from its IHDR chunk (see `lib/brand-og.tsx` — the same two big-endian words). */
function pngSize(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** An SVG's size, from its root element: `width`/`height`, else the `viewBox` extents — the
 * template brand's lockup is an SVG, so the flag has to draw both kinds of file. */
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

/** A repo-relative path as a data URI, with the size its own bytes declare. */
function asset(relPath: string): { uri: string; width: number; height: number } {
  const bytes = readFileSync(join(process.cwd(), relPath));
  const isSvg = relPath.toLowerCase().endsWith(".svg");
  const size = isSvg ? svgSize(bytes.toString("utf8")) : pngSize(bytes);
  if (size === undefined) {
    throw new Error(
      `og-banners: ${relPath} declares no intrinsic size (a PNG needs an IHDR, an SVG a width/height or a viewBox), and guessing one would distort the mark`,
    );
  }
  const mime = isSvg ? "image/svg+xml" : "image/png";
  return {
    uri: `data:${mime};base64,${bytes.toString("base64")}`,
    width: size.width,
    height: size.height,
  };
}

/** A flex child with an explicit `display`, because satori is not a browser: no stylesheet, no
 * cascade, and a container with more than one child and no flex context throws. */
function box(style: CSSProperties, children?: ReactElement | ReactElement[] | string) {
  return h("div", { style: { display: "flex", ...style } }, children);
}

/** The lockup, unmodified, centred on its own light ground. */
function lockupPanel(brand: Brand, width: number, panelWidth: number, height: number) {
  const logo = asset(`public/${brand.logo.replace(/^\//, "")}`);
  const drawn = Math.round((width * logo.height) / logo.width);
  return box(
    {
      position: "absolute",
      left: 0,
      top: 0,
      width: panelWidth,
      height,
      alignItems: "center",
      justifyContent: "center",
      background: brand.colors.background,
    },
    // `h("img")` is not JSX, so `noImgElement` never fires here — this is satori's only way to
    // draw a file, and there is no `next/image` inside a raster.
    h("img", { src: logo.uri, width, height: drawn, alt: "" }),
  );
}

/** The accent seam between the lockup's panel and the brand field. */
function seam(brand: Brand, x: number, height: number) {
  return box({
    position: "absolute",
    left: x,
    top: 0,
    width: 6,
    height,
    background: brand.colors.accent,
  });
}

/**
 * The Gap, drawn: one dot and two strokes parting to a bright accent bar — two answers to the
 * same questions, and the distance between them. The geometry is `lib/brand-og.tsx`'s (that
 * module's `gapDataUri`), scaled to the space a banner has: satori draws no `<svg>` element but
 * does render an `<img>` whose `src` is one.
 */
function gapMotif(
  brand: Brand,
  at: { x: number; y: number },
  size: { width: number; height: number },
) {
  const ink = brand.colors.primaryForeground;
  const bar = brand.colors.accent;
  const { width, height } = size;
  const mid = Math.round(height / 2);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`,
    `<path d="M4 ${mid} L${width - 12} 4" stroke="${ink}" stroke-width="3" opacity="0.85"/>`,
    `<path d="M4 ${mid} L${width - 12} ${height - 4}" stroke="${ink}" stroke-width="3" opacity="0.85"/>`,
    `<circle cx="4" cy="${mid}" r="5" fill="${ink}"/>`,
    `<rect x="${width - 10}" y="2" width="6" height="${height - 4}" rx="3" fill="${bar}"/>`,
    "</svg>",
  ].join("");
  return box(
    { position: "absolute", left: at.x, top: at.y, width, height },
    // `h("img")` is not JSX: satori draws a file no other way, and `noImgElement` does not fire.
    h("img", {
      src: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
      width,
      height,
      alt: "",
    }),
  );
}

/** A 1:1 crop of the spec screen: a fixed window, the image overshooting it by `crop`, and
 * `overflow: hidden` doing the clipping. */
function screenshot(
  brand: Brand,
  window: { x: number; y: number; width: number; height: number },
  crop: { x: number; y: number },
) {
  const shot = asset(SCREENSHOT.src);
  return box(
    {
      position: "absolute",
      left: window.x,
      top: window.y,
      width: window.width,
      height: window.height,
      overflow: "hidden",
      borderRadius: 10,
      border: `1px solid ${brand.colors.accent}`,
    },
    // `h("img")` is not JSX: satori draws a file no other way, and `noImgElement` does not fire.
    h("img", {
      src: shot.uri,
      width: shot.width,
      height: shot.height,
      alt: "",
      style: { position: "absolute", left: -crop.x, top: -crop.y },
    }),
  );
}

/** The words: a rule, a headline of written lines, a subhead, and the record's own host. */
function words(brand: Brand, banner: (typeof BANNERS)[number], x: number, top: number) {
  const small = banner.height <= 300;
  const headlineSize = small ? 38 : banner.height <= 400 ? 54 : 62;
  const headlineLead = Math.round(headlineSize * 1.15);
  const subheadSize = small ? 18 : banner.height <= 400 ? 20 : 22;
  const subheadLead = Math.round(subheadSize * 1.45);
  const subheadTop = top + 30 + banner.headline.length * headlineLead + 18;
  const pillTop = subheadTop + banner.subhead.length * subheadLead + 22;
  return [
    box({
      position: "absolute",
      left: x,
      top,
      width: small ? 32 : 44,
      height: 4,
      background: brand.colors.accent,
    }),
    box(
      {
        position: "absolute",
        left: x,
        top: top + 30,
        flexDirection: "column",
        fontSize: headlineSize,
        lineHeight: `${headlineLead}px`,
        letterSpacing: small ? -0.8 : -1.6,
        color: brand.colors.primaryForeground,
      },
      banner.headline.map((line) => box({}, line)),
    ),
    box(
      {
        position: "absolute",
        left: x,
        top: subheadTop,
        flexDirection: "column",
        fontSize: subheadSize,
        lineHeight: `${subheadLead}px`,
        letterSpacing: -0.3,
        opacity: 0.86,
        color: brand.colors.primaryForeground,
      },
      banner.subhead.map((line) => box({}, line)),
    ),
    box(
      {
        position: "absolute",
        left: x,
        top: pillTop,
        alignItems: "center",
        height: small ? 40 : 46,
        padding: small ? "0 22px" : "0 26px",
        borderRadius: 23,
        background: brand.colors.accent,
        color: brand.colors.accentForeground,
        fontSize: small ? 17 : 20,
        letterSpacing: -0.2,
      },
      brand.domain,
    ),
  ];
}

/** One banner, as the element tree satori draws. */
function banner(brand: Brand, spec: (typeof BANNERS)[number]): ReactElement {
  const small = spec.height <= 300;
  const panelWidth = small ? 260 : 340;
  const lockupWidth = small ? 200 : spec.height <= 400 ? 280 : 300;
  const textX = panelWidth + 52;
  const crop = spec.height <= 400 ? SCREENSHOT.readme : SCREENSHOT.release;
  const shot = spec.showScreenshot
    ? screenshot(
        brand,
        {
          // The readme banner lets the screen run off its right edge; the taller card insets it,
          // because a 630px card with a clipped border reads as a mistake rather than a bleed.
          x: spec.height <= 400 ? spec.width - WINDOW_WIDTH : spec.width - WINDOW_WIDTH - 60,
          y: spec.height <= 400 ? 0 : spec.height - 200,
          width: WINDOW_WIDTH,
          height: spec.height <= 400 ? spec.height : 160,
        },
        crop,
      )
    : null;
  const motif = spec.showScreenshot
    ? null
    : gapMotif(
        brand,
        { x: spec.width - 220, y: Math.round(spec.height / 2) - 40 },
        { width: 150, height: 80 },
      );
  return box(
    {
      position: "relative",
      width: spec.width,
      height: spec.height,
      background: brand.colors.primary,
      color: brand.colors.primaryForeground,
    },
    [
      lockupPanel(brand, lockupWidth, panelWidth, spec.height),
      seam(brand, panelWidth, spec.height),
      ...words(brand, spec, textX, small ? 46 : spec.height <= 400 ? 78 : 96),
      ...(shot === null ? [] : [shot]),
      ...(motif === null ? [] : [motif]),
    ],
  );
}

/* ------------------------------------------------------------------ *
 * Draw
 * ------------------------------------------------------------------ */

/** The brand to draw: `--brand=<id>` from `data/brand.ts`'s registry, AlignSynch by default
 * because these three surfaces are its release comms (the readme header, the release email, a
 * release's social card). */
function resolveBrand(): { id: keyof typeof brands; brand: Brand } {
  const flag = process.argv.find((arg) => arg.startsWith("--brand="));
  const id = (flag?.slice("--brand=".length) ?? "alignsynch") as keyof typeof brands;
  const brand = brands[id];
  if (brand === undefined) {
    throw new Error(
      `og-banners: --brand=${id} is not a brand this tree ships (${Object.keys(brands).join(", ")})`,
    );
  }
  return { id, brand };
}

/** Every crop must fit inside the screen it takes from — a window past the source is a window
 * of nothing, and a raster nobody looks at until it is a broken image in an email. */
function assertCropsFit(): void {
  const source = asset(SCREENSHOT.src);
  for (const spec of BANNERS) {
    if (!spec.showScreenshot) continue;
    const windowHeight = spec.height <= 400 ? spec.height : 160;
    const crop = spec.height <= 400 ? SCREENSHOT.readme : SCREENSHOT.release;
    if (crop.x + WINDOW_WIDTH > source.width || crop.y + windowHeight > source.height) {
      throw new Error(
        `og-banners: ${spec.file} crops ${SCREENSHOT.src} to ${crop.x},${crop.y} +${WINDOW_WIDTH}x${windowHeight}, past its ${source.width}x${source.height}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const { id, brand } = resolveBrand();
  assertCropsFit();

  const { ImageResponse } = (await import(IMAGE_RESPONSE_SPECIFIER)) as {
    ImageResponse: new (
      element: ReactElement,
      options: { width: number; height: number },
    ) => { arrayBuffer(): Promise<ArrayBuffer> };
  };

  const outDir = join(process.cwd(), "public", "og");
  mkdirSync(outDir, { recursive: true });

  for (const spec of BANNERS) {
    const response = new ImageResponse(banner(brand, spec), {
      width: spec.width,
      height: spec.height,
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(join(outDir, spec.file), bytes);
    console.log(
      `og-banners: public/og/${spec.file}  ${spec.width}x${spec.height}  brand=${id}  ${(bytes.length / 1024).toFixed(1)} KB`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
