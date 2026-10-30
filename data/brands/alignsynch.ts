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
 * The other five keys are decisions, not samples:
 *
 *   background   the app's dark theme ground, `hsl(0 0% 3.9%)`. The logo is built to sit on
 *                black — the monogram's interior is black and its silver outline is what
 *                separates the mark from that ground — and the dark theme already exists, so
 *                this record does not add a light one.
 *   foreground   `#363d49`, the marketing site's slate — text, not brand. It is carried here
 *                because `zBrandColors` has the key, but it is deliberately *not* painted
 *                onto the dark ground: 1.8:1 against `hsl(0 0% 3.9%)` is unreadable, and
 *                "the slates are the foreground" is a statement about the brand's type, not
 *                a licence to override the theme's ink. `lib/brand-theme.ts` says the same
 *                thing in code.
 *   primaryForeground  white: 6.06:1 on the sampled blue.
 *   accentForeground   the ground itself: 9.69:1 on the sampled green, where white is 2.04:1.
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
    "See how you feel against how they feel, and how each of you wishes it to be — the Gap is the conversation worth having.",
  domain: "alignsynch.com",
  logo: "/brand/as2-logo_v2_cl.png",
  colors: {
    background: "hsl(0 0% 3.9%)",
    foreground: "#363d49",
    primary: "#156898",
    primaryForeground: "#ffffff",
    accent: "#8dc63f",
    accentForeground: "#0a0a0a",
    navActive: "#156898",
  },
  supportEmail: "alignsynch@riolabs.ai",
  affiliateEmail: "alignsynch@riolabs.ai",
  referralBase: "https://alignsynch.com",
});
