// template-ancestor: components/home/alignment-home.tsx   (variation: the AS2 page's shared furniture — an eyebrow, a two-column band head and the arrow glyph — factored out of eight bands)

import type { HomeHead } from "@/lib/home-alignsynch";
import { cn } from "@/lib/utils";
import type React from "react";

/**
 * The three pieces every AS2 band repeats: the arrow a CTA carries, the kicker above a heading,
 * and the band head itself.
 *
 * They are here rather than in each section file because the approved page draws them identically
 * eight times — the same 12px/700 graphite kicker, the same `clamp(32px, 3.5vw, 43px)` heading with
 * `-0.04em` tracking, the same two-column head with the intro set against the heading's baseline.
 * Eight copies would be eight places to get the letter-spacing wrong, and the first one that
 * drifted would be invisible in isolation and obvious on the page.
 *
 * Nothing here is a copy literal: every word arrives as a prop, which is what E23's budget of 0 on
 * `components/home/**` requires. `aria-hidden` on the arrow is the design's own decision — the
 * label beside it already says where the control goes.
 *
 * **The one hex below is the reference's, quoted rather than tokenised.** `homepage-redesign.css`
 * sets `--body: #59636e` on every paragraph it draws — the band intros, the step sentences, the
 * card decks, the benefit rows — and the brand record has no role for it (`muted-foreground` is the
 * template's `#596C88`, a bluer slate at the same lightness). It is written here once, as
 * `BODY_INK`, so the comparison against the stylesheet is one grep rather than fifteen.
 */

/** The reference's `--body` ink. 6.12:1 on white, so it clears the body floor on its own. */
export const BODY_INK = "text-[#59636e]";

/**
 * The arrow the page puts after every call to action.
 *
 * One glyph, `currentColor`, so it takes the fill of whatever it sits in — the graphite button, a
 * card's white footer, a text link — without a second styled copy. It is decorative: the label is
 * the accessible name of the control it sits in.
 *
 * **The glyph carries its own size, and that is not cosmetic.** An `<svg>` with a `viewBox` and no
 * `width`/`height` is sized by its container: inside `components/ui/button` the primitive supplies
 * `[&_svg]:size-4`, so the six arrows this page draws inside a button were already 16px — but the
 * three on raw anchors are not buttons, and there the glyph resolved to the whole flex line, square
 * by its 1:1 aspect ratio. Measured on `/` (alignsynch) before this class existed: **59.891 × 59.891
 * inside the hero's secondary "See how it works" anchor**, which made a 14px text link a
 * **123.906 × 60** box on every width from `sm` up — and **249.453 × 249.453 at 390**, where the
 * stacked column gave the glyph the full 342px width to resolve against, so the link rendered 249px
 * tall. The two hero cards drew 30 × 30 the same way. `size-4` is exactly what the `Button`
 * primitive already gives the arrows that sit inside it, so the glyph now looks the same whether or
 * not its container happens to size it.
 *
 * `size` exists because the reference does not use one arrow size: `.button svg` is 16px,
 * `.hero-secondary svg` is 15px and `.life-link svg` is 14px. Passing nothing keeps 16px.
 */
export function Arrow({ className }: { className?: string } = {}): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 20 20"
    >
      <path d="M4 10h12M10 4l6 6-6 6" />
    </svg>
  );
}

/**
 * The kicker above a heading.
 *
 * `text-primary` and not `text-accent`: on this brand the cyan accent is a *surface* — `text-accent`
 * is banned by `scripts/lint-brand-classes.mjs` because it measures 2.64:1 on white — and the
 * approved page's `#156898` is the ink it uses instead (5.7:1) where it needs a teal, which is the
 * `deep` role. The hero's kicker is graphite like the band ones, so `primary` is correct for both.
 *
 * The reference gives `.eyebrow` a 15px bottom margin and then overrides it to 12px inside
 * `.section-head`, which is the far more common case — so 12px is the default here and the hero is
 * the one caller that asks for 15.
 */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <p
      className={cn(
        "mb-3 inline-flex items-center gap-[9px] text-xs font-bold leading-[1.55] tracking-[0.02em] text-primary",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * A band's head: the kicker and heading on the left, the intro paragraph set against them on the
 * right, both bottom-aligned.
 *
 * The two columns collapse to one under `md` (768px), which is where the approved page's own
 * `max-width: 740px` block collapses them — the repo's `md` is 768, and a 28px difference at the
 * one width where the layout changes is not worth a bespoke breakpoint.
 *
 * The 38px bottom margin is the reference's `.section-head` value; it drops to 28px at 480, which
 * is the one place the sheet changes it.
 */
export function SectionHead({
  head,
  className,
}: {
  head: HomeHead;
  className?: string;
}): React.ReactElement {
  return (
    <header
      className={cn(
        "mb-[38px] grid grid-cols-1 items-end gap-x-[42px] gap-y-3 max-[480px]:mb-7 md:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)] md:gap-y-0",
        className,
      )}
    >
      {head.eyebrow === undefined ? null : (
        <Eyebrow className="mb-0 md:col-span-2 md:mb-3">{head.eyebrow}</Eyebrow>
      )}
      <h2 className="text-[clamp(32px,3.5vw,43px)] font-[740] leading-[1.08] tracking-[-0.04em] text-foreground">
        {head.heading}
      </h2>
      {head.body === undefined ? null : (
        <p className={cn("max-w-[500px] text-[15px] leading-[1.7]", BODY_INK)}>{head.body}</p>
      )}
    </header>
  );
}
