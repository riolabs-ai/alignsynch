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
 */

/**
 * The arrow the page puts after every call to action.
 *
 * One glyph, `currentColor`, so it takes the fill of whatever it sits in — the graphite button, a
 * card's white footer, a text link — without a second styled copy. It is decorative: the label is
 * the accessible name of the control it sits in.
 */
export function Arrow(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
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
 * `text-deep` and not `text-accent`: on this brand the cyan accent is a *surface* — `text-accent` is
 * banned by `scripts/lint-brand-classes.mjs` because it measures 2.64:1 on white — and the approved
 * page's `#156898` is the ink it uses instead (5.7:1). The token exists for exactly this role.
 */
export function Eyebrow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <p className="mb-3 text-xs font-bold tracking-[0.02em] text-primary">{children}</p>;
}

/**
 * A band's head: the kicker and heading on the left, the intro paragraph set against them on the
 * right, both bottom-aligned.
 *
 * The two columns collapse to one under `md` (768px), which is where the approved page's own
 * `max-width: 740px` block collapses them — the repo's `md` is 768, and a 28px difference at the
 * one width where the layout changes is not worth a bespoke breakpoint.
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
        "mb-9 grid grid-cols-1 items-end gap-x-[42px] gap-y-3 md:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)]",
        className,
      )}
    >
      {head.eyebrow === undefined ? null : (
        <div className="md:col-span-2">
          <Eyebrow>{head.eyebrow}</Eyebrow>
        </div>
      )}
      <h2 className="text-[clamp(32px,3.5vw,43px)] font-bold leading-[1.08] tracking-[-0.04em] text-primary">
        {head.heading}
      </h2>
      {head.body === undefined ? null : (
        <p className="max-w-[500px] text-[15px] leading-[1.7] text-muted-foreground">{head.body}</p>
      )}
    </header>
  );
}
