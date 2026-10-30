/**
 * The generated avatar (issue #152) — the claims this slice is accepted on:
 *
 *   two different people get different gradients, the same person always gets the same
 *   one, the initials are the first letter of up to two words, and the text colour clears
 *   WCAG AA (4.5:1) against the background it is painted on.
 *
 * Measured from the markup the component actually emits, not from the pure functions
 * alone: `renderToStaticMarkup` hands back the `background-image` and `color` as real
 * strings, so a component that computed a nice gradient and then painted something else
 * fails here. Nothing needs a DOM or a router, which is the point of the component being
 * a Server Component.
 *
 * The contrast ratio is recomputed here from WCAG 2.x's own definition
 * (`(L1 + 0.05) / (L2 + 0.05)` over relative luminance) rather than by calling the
 * component's helper, so the assertion is an independent reading of the painted pair and
 * not the component agreeing with itself.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GeneratedAvatar,
  avatarGradient,
  initialsOf,
  seedHash,
} from "@/components/media/generated-avatar";

type AvatarProps = { name: string; seed: string; className?: string; size?: number };

const render = (props: AvatarProps) => renderToStaticMarkup(createElement(GeneratedAvatar, props));

/** The `linear-gradient(…)` the avatar painted, or `undefined` when it painted none. */
const gradientIn = (html: string): string | undefined =>
  /background-image:\s*([^";]+)/.exec(html)?.[1];

/** The `#rrggbb` the initials were painted in, from the same `style` attribute. */
const inkIn = (html: string): string | undefined => /color:\s*(#[0-9a-f]{6})/i.exec(html)?.[1];

/**
 * The two stops of the painted gradient, base first. Throws with the gradient in the
 * message when the shape is not the documented `linear-gradient(<deg>, <stop> 0%, … 100%)`
 * — a silently unmatched regex would otherwise turn this file into 620 no-ops.
 */
const stopsIn = (gradient: string | undefined, where: string): [string, string] => {
  const match = /linear-gradient\((\d+)deg,\s*(#[0-9a-f]{6})\s+0%,\s*(#[0-9a-f]{6})\s+100%\)/i.exec(
    gradient ?? "",
  );
  if (match === null) throw new Error(`${where}: no 2-stop gradient in "${String(gradient)}"`);
  return [match[2], match[3]];
};

const channels = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

/** WCAG 2.x relative luminance, from the hex the browser would receive. */
const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** The ten people `public/avatars/` names today — the seeds part 2 will pass in. */
const ROSTER_SEEDS = [
  "alex",
  "brain",
  "champion",
  "genious",
  "guru",
  "king",
  "master",
  "mind",
  "sarah",
  "wizard",
];

/** The roster plus 300 synthetic ids, so the sweep is about the mapping, not the roster. */
const SWEEP_SEEDS = [
  ...ROSTER_SEEDS,
  ...Array.from({ length: 300 }, (_, index) => `person/${index}`),
];

/** The component's documented ink pair — it must never paint a third colour. */
const INKS = ["#ffffff", "#0b0f17"];

describe("GeneratedAvatar", () => {
  it("paints two different people different gradients", () => {
    const ada = render({ name: "Ada Lovelace", seed: "ada" });
    const grace = render({ name: "Grace Hopper", seed: "grace" });

    const adaGradient = gradientIn(ada);
    const graceGradient = gradientIn(grace);

    expect(adaGradient, `no gradient in ${ada}`).toBeTypeOf("string");
    expect(graceGradient, `no gradient in ${grace}`).toBeTypeOf("string");
    expect(adaGradient).not.toEqual(graceGradient);
  });

  it("never gives two people on the roster the same gradient", () => {
    const painted = ROSTER_SEEDS.map((seed) => ({
      seed,
      gradient: String(gradientIn(render({ name: seed, seed }))),
    }));

    const owners = new Map<string, string>();
    for (const { seed, gradient } of painted) {
      const owner = owners.get(gradient);
      expect(owner, `"${seed}" and "${owner}" share the gradient ${gradient}`).toBeUndefined();
      owners.set(gradient, seed);
    }
    expect(owners.size).toBe(ROSTER_SEEDS.length);
  });

  it("gives the same person the identical gradient string every time", () => {
    const first = render({ name: "Ada Lovelace", seed: "ada" });
    const again = render({ name: "Ada Lovelace", seed: "ada" });

    expect(gradientIn(again)).toEqual(gradientIn(first));
    expect(again).toEqual(first);
    expect(avatarGradient("ada")).toEqual(avatarGradient("ada"));
  });

  it("seeds the gradient from the seed, not from the name or render order", () => {
    // One seed, two names: same colour, different initials — the colour is the identity's.
    expect(gradientIn(render({ name: "Ada Lovelace", seed: "ada" }))).toEqual(
      gradientIn(render({ name: "A. L.", seed: "ada" })),
    );
    // One name, two seeds: different colour — the name contributes nothing to the hue.
    expect(gradientIn(render({ name: "Ada Lovelace", seed: "ada" }))).not.toEqual(
      gradientIn(render({ name: "Ada Lovelace", seed: "ada-l" })),
    );
    expect(seedHash("ada")).not.toEqual(seedHash("ada-l"));
  });

  it("takes the initials from the first letter of up to two words", () => {
    expect(initialsOf("Ada")).toBe("A");
    expect(initialsOf("ada")).toBe("A");
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("Ada Lovelace King")).toBe("AL");
    expect(initialsOf("  grace   brewster murray hopper  ")).toBe("GB");
    expect(initialsOf("?")).toBe("?");
    expect(initialsOf("   ")).toBe("?");

    expect(render({ name: "Ada Lovelace", seed: "ada" })).toContain(">AL<");
    expect(render({ name: "Ada", seed: "ada" })).toContain(">A<");
    expect(render({ name: "Ada Lovelace King", seed: "ada" })).toContain(">AL<");
  });

  it("chooses a text colour that clears 4.5:1 against both stops", () => {
    const inksPainted = new Set<string>();

    for (const seed of SWEEP_SEEDS) {
      const html = render({ name: "Ada Lovelace", seed });
      const stops = stopsIn(gradientIn(html), `seed "${seed}"`);
      const ink = inkIn(html);

      expect(ink, `seed "${seed}" painted no text colour in ${html}`).toBeTypeOf("string");
      expect(INKS, `seed "${seed}" painted an undocumented ink ${ink}`).toContain(ink);
      inksPainted.add(String(ink));

      for (const [index, stop] of stops.entries()) {
        const ratio = contrast(stop, String(ink));
        expect(
          ratio,
          `seed "${seed}" stop ${index}: ${ink} on ${stop} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    // Both halves of the choice are exercised: a "compute it" that always returns white
    // would pass the loop above and fail this line.
    expect(inksPainted.size).toBe(INKS.length);
  });

  it("renders no image, at the default size, with className passed through", () => {
    const html = render({ name: "Ada Lovelace", seed: "ada" });

    expect(html).not.toContain("<img");
    expect(html).not.toContain("url(");
    expect(html).toContain("width:40px");
    expect(html).toContain("height:40px");
    expect(html).toContain('aria-label="Ada Lovelace"');
    expect(html).toContain('role="img"');

    const bigger = render({ name: "Ada", seed: "ada", size: 96, className: "ring-2 ring-white" });
    expect(bigger).toContain("width:96px");
    expect(bigger).toContain("ring-2 ring-white");
  });

  it("is a Server Component: no client directive, no hook, no clock", () => {
    const source = readFileSync(
      new URL("../components/media/generated-avatar.tsx", import.meta.url),
      "utf8",
    );
    // The prose above the component names the traps it avoids ("never `Math.random()`"),
    // so the assertions read the code with the comments stripped, not the explanation.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    expect(code).not.toContain('"use client"');
    expect(code).not.toContain("'use client'");
    // It imports nothing from React, so it cannot hold a hook or a client-only API.
    expect(code).not.toMatch(/from\s+"react"/);
    // No randomness, no clock: the gradient must not depend on when it is rendered.
    expect(code).not.toContain("Math.random");
    expect(code).not.toMatch(/\bDate\b/);
  });
});
