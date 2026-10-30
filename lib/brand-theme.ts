/**
 * The brand's accent tokens as CSS custom properties, for the one place that can paint them.
 *
 * `styles/globals.css` owns the app's theme: `:root` is the light set, `.dark` is the same
 * tokens at night, and Tailwind's `bg-primary` / `text-accent` resolve through them
 * (`primary: "hsl(var(--primary))"` in `tailwind.config.ts`). A brand record carries the
 * same token names with resolved values, and this module is the bridge: hex or `hsl()` in
 * the record, an `H S% L%` triple on `<html>`, so a skin's blue is what `bg-primary`
 * actually paints instead of a value nothing reads.
 *
 * Three rules decide *which* tokens travel, and each one is a card decision rather than a
 * convenience:
 *
 *   1. **Only what the brand changes.** A token equal to the template's is not emitted at
 *      all, so the default build's `<html>` has no `style` attribute and every one of its
 *      pages renders the bytes it rendered before this module existed. Identity comparison
 *      would have been enough for that, but the per-token rule also states the intent: a
 *      skin overrides what it owns.
 *   2. **The ground and the ink too.** `background` and `foreground` travel with the accents
 *      (issue #157). AlignSynch's mark is black ink on white — the logo is 53.7% pure
 *      `#000000` — so a near-black ground erased two thirds of the mark, and the brand's
 *      slate `#363d49` ink measured 1.8:1 on that ground. The record's ground and ink are
 *      what the page paints now; `data/brands/alignsynch.ts` says so at the fields. The
 *      guard against a second theme is rule 1, not a shorter list: the template's values
 *      are skipped, so its markup still carries no `style` attribute.
 *   3. **No `navActive`.** It is the one colour in the schema that is not a custom property
 *      (the sidebar paints it as a Tailwind palette step), so there is no `var(--nav-active)`
 *      to set. Wiring it means changing the class the sidebar writes, which is a different
 *      card's diff.
 *
 * `!important` and specificity games are deliberate non-features: the variables are written
 * as an inline style on `<html>`, which outranks `:root` and `.dark` without them. That is
 * the point — in *both* modes `bg-primary` is the brand's blue, because the logo is the
 * accent the brand is built around, not a light-mode variation of it.
 *
 * React-free and framework-free: `app/layout.tsx` imports it on the server, and a test can
 * call it without a DOM.
 */
import type { Brand, BrandColors } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";

/** The brand colours that paint, and the custom property each one resolves to. */
const PAINTED: readonly (readonly [keyof BrandColors, string])[] = [
  ["background", "background"],
  ["foreground", "foreground"],
  ["primary", "primary"],
  ["primaryForeground", "primary-foreground"],
  ["accent", "accent"],
  ["accentForeground", "accent-foreground"],
];

/** `#156898` -> `"202 75.7% 33.9%"`, which is what `hsl(var(--primary))` expects. */
export function hslTriple(color: string): string {
  const text = color.trim().toLowerCase();
  if (text.startsWith("hsl")) {
    const [h, s, l] = text
      .slice(text.indexOf("(") + 1, text.indexOf(")"))
      .split(/[\s,/]+/)
      .filter(Boolean);
    return `${hue(h)} ${percent(s)} ${percent(l)}`;
  }
  const hex = text.replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : hex;
  const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return `0 0% ${trim(lightness * 100)}%`;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const raw =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const degrees = (raw * 60 + 360) % 360;
  return `${trim(degrees)} ${trim(saturation * 100)}% ${trim(lightness * 100)}%`;
}

/** One decimal at most, and no trailing `.0` — `202` reads better than `202.0`. */
function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function hue(value: string): string {
  return trim(Number.parseFloat(value.replace(/deg$/, "")));
}

function percent(value: string): string {
  const number = Number.parseFloat(value.replace(/%$/, ""));
  return `${trim(number)}%`;
}

/**
 * The `<html>` style for a build: `{}` for the template brand (nothing to override), the
 * changed accent tokens otherwise.
 */
export function brandThemeVars(brand: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, token] of PAINTED) {
    if (brand.colors[key] === quizHubBrand.colors[key]) continue;
    vars[`--${token}`] = hslTriple(brand.colors[key]);
  }
  return vars;
}
