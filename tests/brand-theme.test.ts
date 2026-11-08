/**
 * The two things the build does with a brand record, tested where they are pure.
 *
 * `lib/brand-theme.ts` turns the record's hex accents into the `H S% L%` triples
 * `tailwind.config.ts` expects on `<html>`, and decides which tokens travel at all;
 * `lib/brand-mark.ts` turns `brand.logo` into what `next/image` needs, or into `undefined`
 * for a placeholder. Both are React-free so this file can state their rules without a DOM —
 * and the rules are the card: the skin's palette is painted (accents, ground and ink), the
 * template's overrides are not, and the three roles the theme sheet has no default for
 * (`action`, `actionForeground`, `navActive` — issue #187) are painted for both brands.
 */
import { describe, expect, it } from "vitest";

import { isFileMedia } from "@/content/media";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { media } from "@/data/media";
import { brandMark } from "@/lib/brand-mark";
import { brandThemeVars, hslTriple } from "@/lib/brand-theme";

describe("hslTriple", () => {
  it("converts the sampled blue to the triple `hsl(var(--primary))` wants", () => {
    // #156898 -> hue 202, sat 75.7%, light 33.9%. Same colour, no `hsl()` wrapper: the
    // custom property is *inside* the function the theme already writes.
    expect(hslTriple("#156898")).toBe("202 75.7% 33.9%");
  });

  it("converts the sampled green, and expands a three-digit hex", () => {
    expect(hslTriple("#8dc63f")).toBe("85.3 54.2% 51.2%");
    expect(hslTriple("#fff")).toBe("0 0% 100%");
    expect(hslTriple("#000")).toBe("0 0% 0%");
  });

  it("passes an hsl() value through, in the same shape", () => {
    expect(hslTriple("hsl(0 0% 3.9%)")).toBe("0 0% 3.9%");
    expect(hslTriple("hsl(202, 75.7%, 33.9%)")).toBe("202 75.7% 33.9%");
  });
});

describe("brandThemeVars", () => {
  it("emits only the roles the theme sheet has no default for, on the template brand", () => {
    // Rule 3 (#187): `--action`, `--action-foreground` and `--nav-active` are not in
    // `app/globals.css`, so they cannot be "overrides" — an unset `hsl(var(--action))` is an
    // invalid declaration and `bg-action` would paint nothing. They are painted for every
    // brand; the template's *other* tokens still do not travel.
    expect(brandThemeVars(quizHubBrand)).toEqual({
      "--action": "238.7 83.5% 66.7%",
      "--action-foreground": "0 0% 100%",
      "--nav-active": "238.7 83.5% 66.7%",
    });
  });

  it("paints the skin's palette, its state shades, the ground and the ink", () => {
    // The owner's sheet (2026-11-03), measured into `H S% L%`: `#ffffff` -> `0 0% 100%`;
    // `#363d49` -> `217.9 15% 24.9%`; `#37474f` -> `200 17.9% 26.3%`; `#08add5` -> `191.7 92.8% 43.3%`;
    // `#2a373e` -> `200 20% 20.4%`; `#0693b8` -> `192.5 93.7% 37.3%`. The two state shades are
    // painted because the record names them: a brand that names none keeps `:root`'s 90 % step.
    expect(brandThemeVars(alignSynchBrand)).toEqual({
      "--background": "0 0% 100%",
      "--foreground": "217.9 15% 24.9%",
      "--primary": "200 17.9% 26.3%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "191.7 92.8% 43.3%",
      "--accent-foreground": "217.9 15% 24.9%",
      "--action": "200 17.9% 26.3%",
      "--action-foreground": "0 0% 100%",
      "--nav-active": "200 17.9% 26.3%",
      "--action-hover": "hsl(201 19.2% 20.4%)",
      "--accent-press": "hsl(192.5 93.7% 37.3%)",
    });
  });

  it("leaves a brand that names no state shade on the sheet's default", () => {
    // QuizHub's `<html>` carries the three roles the sheet has no default for and nothing else:
    // `--action-hover` / `--accent-press` come from `:root` as `hsl(var(--action) / 0.9)`, which is
    // the declaration `hover:bg-action/90` produced — the hover QuizHub always had.
    const vars = brandThemeVars(quizHubBrand);
    expect(vars["--action-hover"]).toBeUndefined();
    expect(vars["--accent-press"]).toBeUndefined();
  });

  it("keeps the ground and the ink for the brand that changes them", () => {
    // #157: the record's ground and ink paint, because the mark is black ink on white and
    // the old near-black ground hid two thirds of it. The template is untouched — the test
    // above is the proof that its values are skipped, not a shorter list.
    const vars = brandThemeVars(alignSynchBrand);
    expect(vars["--background"]).toBe(hslTriple(alignSynchBrand.colors.background));
    expect(vars["--foreground"]).toBe(hslTriple(alignSynchBrand.colors.foreground));
  });
});

describe("brandMark", () => {
  it("resolves the skin's logo to the size `next/image` needs", () => {
    expect(brandMark(alignSynchBrand.logo)).toEqual({
      src: "/brand/as2-logo_v2_cl.png",
      width: 818,
      height: 127,
    });
  });

  it("returns undefined for the template's placeholder, which the shell draws as an icon", () => {
    expect(brandMark(quizHubBrand.logo)).toBeUndefined();
    // The registry is what carries the decision, not a flag on the record.
    const fallback = Object.values(media).find(
      (entry) => isFileMedia(entry) && entry.src === quizHubBrand.logo,
    );
    expect(fallback?.kind).toBe("fallback");
  });

  it("returns undefined for a path the registry does not carry", () => {
    expect(brandMark("/brand/not-a-file.png")).toBeUndefined();
  });
});
