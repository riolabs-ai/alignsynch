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
 *   domain        the bare host (`quizhub.com`), no scheme and no trailing slash: a
 *                 canonical URL is composed from it, so it must never carry either
 *   logo          a path into `data/media.ts` (D-P2-1: a fixture holds the `src`, E19
 *                 holds that string to a registry entry) — never a new asset, because
 *                 the registry is generated from `public/` and a path it does not carry
 *                 is a 404
 *   colors        the theme tokens the app already paints with, named the way
 *                 `styles/globals.css` names them; a value here is the *resolved* colour
 *                 (`hsl(0 0% 9%)`), not a `var(--primary)` reference, because the point
 *                 of the record is to carry the value that reference resolves to
 *   supportEmail  the address the footer and the support pages print
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
 * `styles/globals.css` (`--primary` -> `primary`). `navActive` is the one colour that is
 * not a custom property: the sidebar paints the active nav with the Tailwind palette step
 * `indigo-500`, so the record carries that step's value under the role it plays.
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

export const zBrand = z
  .object({
    name: z.string().min(1),
    legalName: z.string().min(1),
    domain: zBrandDomain,
    logo: zBrandLogoPath,
    colors: zBrandColors,
    supportEmail: z.string().email(),
  })
  .strict();

export type Brand = z.infer<typeof zBrand>;
