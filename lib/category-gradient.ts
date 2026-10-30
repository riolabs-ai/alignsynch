/**
 * The generated category tile — a gradient seeded by the slug, a monogram from the name
 * (issue #130).
 *
 * Twenty-three `public/category/*.webp` files were one and the same PNG (blob `df44187d`),
 * so the tile is drawn instead of shipped: no bytes, no request, and every subject looks
 * like itself rather than like the same grey placeholder.
 *
 * The seed is the **slug**, not an index in the roster and not `Math.random()`:
 *
 *   - an index changes every tile when the taxonomy is reordered or a subject is inserted;
 *   - a random or clock-derived seed is the hydration bug AGENTS.md warns about — the
 *     server renders one gradient and the browser renders another;
 *   - the slug is the subject's stable identity (it is the URL segment), so the same
 *     subject keeps the same tile in the static build, in the browser, and after a
 *     rename-free edit.
 *
 * Three fields come out of the 32-bit seed — two hues and an angle — so the space is
 * ~10^5 gradients. `tests/category-tile.test.ts` asserts no two of the twenty-five real
 * subjects share one; that test is what turns "never the same gradient" from a promise
 * into a check.
 */

export interface CategoryGradient {
  /** Background angle in degrees — a multiple of 45, so the tiles read as one set. */
  readonly angle: number;
  /** Start hue in `[0, 360)`. */
  readonly fromHue: number;
  /** End hue in `[0, 360)`, at least 40° from `fromHue` so the stops never collapse. */
  readonly toHue: number;
  /** The `linear-gradient(…)` string the tile puts in `backgroundImage`. */
  readonly css: string;
}

/**
 * FNV-1a, 32-bit. Deterministic, dependency-free and unsigned — the seed only has to be
 * stable and well spread, not cryptographic.
 */
export function slugSeed(slug: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const hsl = (hue: number, saturation: number, lightness: number) =>
  `hsl(${hue} ${saturation}% ${lightness}%)`;

/** The gradient one category tile is drawn with. Pure: same slug, same string, always. */
export function gradientFor(slug: string): CategoryGradient {
  const seed = slugSeed(slug);
  const fromHue = seed % 360;
  const toHue = (fromHue + 40 + (Math.floor(seed / 360) % 200)) % 360;
  const angle = 45 + (Math.floor(seed / 72000) % 8) * 45;

  return {
    angle,
    fromHue,
    toHue,
    css: `linear-gradient(${angle}deg, ${hsl(fromHue, 58, 42)} 0%, ${hsl(toHue, 62, 28)} 100%)`,
  };
}

/**
 * `General Knowledge` -> `GK`, `Video Game` -> `VG`, `Animal` -> `A`.
 *
 * First and last initial for a multi-word name, because the middle words of a long label
 * are the ones a monogram can drop. Never empty for a real category: the schema already
 * requires a non-empty `name`, and a blank tile would be a worse failure than a `?`.
 */
export function monogramOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  if (words.length === 1) return first.toUpperCase();
  return (first + words[words.length - 1].charAt(0)).toUpperCase();
}
