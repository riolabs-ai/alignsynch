/**
 * The brand's accent tokens as CSS custom properties, for the one place that can paint them.
 *
 * `app/globals.css` owns the app's theme: `:root` is the light set, `.dark` is the same
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
 *   3. **`navActive` and `action` travel even though the template's values do not.** They are
 *      the two colours the schema carries that `app/globals.css` has no `:root` value for
 *      (#187), so "only what the brand changes" cannot apply to them: `hsl(var(--action))` with
 *      the variable unset is an invalid declaration and `bg-action` renders as nothing at all.
 *      So the always-painted list below is painted for *every* brand, and the cost is stated
 *      rather than hidden: the template build's `<html>` now carries a `style` attribute with
 *      three custom properties where it used to carry none. Its rendered colours do not move —
 *      `--action` is what `bg-action` paints, and before this card nothing painted it because
 *      nothing wrote the class.
 *
 *   4. **No `navActive` was a palette step, and now it is a variable.** The sidebar painted the
 *      active nav with the indigo 500 step and the record carried the same step under the role;
 *      with `--nav-active` painted, `bg-nav-active` reads the record. The old rule here said
 *      wiring it "is a different card's diff" — issue #187 is that card.
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

/**
 * The roles `app/globals.css` has no default for, painted for every brand (rule 3).
 *
 * They cannot be "overrides": there is no value underneath to override. A separate list rather
 * than a flag on `PAINTED` because the reason differs — one list is "what this brand changed",
 * this one is "what the sheet never had" — and a reader should be able to see which is which.
 */
const NO_THEME_DEFAULT: readonly (readonly [keyof BrandColors, string])[] = [
  ["action", "action"],
  ["actionForeground", "action-foreground"],
  ["navActive", "nav-active"],
];

/**
 * State shades a brand *may* own: the sheet has a default, so only a named value is painted.
 *
 * `--action-hover` and `--accent-press` default to `hsl(var(--action) / 0.9)` and
 * `hsl(var(--accent) / 0.9)` in `app/globals.css` — exactly the `hover:bg-action/90` step the
 * buttons painted before these keys existed, so a brand that names none (QuizHub) computes the
 * same hover it always did. A brand that names one (AlignSynch's graphite darkens to `#2A373E`)
 * gets a solid, darker press instead of a fade, which is the whole reason the key exists.
 */
const NAMED_STATES: readonly (readonly [keyof BrandColors, string])[] = [
  ["actionHover", "action-hover"],
  ["accentPress", "accent-press"],
];

/** The surface roles that paint, and the custom property each one resolves to. */
const SURFACE_ROLES: readonly (readonly [keyof BrandColors, string])[] = [
  ["paper", "paper"],
  ["mist", "mist"],
  ["sand", "sand"],
  ["line", "line"],
  ["pale", "pale"],
  ["mark", "mark"],
  ["deep", "deep"],
];

/**
 * The **surface** roles a page paints with (#853): grounds, a hairline, a marker and one ink.
 *
 * Deliberately *not* in `brandThemeVars`. That function's output is painted on `<html>`, so a role
 * added there is a custom property on **every** route of the build — and the parity harness puts
 * those vars on its wrapper for all seven snapshot routes, which means six renders nobody changed
 * would move their hashes. The page that needs these roles is one route; painting them where that
 * route renders keeps the change inside the change, and keeps the contract the card states ("the
 * QuizHub home may not move by a single byte") true without a mask.
 *
 * The resolver is the same one: a triple, because `tailwind.config.ts` wraps each entry as
 * `hsl(var(--paper))`. Nothing here is emitted for a brand that names no such role — QuizHub names
 * none, so its render carries no extra attribute at all.
 */
export function brandSurfaceVars(brand: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, token] of SURFACE_ROLES) {
    const value = brand.colors[key];
    if (value !== undefined) vars[`--${token}`] = hslTriple(value);
  }
  return vars;
}

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
 * The `<html>` style for a build: `{}` for the template brand's overrides plus the roles the
 * sheet has no default for, the changed accent tokens otherwise.
 */
export function brandThemeVars(brand: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, token] of PAINTED) {
    const value = brand.colors[key];
    if (value === undefined || value === quizHubBrand.colors[key]) continue;
    vars[`--${token}`] = hslTriple(value);
  }
  // No default underneath, so no override to compare against: always painted (rule 3).
  for (const [key, token] of NO_THEME_DEFAULT) {
    const value = brand.colors[key];
    // Required keys, but the indexed type is a union with the optional state shades.
    if (value !== undefined) vars[`--${token}`] = hslTriple(value);
  }
  // A state shade is an override of a sheet default, so it is painted only when the record names
  // one — `undefined` is "keep the sheet's 90 % step", not "paint nothing readable".
  //
  // **The value is a complete `hsl()` function, not a bare triple**, and that is the one place this
  // module's rule differs. Every other role is written as `H S% L%` because the Tailwind entry wraps
  // it (`hsl(var(--action))`), but `--action-hover` is read **unwrapped** — `hover: "var(--action-hover)"`
  // in `tailwind.config.ts`, because the sheet's default for it is already `hsl(var(--action) / 0.9)`.
  // A triple painted here therefore produced `background-color: 201 19.2% 20.4%`, which no parser
  // accepts: the declaration was dropped and the primary button lost its fill on hover while keeping
  // its white label — a button that vanished into a white page (#723). Both shapes must agree, and
  // the sheet's shape is the one Tailwind reads, so the painter meets it.
  for (const [key, token] of NAMED_STATES) {
    const value = brand.colors[key];
    if (value !== undefined) vars[`--${token}`] = `hsl(${hslTriple(value)})`;
  }
  return vars;
}
