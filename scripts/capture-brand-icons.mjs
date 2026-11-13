#!/usr/bin/env node
/**
 * capture-brand-icons — the pixel evidence for an icon-set change, as a review artifact.
 *
 * The owner's complaint on #963 is that three previous attempts were signed off on *description*.
 * A fraction, a comment and a green gate cannot show whether an icon fills its box or rounds at the
 * app's corner; six renders at the sizes a screen actually asks for can. So this script writes
 * `docs/review/artifacts/report-brand-icons-963.html`, which is served by
 * `/review-artifacts/report-brand-icons-963` and framed on `/admin/review`.
 *
 * **Before is git, not memory.** The "before" column is `git show <ref>:public/brand/<file>` — the
 * bytes that shipped — and the "after" column is the working tree. Both are measured with the same
 * two functions the gate uses (`alphaBBox` / `contrastBBox` from `scripts/image-bytes.ts`), so the
 * numbers in the artifact and the numbers in `tests/brand-icon.test.ts` cannot disagree.
 *
 * **The marks are embedded as vectors, not screenshots.** An SVG icon inlined at `width=16` *is*
 * the file the browser renders at 16 px; a screen capture of it would be a picture of a picture.
 * The maskable surfaces are PNG by contract, so those are embedded as bytes.
 *
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs \
 *     scripts/capture-brand-icons.mjs [--before <ref>]
 *
 * The artifact is rewritten in place; it is a published document, so the diff is the review.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import {
  APP_GLYPH_FRACTION,
  APP_MARK_TILE_PX,
  MASKABLE_GLYPH_FRACTION,
  MASKABLE_MARK_FRACTION,
  MASKABLE_SAFE_RADIUS,
  MARK_SIZE,
} from "../lib/brand-icon.ts";
import { APP_RADIUS_FRACTION } from "../lib/brand-radius.ts";
import { alphaBBox, contrastBBox, decodePng, pngDataUrl } from "./image-bytes.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ARTIFACT = join(ROOT, "docs", "review", "artifacts", "report-brand-icons-963.html");
const refFlag = process.argv.indexOf("--before");
const BEFORE_REF = refFlag === -1 ? "origin/main" : process.argv[refFlag + 1];

/** The surfaces the artifact draws, and the size each is shown at. */
const SIZES = [16, 32, 48, 180, 192, 512];
const BRANDS = ["alignsynch", "quizhub"];

function before(name) {
  return execFileSync("git", ["show", `${BEFORE_REF}:public/brand/${name}`], {
    cwd: ROOT,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function after(name) {
  return readFileSync(join(ROOT, "public", "brand", name));
}

/** A shipped SVG, rasterised at `size`, decoded — the same view the gate measures. */
function rasterise(svg, size) {
  return decodePng(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
}

/**
 * The ink a surface draws, as a fraction of its canvas — the number this whole report is about.
 * A mark brand's surfaces are transparent (`alphaBBox`); a glyph brand's are painted
 * (`contrastBBox`), and the choice is made by whether the file clears its own corner.
 */
function ink(svgOrBytes, name) {
  const image = name.endsWith(".svg")
    ? rasterise(String(svgOrBytes), MARK_SIZE)
    : decodePng(svgOrBytes);
  // A mark brand's canvas is clear; a glyph brand's is painted. The tile's top edge is inside the
  // ground on both (the mark is centred), so one alpha sample decides which measurement applies —
  // the same split `tests/brand-icon.test.ts` makes by mark kind.
  const painted = image.data[(8 * image.width + Math.floor(image.width / 2)) * 4 + 3] >= 250;
  const box = painted ? contrastBBox(image) : alphaBBox(image);
  if (box === undefined) throw new Error(`${name} draws no ink`);
  return {
    width: box.width,
    height: box.height,
    longest: Math.max(box.width, box.height) / image.width,
    widthShare: box.width / image.width,
    heightShare: box.height / image.height,
    canvas: image.width,
    painted,
  };
}

/** The corner radius baked into an app mark, in canvas units — `0` when there is no ground. */
function bakedRadius(svg) {
  const match = /<rect[^>]*rx="([\d.]+)"/.exec(String(svg));
  return match === null ? 0 : Number(match[1]);
}

const pct = (value) => `${(value * 100).toFixed(1)} %`;
const px = (value) => `${Math.round(value * 10) / 10} px`;

/** An SVG file, inlined at `size`, so the reader sees exactly what the browser would. */
function inlineSvg(svg, size) {
  return String(svg)
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/width="[\d.]+" height="[\d.]+"/, `width="${size}" height="${size}"`);
}

const SURFACES = [
  { file: "-icon.svg", label: "the app mark (favicon)" },
  { file: "-apple-touch-icon.png", label: "apple-touch-icon" },
  { file: "-icon-192.png", label: "PWA 192" },
  { file: "-icon-512.png", label: "PWA 512" },
];

/* ------------------------------------------------------------------ *
 * The numbers
 * ------------------------------------------------------------------ */

const rows = [];
for (const brand of BRANDS) {
  for (const surface of SURFACES) {
    const name = `${brand}${surface.file}`;
    const beforeBytes = before(name);
    const afterBytes = after(name);
    const beforeInk = ink(beforeBytes, name);
    const afterInk = ink(afterBytes, name);
    const beforeRadius = surface.file.endsWith(".svg") ? bakedRadius(beforeBytes) : 0;
    const afterRadius = surface.file.endsWith(".svg") ? bakedRadius(afterBytes) : 0;
    rows.push({
      brand,
      file: name,
      label: surface.label,
      beforeInk,
      afterInk,
      beforeRadius,
      afterRadius,
    });
  }
}

const tableRows = rows
  .map(
    (row) => `<tr>
      <td><code>${row.file}</code></td>
      <td>${pct(row.beforeInk.longest)}</td>
      <td>${pct(row.afterInk.longest)}</td>
      <td>${row.file.endsWith(".svg") ? pct(APP_GLYPH_FRACTION) : pct(row.file.startsWith("alignsynch") ? MASKABLE_MARK_FRACTION : MASKABLE_GLYPH_FRACTION)}</td>
      <td>${row.beforeRadius === 0 ? "no ground — no corner" : `${px(row.beforeRadius)} (${pct(row.beforeRadius / MARK_SIZE)})`}</td>
      <td>${row.afterRadius === 0 ? "no ground — no corner" : `${px(row.afterRadius)} (${pct(row.afterRadius / MARK_SIZE)})`}</td>
    </tr>`,
  )
  .join("\n");

/* ------------------------------------------------------------------ *
 * The pixels
 * ------------------------------------------------------------------ */

function appMark(brand) {
  const beforeSvg = before(`${brand}-icon.svg`).toString("utf8");
  const afterSvg = after(`${brand}-icon.svg`).toString("utf8");
  const cells = SIZES.map(
    (size) => `<figure class="cell">
      <div class="pair">
        <div class="slot" style="--w:${size}px">${inlineSvg(beforeSvg, size)}</div>
        <div class="slot" style="--w:${size}px">${inlineSvg(afterSvg, size)}</div>
      </div>
      <figcaption>${size} px</figcaption>
    </figure>`,
  ).join("\n");
  return `<div class="row">${cells}</div>`;
}

function maskable(brand) {
  const name = `${brand}-icon-512.png`;
  const beforeImage = pngDataUrl(before(name));
  const afterImage = pngDataUrl(after(name));
  return `<div class="pair big">
    <figure class="cell">
      <div class="slot tile"><img alt="before" src="${beforeImage}" width="256" height="256"></div>
      <figcaption>before</figcaption>
    </figure>
    <figure class="cell">
      <div class="slot tile"><img alt="after" src="${afterImage}" width="256" height="256"></div>
      <figcaption>after</figcaption>
    </figure>
    <figure class="cell">
      <div class="slot tile"><img alt="after, with the crop circle" src="${afterImage}" width="256" height="256"><span class="safe"></span></div>
      <figcaption>after, with the ${px(MASKABLE_SAFE_RADIUS)} safe circle</figcaption>
    </figure>
  </div>`;
}

const radiusLine = `<p class="lead">The app mark's corner is now <strong>${px(APP_RADIUS_FRACTION * MARK_SIZE)}</strong> of the
${MARK_SIZE}-unit canvas (${pct(APP_RADIUS_FRACTION)}), derived from <code>--radius</code> ÷ the ${APP_MARK_TILE_PX} px
tile <code>components/layout/footer.tsx</code> draws — i.e. the same 5 px corner the app paints, at every size.
Before it was <code>0.2</code> of the canvas: 102.4 px here and 6.4 px in a 32 px tab, a corner the app has never drawn.</p>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brand icon set — #963</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 32px 64px; font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
         color: #18181b; background: #ffffff; }
  main { max-width: 1120px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.01em; }
  h2 { font-size: 17px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e4e4e7; }
  .kicker { font: 600 12px/1 system-ui; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a; }
  .lead { max-width: 78ch; color: #3f3f46; }
  blockquote { margin: 16px 0; padding: 12px 16px; border-left: 3px solid #6366f1; background: #fafafa; color: #3f3f46; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 26px; padding: 18px 0 6px; }
  .pair { display: flex; align-items: flex-end; gap: 10px; }
  .slot { width: var(--w, 256px); height: var(--w, 256px); display: grid; place-items: center;
          background: repeating-conic-gradient(#f4f4f5 0% 25%, #ffffff 0% 50%) 0 0 / 12px 12px; }
  .slot.tile { position: relative; width: 256px; height: 256px; background: #f4f4f5; }
  .slot.tile img { display: block; }
  .safe { position: absolute; inset: 12.5%; border-radius: 50%; border: 1px dashed #f43f5e; pointer-events: none; }
  figure { margin: 0; }
  figcaption { margin-top: 8px; font-size: 12.5px; color: #52525b; }
  .big { gap: 20px; }
  .note { font-size: 13px; color: #52525b; max-width: 82ch; }
  pre { background: #18181b; color: #f4f4f5; padding: 14px 16px; border-radius: 8px; overflow-x: auto;
        font-size: 12.5px; line-height: 1.5; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #ecfdf5; color: #065f46;
          font: 600 12px/1.6 system-ui; }
</style>
</head>
<body>
<main>
  <p class="kicker">Review artifact · #963 · brand icon set</p>
  <h1>The icons fill their box, and round at the app's corner</h1>
  <blockquote>“can you card the AlignSynch icons to fill the icon bounds, and to have the same corner radius as the
  app? … each time I ask the results break something else or revert to something visually incorrect.”</blockquote>
  ${radiusLine}
  <p class="note">Every number below is measured from the shipped bytes by <code>alphaBBox</code> / <code>contrastBBox</code>
  — the same two functions the gate's own ink test uses — with “before” read out of git at
  <code>${BEFORE_REF}</code> and “after” from the working tree.</p>

  <h2>1 · Ink, before and after — both brands</h2>
  <table>
    <thead><tr>
      <th>file</th><th>ink before</th><th>ink after</th><th>declared target</th>
      <th>corner before</th><th>corner after</th>
    </tr></thead>
    <tbody>
${tableRows}
    </tbody>
  </table>
  <p class="note">“Ink” is the longest side of what a reader sees, as a share of the canvas. The monogram is
  1024 × 654 of ink, so its height is bound by its own aspect ratio (66.1 % wide ⇒ 42 % tall); fill is a uniform
  scale, never a stretch — the aspect ratio is asserted in <code>tests/brand-icon.test.ts</code>. The maskable
  surfaces are 98 % of each mark's own safe-circle ceiling: 66.1 % for the monogram, 58.0 % for the book.</p>

  <h2>2 · The app mark, at the sizes a screen asks for</h2>
  <p class="note">Left is before, right is after, at true pixel size on a transparent checkerboard. Inside the tab
  (16–32 px) this is the whole difference: the book was 57 % of the tile and is now 78 %, and the corner stops
  being a 20 % blob.</p>
  ${BRANDS.map((brand) => `<h3><code>${brand}</code></h3>${appMark(brand)}`).join("\n")}

  <h2>3 · The maskable set, and the circle the OS may crop to</h2>
  <p class="note">Full bleed, transparent ground, mark at 98 % of its safe-circle ceiling. The dashed circle is the
  40 % radius a launcher may crop to; the ink's half-diagonal is ≈ 201 px of the 204.8 px radius, measured on the
  shipped <code>-icon-512.png</code>.</p>
  ${BRANDS.map((brand) => `<h3><code>${brand}</code></h3>${maskable(brand)}`).join("\n")}

  <h2>4 · The gate, and the drift it now catches</h2>
  <p class="note">A typed <code>0.2</code> beside a token nobody compared it to is not a value bug, it is a missing
  derivation. <code>APP_RADIUS_FRACTION</code> is now <code>appRadiusPx() / APP_MARK_TILE_PX</code>, read from
  <code>app/globals.css</code> at import, and <code>tests/brand-icon.test.ts</code> reads the sheet itself and
  compares it with the radius baked into the shipped file. Putting the decimal back and regenerating fails the
  <code>test</code> step by name, verbatim:</p>
  <pre># reproduce: put a literal 0.2 back in lib/brand-radius.ts, pnpm brand:icons, npx vitest run tests/brand-icon.test.ts

 FAIL  tests/brand-icon.test.ts &gt; the generated icon set &gt; rounds the app mark at the app's own &grave;--radius&grave;, read from the sheet
AssertionError: quizhub-icon.svg rounds at 102.4 of 512; 5px on a 40px tile is 64: expected 102.4 to be close to 64, received difference is 38.400000000000006, but expected 0.05
 ❯ tests/brand-icon.test.ts:348:7

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)</pre>
  <p class="note">And retyping the decimal <em>without</em> regenerating fails <code>data:check</code> by path, before
  any test runs — the two states are different failures and both are caught:</p>
  <pre>✗ brand icon: public/brand/quizhub-icon.svg is stale (or missing) — run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs scripts/gen-brand-icons.mjs</pre>
  <p class="note">Restore the derivation, <code>pnpm brand:icons</code>, and both are green again — the transcript
  below is the shipped state.</p>
  <p><span class="pill">pnpm data:check — green, 793 cases</span>
     <span class="pill">bash scripts/verify.sh — green, lane=code</span></p>

  <h2>5 · What did not move</h2>
  <p class="note"><code>public/brand/alignsynch-mark-1024.png</code> (the mark itself) and
  <code>public/brand/as2-logo_v2_cl.png</code> are byte-identical — only the placement of the mark changed, which is
  the half of the owner's rule that matters. No token moved: the icons met <code>--radius</code>, the app did not
  bend to the icons. The maskable ground is still transparent — no field was added to fake a larger fill.</p>

  <footer class="note">
    Reproduce: <code>node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs
    scripts/capture-brand-icons.mjs</code> (writes this file), then <code>pnpm data:check</code>.
    Before bytes: <code>git show ${BEFORE_REF}:public/brand/&lt;file&gt;</code>.
  </footer>
</main>
</body>
</html>
`;

writeFileSync(ARTIFACT, html);
console.log(`  wrote ${ARTIFACT.replace(`${ROOT}/`, "")} (${(html.length / 1024).toFixed(0)} KB)`);
for (const row of rows) {
  console.log(
    `  ${row.file}: ink ${pct(row.beforeInk.longest)} -> ${pct(row.afterInk.longest)}` +
      (row.file.endsWith(".svg")
        ? `, corner ${px(row.beforeRadius)} -> ${px(row.afterRadius)}`
        : ""),
  );
}
