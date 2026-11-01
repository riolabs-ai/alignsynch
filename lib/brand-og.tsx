/**
 * The share card — the 1200x630 image a crawler puts beside a link to any route of this app.
 *
 * The failure this fixes: the tree had no open-graph image at all. `app/layout.tsx` exported
 * a title, a description and (since #187 stage 4) an icon, and nothing else, so a link to any
 * page previewed as whatever a crawler invented from `<title>` and `<meta name=description>`.
 * That never showed the *wrong* product — the copy is the record's — but it never showed the
 * product either: no mark, no brand ground, nothing a reader recognises before reading.
 *
 * ## Why the card is data, and why it is here rather than in the route file
 *
 * `app/opengraph-image.tsx` is the Next file convention: it exports `size`, `contentType`,
 * `alt` and a default that returns an `ImageResponse`. That module is three lines of wiring
 * around this one, and this one holds the composition as a plain React element with no
 * `next/og` import — so a test can walk it, assert what is in it, and compare two brands
 * without a rasteriser, a wasm boundary or a build. Same split as `lib/brand-theme.ts`
 * (the decision) and `app/layout.tsx` (the `<html>` it paints): the route always wires, the
 * library always decides.
 *
 * ## No second hex
 *
 * Every colour below is read from the `Brand` record — `colors.action` is the ground and
 * `colors.actionForeground` is the type, and the badge is the same pair inverted. There is no
 * literal in this file, so the card cannot drift from `data/brand.ts` the way a hand-drawn PNG
 * would: re-point a brand's action colour and the next build's card is that colour, with no
 * asset to re-export.
 *
 * ## The mark is the book, and it is the icon
 *
 * The badge embeds the *same* mark the icon set draws: `markSvg` from `lib/brand-icon.ts`, the
 * open book, as a data URI with the pair inverted (action-coloured glyph on the
 * action-foreground square). The mark used to be the brand's initial (`lib/brand-initial.ts`),
 * which disagreed with the `BookOpen` icon every page drew; now the share card, the favicon and
 * the in-app chrome are one geometry from one module. satori renders no `<svg>` element, but it
 * does render an `<img>` whose `src` is a data URI, so the vector mark travels as text and stays
 * byte-comparable in tests — no committed PNG, for the same reason the icons are SVG.
 *
 * ## Why a route file and not a committed `public/brand/<id>-og.png`
 *
 * A committed PNG would give each brand a distinct *path* (`quizhub-og.png` versus
 * `alignsynch-og.png` under `public/brand/`), which is the pattern `brand.icon` uses — and it is
 * the wrong trade here, for one measured reason and one structural one.
 *
 * The measured one: a raster check has to be byte-exact to be a gate (`--check` re-draws and
 * compares, the way the icons do), and a PNG's bytes depend on the rasteriser and the font
 * build on the machine that drew it. An SVG icon is text and compares exactly on any box; a
 * satori render on a developer's machine and on CI is a coin flip, so the check would either be
 * flaky or weaker than "stale or not".
 *
 * The structural one: this surface does not need a distinct URL. Next hashes the *route file*
 * into the image URL, so both brands serve the same path — and they serve it from different
 * origins (`https://quizhub.com` vs `https://alignsynch.com`, `metadataBase` below), which is
 * already a distinct cache key. There is no CDN and no shared origin in front of these builds
 * (`next.config.mjs`: no deploy target, `next start` on a dev box), so "the two URLs differ" buys
 * nothing an origin does not already give. The *bytes* differ per brand, and that is the claim
 * worth proving — see the handoff, which hashes both renders.
 *
 * The file convention also keeps the second half of the win free: Next injects `og:image` (and,
 * by inheritance, `twitter:image`) for every route from this one file, so no page has to name an
 * image and no `metadata.openGraph.images` array is a second list to keep in step.
 */
import type { Brand } from "@/content/brand";
import { APP_GLYPH_FRACTION, APP_RADIUS_FRACTION, MARK_SIZE, markSvg } from "@/lib/brand-icon";
import type React from "react";

/**
 * The box every crawler documents: 1200x630 is 1.91:1, which is Facebook's `og:image` size and
 * Twitter's `summary_large_image` — the one aspect ratio that is not cropped by either.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * The mark as a data URI — the icon's composition inverted (the glyph in the brand's action
 * colour on the action-foreground square), at the canvas the icon generator authors against.
 *
 * Base64, not URL-encoded: satori's `<img>` parses the `src` as a data URI and rejects the raw
 * `%` escapes of an URL-encoded SVG with `InvalidCharacterError`. This module is server-only
 * (`app/opengraph-image.tsx` and the test), so `Buffer` is always present.
 */
export function markDataUri(brand: Brand): string {
  const svg = markSvg({
    ground: brand.colors.actionForeground,
    ink: brand.colors.action,
    radius: APP_RADIUS_FRACTION * MARK_SIZE,
    glyph: APP_GLYPH_FRACTION,
    width: MARK_SIZE,
    height: MARK_SIZE,
    title: brand.name,
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * The card, as an element tree satori can render.
 *
 * Inline styles only, and `display: flex` stated on every container: `ImageResponse` is not a
 * browser — it has no stylesheet, no Tailwind and no cascade, so a class name would render as
 * nothing and a multi-child `<div>` without an explicit flex context throws. That is also why
 * the layout is three boxes and not a component composition: everything drawn here has to be
 * legible as pixels in a 1200x630 raster at whatever size a chat client shows a preview.
 */
export function ogCard(brand: Brand): React.ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        // The brand's own interactive colour, full bleed: the card is the product's ground,
        // not a white box with a logo in the corner of it.
        background: brand.colors.action,
        color: brand.colors.actionForeground,
        padding: "76px 84px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        {/*
          The icon's composition, inverted: the same rounded square, the same book — in the two
          colours the record carries, so no third hex enters the tree. The badge is a 132 px
          `<img>` whose `src` is the mark as a data URI, not a hand-drawn letter.
        */}
        <img src={markDataUri(brand)} width={132} height={132} alt="" />
        {/*
          The product name, at the weight the card can actually draw. `next/og` ships one
          bundled face (Noto Sans regular) so `fontWeight: 700` here would be a request satori
          silently ignores — size and tracking carry the emphasis instead of a weight that
          never arrives, and no font file is fetched or committed to get it.
        */}
        <div style={{ display: "flex", fontSize: 84, letterSpacing: -2, lineHeight: 1 }}>
          {brand.name}
        </div>
      </div>
      {/*
        The record's host, not a composed origin: `alignsynch.com` is the string a reader types
        and the one `content/brand.ts` requires to be bare (no scheme, no trailing slash).
      */}
      <div style={{ display: "flex", fontSize: 32 }}>{brand.domain}</div>
    </div>
  );
}
