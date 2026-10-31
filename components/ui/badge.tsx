import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center text-white rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-action hover:bg-action/90 text-action-foreground",
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
        action: "border-transparent bg-action text-action-foreground hover:bg-action/90",
        muted: "border-transparent bg-muted text-foreground hover:bg-muted/80",
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

export { Badge, badgeVariants };
