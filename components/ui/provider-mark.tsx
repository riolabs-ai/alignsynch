// template-ancestor: components/auth/mark-icon.tsx   (variation: a provider's own mark, drawn from the paths that mark is defined by — where MarkGlyph draws *this* product's)
/**
 * The mark a sign-in control draws beside its own label.
 *
 * `components/auth/mark-icon.tsx` answers "which glyph is this brand's mark" — the product's own
 * vocabulary, chosen per brand on the server. This module answers a different question: a control
 * that hands the person to a *third party* (`Continue with Google`) is recognised by that party's
 * mark, which is fixed by the party and not a brand decision, so it is neither in `MARK_ICONS` nor
 * selectable per brand. Every build draws the same one.
 *
 * **Where the paths come from (no new dependency, no invented SVG).** The four `d` attributes are
 * the Google "G" as it is defined — the same path data `components/settings/connected-accounts.tsx`
 * already carries inline for the same logo, lifted verbatim rather than redrawn. What this module
 * adds is the treatment that file does not use: each path filled with the colour it is drawn with
 * in the mark (`#4285F4` blue, `#34A853` green, `#FBBC05` yellow, `#EA4335` red), because a
 * monochrome outline of the G is not the mark a person recognises by shape — and recognising it by
 * shape is the whole point (issue #777). Those hexes are the third party's, not this product's
 * palette: they are not tokenised, deliberately, since a brand token would repaint somebody else's
 * logo. The settings screen keeps its own white-on-blue treatment; it is a different surface with a
 * different decision and is not changed by this module.
 *
 * **It is decoration, and it says so.** `aria-hidden="true"` and no `<title>`: the control's
 * accessible name is its own label (`Continue with Google`, from the fixture), and a mark that
 * announced itself would make a screen reader read the button twice. A logo alone is not an
 * accessible name, which is why this component never replaces the text.
 */
import type { SVGProps } from "react";

/** The Google "G", filled with the mark's own four colours. Sized and spaced by the caller. */
export function GoogleMark({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
