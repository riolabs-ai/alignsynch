import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * The brand's interactive fill (#187): a solid `action` ground with `action-foreground` on
 * top. It is one value under two names on purpose.
 *
 *   `default`  is the name every shadcn call site already passes (implicitly, or as
 *              `variant="default"`), and it used to be a palette step — the indigo 500 the
 *              template's buttons painted on every page of both builds. It now paints the
 *              same token as `action`, which is what "the palette has one home" means.
 *   `action`   is the explicit name a page uses when it means *the brand's call to action*
 *              rather than *the default button*; stages 2 and 3 of issue #187 moved the home,
 *              affiliate and profile surfaces onto it.
 *
 * A third variant, `gradient` (a purple→indigo 600 ramp with a matching hover ramp), drew
 * nothing: no file in `app/`, `components/` or `tests/` passes it. It was deleted with the
 * palette rather than re-pointed, because a gradient outside the token layer is the drift
 * `pnpm lint` now rejects (`scripts/lint-brand-classes.mjs`) — keeping a named utility that
 * only exists to paint one would leave the rule with a hole it cannot see.
 */
const actionFill = "bg-action text-action-foreground hover:bg-action/90";

const buttonVariants = cva(
  "inline-flex items-center duration-300 justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: actionFill,
        action: actionFill,
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input text-primary bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success: "bg-green-400 text-gray-800 hover:bg-green-400/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isActive?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isActive, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
