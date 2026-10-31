import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center text-white rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-indigo-500 hover:bg-indigo-600 text-white",
        secondary: "border-transparent bg-secondary hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive hover:bg-destructive/80",
        success: "border-transparent bg-green-400 hover:bg-green-400/80 text-gray-800",
        yellow: "border-transparent bg-yellow-500  hover:bg-yellow-500/80",
        blue: "border-transparent bg-blue-500  hover:bg-blue-500/80",
        purple: "border-transparent bg-purple-500 hover:bg-purple-500/80",
        warning: "border-transparent bg-orange-500 hover:bg-orange-500/80",
        outline: "text-foreground",
        /**
         * The brand's interactive colour and the theme's neutral chip (#187 stage 2). A badge
         * fill used to be a palette step — `default` is `indigo-500`, `purple` is
         * `purple-500` — so a rank or a quiz badge painted QuizHub's hues on an AlignSynch
         * page. These two read the tokens `lib/brand-theme.ts` paints, the way `button.tsx`'s
         * `action` variant does. Additive: no existing variant moved, so every surface that
         * has not converted yet renders the bytes it rendered before.
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
