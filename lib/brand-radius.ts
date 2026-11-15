/**
 * The app mark's corner radius — **derived from the token, never retyped** (#963).
 *
 * The icon set shipped a corner of `0.2 × 512 = 102 px` under a comment that called it "the
 * `rounded-lg` the chrome draws", while `app/globals.css` has said `--radius: 0.3125rem` — 5 px —
 * for a long time. A typed decimal beside a token nothing compares it to is not a bug in a value;
 * it is a *missing derivation*, and every future edit that retypes it looks exactly like a fix.
 *
 * So the fraction is computed here, every time this module is imported, from two things that are
 * not this file:
 *
 *   - `--radius` in `app/globals.css`, the app's one corner token (`tailwind.config.ts`:
 *     `rounded-lg` is `var(--radius)`, `rounded-md` is `var(--radius) - 2px`);
 *   - `APP_MARK_TILE_PX`, the tile `components/layout/footer.tsx` draws the app mark in — `p-2`
 *     around an `h-6 w-6` glyph, i.e. 40 px.
 *
 * `5 / 40 = 0.125`, which at the 512-unit canvas is a 64-unit corner — the same *ratio* the app
 * paints, so the tab icon, the home-screen tile and the in-app tile round together at every size.
 * A fixed length could never do that: `0.2` coincides with 5 px only at a 25 px box.
 *
 * **Node-only, deliberately.** `lib/brand-icon.ts` is imported by the in-app chrome and must stay
 * free of `node:fs` (a client module that value-imports this one would break the browser graph —
 * `data:check` E34). The generator (`scripts/gen-brand-icons.mjs`) and the drift test
 * (`tests/brand-icon.test.ts`) are the only two callers, and both run under plain node from the
 * repository root, which is why `process.cwd()` is the root this file reads.
 *
 * The drift test does **not** trust this module: it re-reads `--radius` and the tile on its own
 * and compares them with the radius baked into `public/brand/quizhub-icon.svg`. That is the case
 * that fails when somebody puts a decimal back — which is the whole point of the card.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_MARK_TILE_PX } from "./brand-icon";

/** The root font size a `rem` resolves against in the browser (and in the app's own CSS). */
export const ROOT_FONT_PX = 16;

/**
 * The `--radius` declaration in `app/globals.css`, in `rem`.
 *
 * The declaration form only (`--radius:` at the start of a line): the file's comments discuss the
 * token's history at length, and a parser that accepted those would derive a corner from prose.
 * Exactly one declaration must exist — two would mean the sheet disagrees with itself, which is a
 * failure to state rather than a value to pick.
 */
export function appRadiusRem(css?: string): number {
  const source = css ?? readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
  const declarations = [...source.matchAll(/^\s*--radius:\s*([\d.]+)rem;\s*$/gm)];
  if (declarations.length !== 1) {
    throw new Error(
      `app/globals.css declares --radius ${declarations.length} times; the icons derive their corner from exactly one.`,
    );
  }
  return Number(declarations[0][1]);
}

/** The `--radius` token in px at the 16 px root — 5 px on the current sheet. */
export function appRadiusPx(css?: string): number {
  return appRadiusRem(css) * ROOT_FONT_PX;
}

/**
 * The corner radius as a fraction of the canvas: the token ÷ the reference tile.
 *
 * Both are lengths, so the fraction is the *ratio* the app paints — which is the only thing that
 * survives being drawn at 16 px, 180 px and 512 px.
 */
export const APP_RADIUS_FRACTION = appRadiusPx() / APP_MARK_TILE_PX;
