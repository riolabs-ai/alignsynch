/**
 * `Brand` — who the product claims to be. One record, read by everything that prints the
 * product's name, its domain or its support address.
 *
 * The failure this exists to prevent is the one the tree used to demonstrate: 94
 * `QuizHub` literals across `app/`, `components/` and `data/`, where "the brand is X" was
 * a find-and-replace across the tree instead of a field. Every one of them now reads this
 * record (`rg -l QuizHub app components data` returns `data/brand.ts` alone), so a skin is
 * a second `Brand` the app reads, not a second copy of the app.
 *
 * Why each field is a field:
 *
 *   name          the word the chrome prints — sidebar logo, footer logo, copyright
 *   legalName     the entity behind the product; not what the UI says, what the footer
 *                 says when a contract or a licence needs the company, not the badge
 *   description   the one sentence the document head prints as `<meta name="description">`
 *                 on every route that sets no description of its own. Brand data, not route
 *                 copy: the root layout owns the tag, and a second brand is a second
 *                 sentence, never a second edit to a `.tsx`
 *   domain        the bare host (`quizhub.com`), no scheme and no trailing slash: a
 *                 canonical URL is composed from it, so it must never carry either
 *   logo          a path into `data/media.ts` (D-P2-1: a fixture holds the `src`, E19
 *                 holds that string to a registry entry) — never a new asset, because
 *                 the registry is generated from `public/` and a path it does not carry
 *                 is a 404
 *   colors        the theme tokens the app already paints with, named the way
 *                 `app/globals.css` names them; a value here is the *resolved* colour
 *                 (`hsl(0 0% 9%)`), not a `var(--primary)` reference, because the point
 *                 of the record is to carry the value that reference resolves to
 *   supportEmail  the address the footer and the support pages print
 *   affiliateEmail the address the affiliate program prints. A second field rather than a
 *                 second use of `supportEmail`, because it is a second *surface* that
 *                 answers a partner — even when a brand routes both to one mailbox, that
 *                 is a routing decision made in the record, not a fact the schema assumes
 *   referralBase  the origin a referral link is composed from (`https://host`), never a
 *                 whole link: the path and the handle belong to the caller, so the record
 *                 carries the half a skin owns and the demo's `username123` stays a
 *                 literal in the component that prints it
 *
 * An address is **not** derived from `domain`, and the records make that visible: the site
 * domain is what a page claims to be, the mailbox is where a human answers, and the
 * templates answer at `@riolabs.ai` while the site claims `quizhub.com` or
 * `alignsynch.com`. Composing an address out of `domain` would invent a mailbox nobody
 * reads — the failure it replaced was two addresses typed into a component.
 *
 * `logo` and `colors` are the only fields with a shape beyond "a non-empty string", and
 * both are validated here rather than at the render site: a skin that supplies
 * `logo: "logo.svg"` (no leading slash) or `primary: "indigo"` fails `data:check` with
 * the field's name instead of rendering a broken image or a transparent button.
 *
 * Never import React or Next here: `data:check` compiles `content/` with
 * `tsconfig.datacheck.json` and runs it under plain node, exactly as `content/pages.ts`
 * does. The value lives in `data/brand.ts`.
 */
import { z } from "zod";

/**
 * A colour as CSS accepts one. HSL is what the theme already speaks
 * (`hsl(var(--primary))` -> `hsl(0 0% 9%)`) and is the form the record carries; hex is
 * accepted too because a Tailwind palette step (`indigo-500`) is authored as one.
 * A bare word is rejected: `"indigo"` is a class, not a colour, and a skin that supplies
 * one is a skin whose buttons render transparent.
 */
export const zBrandColor = z
  .string()
  .regex(
    /^(?:hsla?\(\s*[\d.]+(?:deg)?[\s,]+[\d.]+%[\s,]+[\d.]+%(?:\s*[/,]\s*[\d.]+%?)?\s*\)|#[0-9a-fA-F]{3,8})$/,
    "must be a CSS colour: hsl(H S% L%) or #rrggbb — a token name is not a colour",
  );

export type BrandColor = z.infer<typeof zBrandColor>;

/**
 * The theme tokens the app paints the shell with, named after the custom properties in
 * `app/globals.css` (`--primary` -> `primary`). `navActive` is the one colour that is
 * not a custom property: the sidebar paints the active nav with the Tailwind palette step
 * `indigo-500`, so the record carries that step's value under the role it plays.
 *
 * `action` is the second (issue #187): the brand's *interactive* colour — a solid fill with
 * `actionForeground` on top, for a call to action, a link hover, an icon inside a chip. The
 * theme sheet cannot supply it: `--primary` is the template's ink (`hsl(0 0% 9%)` in
 * `data/brand.ts`) and `--accent` is shadcn's subtle hover *surface*, which is why every
 * CTA in the tree used to be typed as a purple 600 fill and leaked QuizHub's palette into an
 * AlignSynch page. A role that has no token gets a token here; it does not get a literal in
 * a component, and this pair is the measurement of what that cost: on `f6cad944`, the chrome,
 * the assessment flow and the 404 carried 31 lines and 49 indigo, purple and violet literals
 * across 8 files, of which 15 were gradient stops in 10 `bg-gradient-to-*`.
 *
 * Strict: a skin that invents a token gets a hard error, not a field nothing reads.
 */
export const zBrandColors = z
  .object({
    background: zBrandColor,
    foreground: zBrandColor,
    primary: zBrandColor,
    primaryForeground: zBrandColor,
    accent: zBrandColor,
    accentForeground: zBrandColor,
    action: zBrandColor,
    actionForeground: zBrandColor,
    navActive: zBrandColor,
  })
  .strict();

export type BrandColors = z.infer<typeof zBrandColors>;

/** A `public/`-rooted image path — the same rule `content/media.ts` puts on `src` (E19). */
export const zBrandLogoPath = z
  .string()
  .regex(/^\/[^?#\s]*\.(?:png|jpe?g|webp|svg|gif|avif|ico)$/i, {
    message: "must be a public-rooted image path with no query string",
  });

/** A bare host: `quizhub.com`, never `https://quizhub.com/`. */
export const zBrandDomain = z
  .string()
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    "must be a bare lowercase host — no scheme, no path, no trailing dot",
  );

/**
 * The origin a referral link is built on: `https://quizhub.com`, never a whole link.
 *
 * The two halves have different owners. The host is brand — an AlignSynch link points at
 * `alignsynch.com` — while the path (`/ref/`) and the handle belong to the product, and
 * the handle in this demo (`username123`) is a literal in the component that prints it. A
 * record that carried the whole link would have to know a username it has no business
 * knowing, and a second brand would carry a second copy of a demo value.
 *
 * Rejected, loudly, because each one composes into a broken link: a path (`/ref` appended
 * to it yields `https://host/ref/ref/…`), a trailing slash (`…/` + `/ref/x` -> `//ref/x`),
 * a username (`https://me@host`), a query or a fragment, and a bare `quizhub.com` with no
 * scheme (the scheme is required for exactly that reason).
 */
export const zBrandReferralBase = z
  .string()
  .regex(
    /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?$/,
    "must be an origin — scheme and host only: no path, no username, no trailing slash",
  );

export const zBrand = z
  .object({
    name: z.string().min(1),
    legalName: z.string().min(1),
    description: z.string().min(1),
    domain: zBrandDomain,
    logo: zBrandLogoPath,
    /**
     * The tab icon — `public/brand/<id>-icon.svg` (#187 stage 4), a `public/`-rooted path for
     * the same reason `logo` is (D-P2-1: a fixture holds the `src` the registry already
     * carries, and E19 holds that string to a registry entry).
     *
     * Before this field, `app/favicon.ico` was one static file, so the browser tab, a bookmark
     * and the history list all showed QuizHub's mark on the AlignSynch build. An icon is the
     * one surface a reader sees before any word of the page, which makes it brand data rather
     * than a build artefact: `app/layout.tsx` passes this path to `metadata.icons`, and no
     * component names one.
     *
     * The file is drawn from the record by `scripts/gen-brand-icons.mjs` — the ground is
     * `colors.action` and the mark is the open book (`lib/brand-icon.ts`) stroked in
     * `colors.actionForeground` — so the hex is not authored twice, and `pnpm data:check`
     * re-draws it with `--check`. The same generator emits the apple-touch and PWA maskable
     * set; those paths are derived from the brand id in `lib/brand-icon.ts`, not carried here,
     * because they are the one mark at four sizes, not four separate facts.
     */
    icon: zBrandLogoPath,
    colors: zBrandColors,
    supportEmail: z.string().email(),
    affiliateEmail: z.string().email(),
    referralBase: zBrandReferralBase,
  })
  .strict();

export type Brand = z.infer<typeof zBrand>;
