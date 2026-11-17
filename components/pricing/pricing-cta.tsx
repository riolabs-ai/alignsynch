// template-ancestor: components/marketing/relationship-catalogue.tsx   (variation: the closing band — one heading, one sentence and one action on the action ground)

import Link from "next/link";

/**
 * `/pricing`'s closing band, in bundle 02's shape (#1127).
 *
 * The pre-v2 banner was a two-column card with a radial blur, a shadow, a benefits list and two
 * buttons: it read as a different product from the bands above it, and it offered a `/demo` door
 * the artifact does not draw. The artifact's closing band is flat — heading, one sentence, one
 * action on the action ground, the same band the catalogue closes with — so this is that.
 *
 * The words arrive from `lib/pricing-page.ts` (`pricingBands()`), never from this file: E23
 * attributes `components/pricing/**` to the page's fixture at a budget of 0.
 */
export function PricingCta({
  heading,
  body,
  label,
  href,
}: {
  heading: string;
  body: string;
  label: string;
  href: string;
}) {
  return (
    <section className="pb-12">
      <div className="mx-auto w-full max-w-content px-4 lg:px-6">
        <div className="flex flex-col items-start gap-4 rounded-lg bg-action p-6 text-action-foreground md:flex-row md:items-center md:justify-between lg:p-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{heading}</h2>
            <p className="mt-1 text-base text-action-foreground/85">{body}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/40 bg-background px-6 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
              href={href}
              data-pricing-cta
            >
              {label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
