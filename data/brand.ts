/**
 * The brand the build ships with, resolved in this one module.
 *
 * `brand` is the record every page reads, and which record it is is a build flag:
 *
 *   BRAND=quizhub     (default) this file's own QuizHub record
 *   BRAND=alignsynch  `data/brands/alignsynch.ts`
 *
 * The flag is read *here and nowhere else*. No screen, layout or fixture checks
 * `process.env` or imports a brand module by name — they import `brand` and print its
 * fields, which is what makes "this demo is AlignSynch now" one build instead of a
 * find-and-replace across the tree. `BRAND=<anything else>` throws at build time rather
 * than rendering a half-swapped product.
 *
 * Why a flag and not a second app: the tree has one route table, one component per
 * feature and one fixture set, and a second app would be a copy of all three. Why the
 * value is inlined by the bundler rather than looked up at runtime: `brand` is imported by
 * client components too (the settings panes, the affiliate dashboard), so the flag has to
 * be a constant in the browser bundle as well — a `process.env` the bundler did not
 * replace would render one brand on the server and another at hydration, and the second
 * build would still say QuizHub in every interactive string. `next.config.mjs` declares
 * `BRAND` in `env` for exactly that reason.
 *
 * Every value in the QuizHub record is the one the app already rendered today, so the
 * record is a transcription and not a redesign:
 *
 *   - `logo` is `placeholder-logo` in `data/media.ts` (`/placeholder-logo.svg`, 215x48 —
 *     the lockup size the sidebar and the footer draw). It is a *path*, per D-P2-1, and
 *     E19's rule: a fixture holds the `src` the registry already carries.
 *   - `colors` are the `:root` values in `styles/globals.css`, resolved out of
 *     `hsl(var(--token))`, plus the `indigo-500` the sidebar paints the active nav with.
 *     The dark theme is not in this record: it is the same tokens under `.dark`, and a
 *     skin that wants to own dark mode is a schema change, not a second field here.
 *   - `supportEmail` is the address the shell prints: the header account block
 *     (`display-email`) and footer contact (`footer-contact/email`), the pricing FAQ's
 *     contact link and the support FAQ's "email us" line all read it, because a second
 *     address typed into a fixture is a second source of truth for the same fact.
 *   - `affiliateEmail` is the partner surface: the `/affiliate` closing CTA's address and
 *     the `mailto:` beside it. A second field and not `supportEmail`, because it is a
 *     second surface a skin may route elsewhere; on this template both are the brand's one
 *     mailbox at `@riolabs.ai`, and `domain` is not consulted to build either.
 *   - `referralBase` is the origin half of the dashboard's referral link; the `/ref/` path
 *     and the demo's `username123` stay in the component that composes them, because a
 *     handle is not brand data.
 */
import { zBrand, type Brand } from "../content/brand";
import { alignSynchBrand } from "./brands/alignsynch";

/** The record the demo ships with, and the one a default build renders. */
export const quizHubBrand: Brand = zBrand.parse({
  name: "QuizHub",
  legalName: "QuizHub",
  domain: "quizhub.com",
  logo: "/placeholder-logo.svg",
  colors: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(0 0% 3.9%)",
    primary: "hsl(0 0% 9%)",
    primaryForeground: "hsl(0 0% 98%)",
    accent: "hsl(0 0% 96.1%)",
    accentForeground: "hsl(0 0% 9%)",
    navActive: "#6366f1",
  },
  supportEmail: "quizhub@riolabs.ai",
  affiliateEmail: "quizhub@riolabs.ai",
  referralBase: "https://quizhub.com",
});

/** Every brand a build may select, keyed by the value `BRAND` takes. */
export const brands = {
  quizhub: quizHubBrand,
  alignsynch: alignSynchBrand,
} as const;

export type BrandId = keyof typeof brands;

/**
 * `BRAND` -> the record it names. A `switch` over the literal rather than an index lookup,
 * because it is the one place the flag becomes a value and it fails loudly on an unknown
 * id — a typo'd `BRAND` should not silently render the default brand.
 *
 * Note what this does *not* buy: measured on this tree, the bundler inlines the flag
 * (`resolveBrand("alignsynch")` in the client chunk — never a `process.env` lookup) but
 * does not fold the call, so both records' strings stay in the bundle either way. The
 * guarantee this card proves is about *rendered* output, not bundle size.
 */
export function resolveBrand(id: string | undefined): Brand {
  switch (id) {
    case undefined:
    case "":
    case "quizhub":
      return quizHubBrand;
    case "alignsynch":
      return alignSynchBrand;
    default:
      throw new Error(
        `BRAND=${id} is not a brand — expected one of: ${Object.keys(brands).join(", ")}`,
      );
  }
}

/** The record this build renders: the one import every page and fixture reads. */
export const brand: Brand = resolveBrand(process.env.BRAND);

/**
 * The id `resolveBrand` was called with — which key of `brands` this record is.
 *
 * `resolveBrand` turns an id into a record; a page that must choose a *composition* needs the
 * direction back, because the record carries no id of its own (`content/brand.ts` has no `id`
 * field, and adding one would be a schema change for a value the table already holds as its
 * key). Identity is the join: the two records are distinct objects, so `brands[key] === record`
 * is true for exactly one key.
 *
 * This is what keeps a brand's *name* out of a `.tsx`: `app/(mainlayout)/page.tsx` switches over
 * `BrandId` — `"quizhub"`, `"alignsynch"` — and never compares `brand.name` to `"AlignSynch"`,
 * so renaming a product is a fixture edit and a new brand is a compile error until its front
 * page is chosen deliberately.
 */
export function brandIdOf(record: Brand): BrandId {
  const id = (Object.keys(brands) as BrandId[]).find((key) => brands[key] === record);
  if (id === undefined) {
    throw new Error(
      "this Brand record is not in data/brand.ts's `brands` table, so it has no BRAND id — a record added without a key cannot choose a composition",
    );
  }
  return id;
}
