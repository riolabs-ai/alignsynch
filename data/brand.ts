/**
 * The brand the demo ships with: QuizHub.
 *
 * One record, parsed by `content/brand.ts`, read by everything that prints the product's
 * name: the shell projection (`brand.name` in the brand word and the copyright line, and
 * `brand.supportEmail` in both addresses), the page-copy fixtures, the knowledge-base and
 * news fixtures, the two FAQ projections and the components that print a sentence naming
 * it. This file is the only place the name lives — `rg -l QuizHub app components data`
 * returns this file and nothing else — so a skin is a second `Brand`, not a
 * find-and-replace across the tree.
 *
 * Every value here is the one the app already renders today, so the record is a
 * transcription and not a redesign:
 *
 *   - `logo` is `placeholder-logo` in `data/media.ts` (`/placeholder-logo.svg`, 215x48 —
 *     the lockup size the sidebar and the footer draw). It is a *path*, per D-P2-1, and
 *     E19's rule: a fixture holds the `src` the registry already carries.
 *   - `colors` are the `:root` values in `styles/globals.css`, resolved out of
 *     `hsl(var(--token))`, plus the `indigo-500` the sidebar paints the active nav with.
 *     The dark theme is not in this record: it is the same tokens under `.dark`, and a
 *     skin that wants to own dark mode is a schema change, not a second field here.
 *   - `supportEmail` is the one address the demo prints: the shell's header account block
 *     (`display-email`) and footer contact (`footer-contact/email`), the pricing FAQ's
 *     contact link and the support FAQ's "email us" line all read it, because a second
 *     address typed into a fixture is a second source of truth for the same fact.
 */
import { zBrand, type Brand } from "../content/brand";

export const brand: Brand = zBrand.parse({
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
  supportEmail: "support@quizhub.com",
});
