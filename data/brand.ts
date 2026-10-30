/**
 * The brand the demo ships with: QuizHub.
 *
 * One record, parsed by `content/brand.ts`, read by the fixtures that print the product's
 * name — today that is `data/pages/shell.ts` alone (`brand.name` in the brand word and the
 * copyright line). The rest of the 94 `QuizHub` literals still in `app/` and
 * `components/` are the next card's find-and-replace, not this one's: this card adds the
 * record the reskin will read, and changes no screen.
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
 *   - `supportEmail` is the address the shell's footer contact prints
 *     (`support@quizhub.com`). The account block's `info@quizhub.com` is a demo identity,
 *     not the brand's support address.
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
