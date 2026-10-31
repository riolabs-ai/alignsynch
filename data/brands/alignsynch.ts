/**
 * The AlignSynch palette, sampled from the logo the brand actually ships.
 *
 * This record used to be a copy of the QuizHub one, and its comment said so: no theme had
 * been designed, so the skin borrowed the template's. The logo *is* the theme — an AS
 * monogram in blue and silver, three green arrows under the S, "Synch" in gray — so this
 * card stops describing the skin and reads its two accents out of the file.
 *
 * Where the values come from, and why they are not typed here:
 *
 *   primary  `#156898` — the modal shade of blue in the monogram
 *   accent   `#8dc63f` — the modal shade of the three arrows under the S
 *
 * `scripts/sample-brand-colors.mjs` decodes `public/brand/as2-logo_v2_cl.png`, keeps the
 * opaque saturated pixels, splits them into a blue band (hue 180–260°) and a green one
 * (60–170°), and takes the heaviest shade in each band. `pnpm data:check` runs it with
 * `--check`, so the two hexes above are a copy of a measurement: re-export the logo and the
 * gate fails until they are re-sampled, and a hex typed from memory fails immediately. The
 * script prints the pixel counts and bounding boxes behind each value, so "the blue in the
 * monogram" and "the green in the arrows" are checkable claims rather than adjectives.
 *
 * The other seven keys are decisions, not samples (issue #157, #187):
 *
 *   background   `#ffffff`. The mark is black ink on white — 53.7% of its 28,112 opaque
 *                pixels are pure `#000000` and 11.6% are `#3b3b3c` — so the near-black ground
 *                it used to name hid two thirds of it. White is the ground the logo was
 *                drawn for, and `lib/brand-theme.ts` paints it onto `<html>`.
 *   foreground   `#363d49`, the marketing site's slate. It used to be carried and deliberately
 *                not painted; it travels with the ground now, because 10.9:1 on white is
 *                readable where 1.8:1 on the old near-black ground was not.
 *   primaryForeground  white: 6.06:1 on the sampled blue.
 *   accentForeground   `#1c1c1c`: 8.34:1 on the sampled green, where white is 2.04:1. It was
 *                `#0a0a0a` while the ground was near-black; on white it is an ink, not the
 *                ground, and it stays a decision about the green rather than a copy of a token.
 *   action       the blue again, under the role a *button* is painted with (#187). It equals
 *                `primary` on this brand and that is not a coincidence to be tidied away: the
 *                mark is one blue, and a product whose CTA is a second blue is a product with
 *                two accents. Kept as its own key because the role is its own — a skin may
 *                darken a CTA without moving the ink its headings use.
 *   actionForeground   white: the same 6.06:1 as `primaryForeground`, and white is the only
 *                readable ink on the sampled blue.
 *   navActive    the blue, under the role the sidebar paints the active nav with.
 *
 * `logo` stays a media path (D-P2-1): the file is registered in `data/media.ts` as
 * `brand.as2-logo_v2_cl` (E18 keeps the registry a bijection with `public/`), and the string
 * here equals that entry's `src` — never a hotlink, never a URL.
 *
 * The lockup is a *light-ground* asset even where the card calls it a dark-ground one: its
 * wordmark is black "Align" beside gray "Synch", so on near-black chrome the black half
 * disappears and only "Synch" ghosts through. That is why the shell draws the monogram (the
 * left fifth of the file, cropped in CSS) and sets the full name in type beside it —
 * `lib/brand-mark.ts` and `components/layout/sidebar.tsx`. The committed PNG is the upstream
 * export, unmodified.
 *
 * Imported by `data/brand.ts` (the resolver) and by nothing else. A screen never names a
 * brand module: it reads `brand`, which is the one the build selected.
 */
import { zBrand, type Brand } from "../../content/brand";

export const alignSynchBrand: Brand = zBrand.parse({
  name: "AlignSynch",
  legalName: "AlignSynch",
  description:
    "AlignSynch asks two people the same five questions about their relationship, once for how it is now and once for how each of them wishes it to be, and shows where the answers differ.",
  domain: "alignsynch.com",
  logo: "/brand/as2-logo_v2_cl.png",
  /** The tab icon (#187 stage 4): the brand's blue ground, not the template's indigo one. */
  icon: "/brand/alignsynch-icon.svg",
  colors: {
    background: "#ffffff",
    foreground: "#363d49",
    primary: "#156898",
    primaryForeground: "#ffffff",
    accent: "#8dc63f",
    accentForeground: "#1c1c1c",
    action: "#156898",
    actionForeground: "#ffffff",
    navActive: "#156898",
  },
  supportEmail: "alignsynch@riolabs.ai",
  affiliateEmail: "alignsynch@riolabs.ai",
  referralBase: "https://alignsynch.com",
});
