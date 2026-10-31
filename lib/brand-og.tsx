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
 * `colors.actionForeground` is the type and the badge. There is no literal in this file, so
 * the card cannot drift from `data/brand.ts` the way a hand-drawn PNG would: re-point a brand's
 * action colour and the next build's card is that colour, with no asset to re-export. The
 * badge is the icon's composition inverted (ground-coloured letter on a type-coloured square)
 * rather than a third colour, which is why the mark reads as the same mark at 132 px and at 16.
 *
 * ## Why the mark is the initial rather than `brand.logo`
 *
 * `brand.logo` is a path into `data/media.ts`, and half the brands' logos are light-ground
 * lockups (AlignSynch's wordmark is black "Align" beside gray "Synch"; QuizHub's is a
 * `fallback` placeholder the shell does not draw at all — see `lib/brand-mark.ts`). Compositing
 * a PNG lockup into a satori tree also means fetching and base64-ing bytes at render time for a
 * file whose ground was not designed for this one. The mark the *tab icon* uses is the letter
 * on the action ground, drawn by `scripts/gen-brand-icons.mjs`, and it is the one composition
 * that is correct on both brands and needs no second asset. `tests/brand-og.test.ts` holds the
 * two surfaces to the same letter and the same two colours.
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
import { brandInitial } from "@/lib/brand-initial";
import type React from "react";

/**
 * The box every crawler documents: 1200x630 is 1.91:1, which is Facebook's `og:image` size and
 * Twitter's `summary_large_image` — the one aspect ratio that is not cropped by either.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

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
          The icon's composition, inverted and scaled: the same square, the same radius, the
          same letter — in the two colours the record carries, so no third hex enters the tree.
        */}
        <div
          style={{
            display: "flex",
            width: 132,
            height: 132,
            borderRadius: 30,
            background: brand.colors.actionForeground,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 84,
              lineHeight: 1,
              color: brand.colors.action,
            }}
          >
            {brandInitial(brand.name)}
          </div>
        </div>
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
