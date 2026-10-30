/**
 * The two things the build does with a brand record, tested where they are pure.
 *
 * `lib/brand-theme.ts` turns the record's hex accents into the `H S% L%` triples
 * `tailwind.config.ts` expects on `<html>`, and decides which tokens travel at all;
 * `lib/brand-mark.ts` turns `brand.logo` into what `next/image` needs, or into `undefined`
 * for a placeholder. Both are React-free so this file can state their rules without a DOM —
 * and the rules are the card: the skin's blue is painted, the template's markup is not
 * touched, and the ground and the ink stay the theme's.
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
  it("emits nothing for the template brand, so its markup does not move", () => {
    expect(brandThemeVars(quizHubBrand)).toEqual({});
  });

  it("paints the skin's sampled accents", () => {
    expect(brandThemeVars(alignSynchBrand)).toEqual({
      "--primary": "202 75.7% 33.9%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "85.3 54.2% 51.2%",
      "--accent-foreground": "0 0% 3.9%",
    });
  });

  it("never overrides the ground or the ink", () => {
    // The card pins both to the app's theme: `#363d49` on a near-black ground is 1.8:1, and
    // a brand-supplied background would be the second theme the card forbids.
    const vars = brandThemeVars(alignSynchBrand);
    expect(vars).not.toHaveProperty("--background");
    expect(vars).not.toHaveProperty("--foreground");
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
