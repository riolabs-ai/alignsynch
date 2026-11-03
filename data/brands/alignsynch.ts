/**
 * The AlignSynch palette, sampled from the logo the brand actually ships.
 *
 * This record used to be a copy of the QuizHub one, and its comment said so: no theme had
 * been designed, so the skin borrowed the template's. The logo *is* the theme — an AS
 * monogram in blue and silver, three green arrows under the S, "Synch" in gray — so this
 * card stops describing the skin and reads its two accents out of the file.
 *
 * ## Where the values come from (owner palette, 2026-11-03)
 *
 * The palette *was* sampled from the lockup: `scripts/sample-brand-colors.mjs` decodes
 * `public/brand/as2-logo_v2_cl.png`, keeps the opaque saturated pixels, splits them into a blue
 * band (hue 180–260°) and a green one (60–170°), and takes the modal shade in each. That sample
 * still exists, is still measured, and `pnpm data:check` still fails when it drifts — but the
 * shipped colours are no longer it. At UI sizes the lockup's blue and green read dull, so the
 * owner picked a graphite and a cyan off a rendered sheet. The departure is recorded on the
 * record (`paletteDeparture`) rather than hidden in a comment, because a palette is a decision
 * that has to survive the next person "correcting" it back to the sample.
 *
 * ## The usage rules are measured, not assumed
 *
 * Every pair below was computed with the WCAG 2.1 relative-luminance formula over the sRGB
 * transfer function — not eyeballed — and the rule is what the number allows:
 *
 *   pair                        ratio     rule
 *   white on `#37474F`          9.65:1    primary buttons, any size
 *   white on `#2A373E`         12.25:1    action hover / pressed
 *   `#363d49` on `#08ADD5`      4.14:1    accent **fill** with ≥18 px or bold text only
 *   white on `#08ADD5`          2.64:1    **forbidden**
 *   `#08ADD5` on white          2.64:1    **forbidden** — no cyan links, no cyan body text
 *
 * So `accent` is a **surface** token on this brand — badges, chips, active states, chart series —
 * and never a text colour. A screen that wants an accent-coloured link uses `action` instead.
 * `scripts/lint-brand-classes.mjs` fails a `text-accent` utility, so the rule is enforced rather
 * than remembered (and `text-accent-foreground` is the ink *on* an accent fill, which is legal).
 *
 * The keys, then:
 *
 *   background   `#ffffff` — unchanged: the mark is black ink on white.
 *   foreground   `#363d49`, the marketing slate, 10.93:1 on white.
 *   primary      `#37474F`, the graphite — what headings and links paint.
 *   primaryForeground  white, 9.65:1 on the graphite.
 *   accent       `#08ADD5`, the cyan — a surface, never an ink (see the table).
 *   accentForeground   `#363d49`, 4.14:1 on the cyan: above the 3:1 large-text floor, below the
 *                4.5:1 body floor, which is exactly why the accent is limited to large or bold
 *                text. White there is 2.64:1 and forbidden.
 *   action       `#37474F`, the graphite again, under the role a *button* is painted with
 *                (#187). It equals `primary` on purpose: the CTA is the brand's ink, and a
 *                product whose CTA is a second colour is a product with two accents.
 *   actionHover  `#2A373E`, 12.25:1 — a pressed button is darker, not a fade (a brand that names
 *                none keeps the sheet's `hsl(var(--action) / 0.9)`, so QuizHub is untouched).
 *   actionForeground   white.
 *   navActive    the graphite, under the role the sidebar paints the active nav with.
 *   accentPress  `#0693B8`, the pressed shade of an accent surface — 3.58:1 on white, so a
 *                surface like its base, not an ink.
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
  /**
   * The tab icon (#187 stage 4): the brand's blue ground, not the template's indigo one.
   *
   * Drawn from the mark below, not from a glyph — see `mark`.
   */
  icon: "/brand/alignsynch-icon.svg",
  /**
   * The brand's own mark — the AS monogram, cropped from `logo` (x 0–170, the ink bbox
   * 0,1–165,101, stray baseline rule excluded) and squared with transparent padding.
   *
   * It is the source of every generated icon surface. Before this field the icon set was drawn
   * from a generic glyph, so the favicon, the PWA tile and the auth card all showed a white
   * person silhouette on the brand's blue — a mark belonging to no brand, on the one surface a
   * reader sees before any word. `scripts/gen-brand-icons.mjs` rasterises *this file* now, and
   * `data:check` E38 fails when the shipped icon stops looking like it.
   */
  mark: { src: "/brand/alignsynch-mark-1024.png" },
  colors: {
    background: "#ffffff",
    foreground: "#363d49",
    primary: "#37474f",
    primaryForeground: "#ffffff",
    accent: "#08add5",
    accentForeground: "#363d49",
    action: "#37474f",
    actionHover: "#2a373e",
    actionForeground: "#ffffff",
    navActive: "#37474f",
    accentPress: "#0693b8",
  },
  /**
   * The palette is no longer the logo's palette — the owner picked these values off a rendered
   * sheet. `sampled` is what `scripts/sample-brand-colors.mjs` still measures out of the lockup,
   * and the reason is the decision; the check compares the two and fails if this block agrees
   * with the sample (a departure that is not one) or if the sample disagrees with itself.
   *
   * The measured usage rules live in the header comment above, where the next person reading a
   * colour looks first.
   */
  paletteDeparture: {
    sampled: { primary: "#156898", accent: "#8dc63f" },
    reason:
      "Owner, 2026-11-03: the lockup's blue and green read dull at UI sizes. Graphite #37474F for action, cyan #08ADD5 as a surface accent.",
  },
  /**
   * **Internal addresses, never rendered** (owner, 2026-11-02). Both live on `alignsynch.com`,
   * whose MX is Microsoft 365 (`alignsynch-com.mail.protection.outlook.com`), so each alias
   * forwards; the private Gmail mailbox behind them is not written in this tree at all.
   * `supportEmail` is what the contact form mails (`app/api/contact/route.ts` reads it on the
   * server); `affiliateEmail` is the affiliate surface's. No public page prints either one — a
   * visitor writes through the form on `/help`.
   */
  supportEmail: "support@alignsynch.com",
  affiliateEmail: "hello@alignsynch.com",
  referralBase: "https://alignsynch.com",
});
