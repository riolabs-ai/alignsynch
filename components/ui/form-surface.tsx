import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The form surface — one treatment for every screen that asks a reader to type something.
 *
 * **The decision, stated once (this component is where it lives): a form surface carries no
 * shadow.** Depth comes from the border and the background contrast (`border` + `bg-card` on
 * `bg-background`), not from a drop shadow. The shadow scale is reserved for elements that are
 * *raised over* the page — a popover, a dialog, a sticky bar — where the shadow says "this
 * floats"; a form is not floating over anything, it is a page body.
 *
 * Why it needed saying: the auth screens drew `shadow-xl border-0` and the dashboard and
 * marketing forms drew `shadow-sm` (the `Card` default) or nothing at all, so the same idea —
 * "this is the box you fill in" — had three looks, and the loudest one was on the screen a
 * visitor meets first. `Card` keeps its `shadow-sm` default (it is a raised container across
 * the whole product, and this card does not change `components/ui/**`'s defaults); a **form**
 * opts out by using this component instead.
 *
 * `scripts/brand-classes.mjs` holds the rule that keeps it true: a file that renders
 * `FormSurface` may not carry a `shadow-*` utility other than `shadow-none`, and an auth
 * screen may not draw a bare `Card` — `Card`'s own `shadow-sm` is the second look this
 * component exists to delete.
 *
 * It composes with the card parts (`CardHeader`, `CardContent`, …) exactly as `Card` does: it
 * is the same box, one step quieter, and it takes the same `className` for the things a
 * surface still decides (width, padding, spacing).
 */
const FormSurface = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground", className)}
      {...props}
    />
  ),
);
FormSurface.displayName = "FormSurface";

export { FormSurface };
