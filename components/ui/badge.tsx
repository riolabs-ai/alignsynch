import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center text-white rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-action hover:bg-action-hover text-action-foreground",
        secondary: "border-transparent bg-secondary hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive hover:bg-destructive/80",
        success: "border-transparent bg-green-400 hover:bg-green-400/80 text-gray-800",
        yellow: "border-transparent bg-yellow-500  hover:bg-yellow-500/80",
        blue: "border-transparent bg-blue-500  hover:bg-blue-500/80",
        brand: "border-transparent bg-action hover:bg-action/80",
        warning: "border-transparent bg-orange-500 hover:bg-orange-500/80",
        outline: "text-foreground",
        /**
         * The brand's interactive colour and the theme's neutral chip (#187). The two fills
         * this used to carry were palette steps — a purple 500 and the template's indigo 500 —
         * so a rank or a quiz badge painted QuizHub's hues on an AlignSynch page. Every fill
         * here that names the brand now reads the tokens `lib/brand-theme.ts` paints, the way
         * `button.tsx`'s `action` variant does.
         *
         * `brand` is the renamed variant: it was called after the step it painted (and the
         * `Platinum` tier and the explore shelves select it by that name), and a variant whose
         * name is a colour it no longer paints is the drift this issue exists to delete. `blue`,
         * `yellow`, `success` and `warning` stay palette steps on purpose: they are *status*
         * colours, not the brand's — a "trending" chip and a "warning" chip mean the same thing
         * under both brands, and re-pointing them at `action` would erase the distinction rather
         * than move the palette's home.
         */
        action: "border-transparent bg-action text-action-foreground hover:bg-action-hover",
        muted: "border-transparent bg-muted text-foreground hover:bg-muted/80",
        /**
         * The four record tones (#795, card t_252f94e3). A chip says one thing about a record —
         * who it is, what it is made of, what state it is in — and until this primitive existed
         * that one concept was drawn by three constants at three radii
         * (`components/assessment-flow/template-card.tsx`'s `rounded-md` CHIP, the shelf's
         * `rounded-full` CHIP/CHIP_TEMPLATE, and this file's `Badge`).
         *
         * The geometry is the primitive's now and it is `rounded-full`, the radius three of the
         * four already carried. **The tone is the variant; the radius is never a variant.** The
         * four are the approved artifact's (`docs/reference/mockups/one-card-one-detail-v2.html` §1), and
         * they are a closed set: `Chip` accepts these four and nothing else, so the filled
         * `Badge` variants below cannot be handed to a label by accident.
         *
         *   neutral  a fact — the shelf's chip, unchanged
         *   tint     the template mark and the stage, so a card is never read as the wrong noun
         *   soft     a state, on the `secondary` fill the design system already has
         *   onBand   any chip on the dark identity band, where the neutral pair would vanish
         *
         * None of them hovers: a chip is a label, not a control. A tone that repaints light type
         * over a coloured fill has to carry its own `text-*`, because the base string's
         * `text-white` is what the *filled* variants depend on and `cn`'s merge order is what
         * lets these four drop it.
         */
        neutral:
          "border-gray-300 bg-white font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200",
        tint: "border-action/45 bg-action/5 font-medium text-action",
        soft: "border-transparent bg-secondary font-semibold text-card-foreground",
        onBand: "border-background/30 px-2 font-normal text-background/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * The tags a chip may be drawn as, as a value a component can ask for.
 *
 * `span` almost everywhere, because a chip sits inside a sentence, a `<p>` or a flex row. The
 * console library card is the one surface that needs another: its chips are `<dd>` rows in a
 * `<dl>`, and a `<span>` there would leave a list whose children are not terms or definitions.
 * Two tags, not a free string: a third would be a markup decision somebody has to justify here.
 *
 * Exported as a constant rather than left to the caller to type: a tag is markup, and E23 counts
 * a string attribute value in a route's import closure as copy, so `as="dd"` would spend a leaf
 * literal of that route's budget on a word no reader ever sees.
 */
export const CHIP_TAG = { span: "span", dd: "dd" } as const;

export type ChipTag = (typeof CHIP_TAG)[keyof typeof CHIP_TAG];

/** The four tones, as a closed set — `Chip` takes these and never a filled `Badge` variant. */
const CHIP_TONES = ["neutral", "tint", "soft", "onBand"] as const;

export type ChipTone = (typeof CHIP_TONES)[number];

export interface ChipProps extends React.HTMLAttributes<HTMLElement> {
  /** The tone. Defaults to `neutral` — a fact, which is what most labels are. */
  variant?: ChipTone;
  /** The element to draw. Defaults to `span`; see {@link CHIP_TAG}. */
  as?: ChipTag;
}

/**
 * A small label about a record — the one primitive (#795).
 *
 * One geometry (`rounded-full`, the base string), one padding, one type step, and a tone chosen
 * by `variant`: `neutral` for a fact, `tint` for the template mark and the stage, `soft` for a
 * state, `onBand` for anything on the dark identity band. It is the same `badgeVariants` the
 * filled `Badge` uses, so the two can never drift into two scales — `Chip` adds only the tone
 * set and the element choice a label needs, which is also why `<Chip variant="secondary">` does
 * not compile: that fill carries the base string's `text-white` and is for a filled badge.
 *
 * `cn` runs the merged class list through `tailwind-merge`, not the class attribute through the
 * cascade: the base string's `text-white` / `font-semibold` / `px-2.5` are dropped by the later
 * tone classes here, and a caller's `className` overrides theirs in turn.
 */
function Chip({ className, variant = "neutral", as = "span", ...props }: ChipProps) {
  const Tag = as as "span";
  return <Tag className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, Chip, badgeVariants };
