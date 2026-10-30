import { cn } from "@/lib/utils";

/**
 * GeneratedAvatar — initials on a colour, no bytes (issue #152).
 *
 * Nine files under `public/avatars/` were two images (`dcb060a3` five times, `55d92864`
 * four), so nine people shared two faces. An avatar is now drawn instead of shipped:
 * the person's initials over a gradient seeded by their identity. No `src`, no request,
 * nothing for the build to fetch, and no invented portrait — a face is never fabricated,
 * it is a monogram on colour.
 *
 * The seed is the person's **stable id** (a handle or a `data/people.ts` id), never an
 * array index and never `Math.random()`:
 *
 *   - an index re-colours every avatar when the roster is reordered or a person is
 *     inserted;
 *   - a random or clock-derived seed is the hydration bug AGENTS.md warns about — the
 *     server paints one gradient and the browser repaints another. It would also make
 *     every visual test unstable.
 *
 * Everything below is a pure function of the seed string, so the same person is the same
 * colour in the static build, in the browser, and in a screenshot diff.
 *
 * HASH — FNV-1a, 32-bit, over the UTF-16 code units of the seed: `h = (h ^ code) *
 * 0x01000193`, offset basis `0x811c9dc5`, returned unsigned. The same hash
 * `lib/category-gradient.ts` uses for slugs — dependency-free, well spread, and stable
 * across Node versions.
 *
 * MAPPING — each field is a disjoint slice of those 32 bits, so two seeds that happen to
 * share a hue do not also share an angle or a lightness:
 *
 *   h = seedHash(seed)
 *   fromHue    = h % 360                       0..359
 *   toHue      = (fromHue + 32 + (h >>> 9) % 96) % 360      32..127 deg from fromHue
 *   angle      = 45 * (1 + (h >>> 17) % 8)     45..360, in 45 deg steps
 *   saturation = 52 + (h >>> 11) % 17          52..68 %
 *   theme      = (h >>> 5) % 4 === 0           pale (25 %), else saturated (75 %)
 *
 * LIGHTNESS is deliberately not a slice of the hash. Under HSL two hues with the same L
 * have wildly different WCAG luminances — `hsl(60 60% 42%)` is 2.5:1 against white while
 * `hsl(240 60% 42%)` is 8.7:1 — so a fixed L makes the text colour a per-hue guess. Each
 * stop is instead **solved** for a target relative luminance inside its theme's band:
 * binary-search the HSL lightness, which is monotonic in luminance for a fixed hue and
 * saturation, until the stop's relative luminance is within 1e-4 of the target.
 *
 *   theme  stop 0 Y          stop 1 Y                ink
 *   dark   0.055/0.085/0.115 stop 0 − 0.035          #ffffff, worst case 6.4:1
 *   pale   0.46/0.52/0.58    stop 0 + 0.04 (≤ 0.62)  #0b0f17, worst case 9.4:1
 *
 * The `ink` is then *chosen*, not assumed: of `#ffffff` and `#0b0f17`, whichever scores
 * the higher minimum WCAG contrast over **both** stops, so the letters stay legible across
 * the whole face of the disc rather than over one end of it. No colour can score below
 * 4.58:1 against the better of pure white and pure black — that is the luminance where the
 * two are equal — so this choice cannot fall under the 4.5:1 AA minimum. The near-black
 * instead of `#000000` raises that floor to 4.76:1 and reads softer. The test file
 * recomputes the ratio from the colours this component actually renders.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface AvatarGradient {
  /** Background angle in degrees — a multiple of 45, so the avatars read as one set. */
  readonly angle: number;
  /** Hue of the 0% stop, in `[0, 360)`. */
  readonly fromHue: number;
  /** Hue of the 100% stop, 32–127° from `fromHue`. */
  readonly toHue: number;
  /** The 0% stop as `#rrggbb` — the colour the initials sit on. */
  readonly base: string;
  /** The 100% stop as `#rrggbb`. */
  readonly tip: string;
  /** The text colour computed for those two stops, as `#rrggbb`. */
  readonly ink: string;
  /** The `linear-gradient(…)` string the component puts in `backgroundImage`. */
  readonly css: string;
}

/** FNV-1a, 32-bit. Deterministic, dependency-free and unsigned. */
export function seedHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const clampChannel = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/** `hsl(hue 58% 42%)` as 0–255 channels. Plain HSL, not OKLCH: no dependency, no lib. */
const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = hue / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const offset = l - chroma / 2;
  return {
    r: (r + offset) * 255,
    g: (g + offset) * 255,
    b: (b + offset) * 255,
  };
};

/** WCAG 2.x linearisation, one channel on a 0–255 scale. */
const linearChannel = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance, `0` for black and `1` for white. */
export function relativeLuminance(colour: Rgb): number {
  return (
    0.2126 * linearChannel(colour.r) +
    0.7152 * linearChannel(colour.g) +
    0.0722 * linearChannel(colour.b)
  );
}

/** WCAG 2.x contrast ratio, `1` for identical colours, always `>= 1`. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const hexOf = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;

/** The two ink candidates — the only text colours the component will ever paint. */
const INK_ON_DARK: Rgb = { r: 255, g: 255, b: 255 };
const INK_ON_PALE: Rgb = { r: 11, g: 15, b: 23 };

/** Iterations of the lightness bisection: `2^-20` of the range, far finer than 0.1 light. */
const LIGHTNESS_STEPS = 20;

/**
 * The HSL lightness whose relative luminance is `targetLuminance`, for a fixed hue and
 * saturation. Monotonic (raising L raises every channel until L = 1), so a bisection is
 * exact and deterministic; the result is rounded to 0.1 % to keep the CSS short.
 */
function lightnessFor(hue: number, saturation: number, targetLuminance: number): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < LIGHTNESS_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (relativeLuminance(hslToRgb(hue, saturation, middle * 100)) < targetLuminance) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return Number((((low + high) / 2) * 100).toFixed(1));
}

const SATURATED_TARGETS = [0.055, 0.085, 0.115] as const;
const PALE_TARGETS = [0.46, 0.52, 0.58] as const;

/** The gradient one avatar is drawn with. Pure: same seed, same object, always. */
export function avatarGradient(seed: string): AvatarGradient {
  const hash = seedHash(seed);
  const fromHue = hash % 360;
  const toHue = (fromHue + 32 + ((hash >>> 9) % 96)) % 360;
  const angle = 45 * (1 + ((hash >>> 17) % 8));
  const saturation = 52 + ((hash >>> 11) % 17);
  const pale = (hash >>> 5) % 4 === 0;

  const target = (pale ? PALE_TARGETS : SATURATED_TARGETS)[(hash >>> 7) % 3];
  const tipTarget = Math.max(0, target + (pale ? 0.04 : -0.035));

  const base = hslToRgb(fromHue, saturation, lightnessFor(fromHue, saturation, target));
  const tip = hslToRgb(toHue, saturation, lightnessFor(toHue, saturation, tipTarget));

  const stops = [base, tip];
  const worstOn = (ink: Rgb) => Math.min(...stops.map((stop) => contrastRatio(stop, ink)));
  const ink = worstOn(INK_ON_DARK) >= worstOn(INK_ON_PALE) ? INK_ON_DARK : INK_ON_PALE;

  const baseHex = hexOf(base);
  const tipHex = hexOf(tip);

  return {
    angle,
    fromHue,
    toHue,
    base: baseHex,
    tip: tipHex,
    ink: hexOf(ink),
    css: `linear-gradient(${angle}deg, ${baseHex} 0%, ${tipHex} 100%)`,
  };
}

/**
 * `Ada` -> `A`, `Ada Lovelace` -> `AL`, `Ada Lovelace King` -> `AL`.
 *
 * The first letter of the first two words: a monogram is a shape, not an abbreviation, and
 * three letters in a 40 px disc stops reading as initials. A blank name cannot reach here
 * (the roster requires one), but `?` beats an empty disc if it ever does.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export interface GeneratedAvatarProps {
  /** Who the avatar is for: the accessible name, and the source of the initials. */
  readonly name: string;
  /** The stable identity the colours come from — a handle or a person id, not an index. */
  readonly seed: string;
  /** Diameter in CSS pixels. 40 is the leaderboard row's slot, so it is the default. */
  readonly size?: number;
  readonly className?: string;
}

/**
 * A person's avatar: their initials over a gradient seeded by their identity.
 *
 * A Server Component by construction — no directive, no hook, no `window`, no clock. It
 * renders from `name` and `seed` alone, which is also why the same props are byte-identical
 * on the server and in the browser.
 *
 * The disc is `role="img"` with the person's name as its accessible name, and the initials
 * inside are `aria-hidden`: otherwise a screen reader reads "A L" after the name it just
 * announced.
 */
export function GeneratedAvatar({ name, seed, size = 40, className }: GeneratedAvatarProps) {
  const gradient = avatarGradient(seed);

  return (
    <span
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none",
        className,
      )}
      role="img"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        backgroundImage: gradient.css,
        color: gradient.ink,
      }}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  );
}
