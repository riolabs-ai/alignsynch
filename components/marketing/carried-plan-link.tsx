"use client";

// template-ancestor: components/ui/button.tsx   (variation: an anchor that keeps a query the page it sits on cannot read — the catalogue's carried plan, appended in the browser so the template page stays prerendered)

import { isBillingInterval, isPaidPlanTier } from "@/lib/flow/plan-intent";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A link that keeps the plan a reader carried from `/pricing` (#1127).
 *
 * **Why this is a client component rather than a `searchParams` prop.** The template page is
 * prerendered — twenty-seven slugs, built ahead of the request so a stranger can read one without
 * the app doing any work — and a page that reads `searchParams` on the server loses that render.
 * The only thing the query changes here is one anchor's `href`, so the query is read in the browser,
 * where it already is, and the page stays static.
 *
 * **Nothing is trusted from the address.** `plan` and `interval` are validated against the billing
 * fixture's own vocabularies before they are appended, so `?plan=free` or a crafted pair produces
 * the plain link rather than a carriable intent. The pair is passed on exactly as the catalogue
 * passed it; this component adds to the address and never rewrites what the flow reads.
 */
export function CarriedPlanLink({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const params = useSearchParams();
  const plan = params.get("plan") ?? "";
  const interval = params.get("interval") ?? "";
  const carry =
    isPaidPlanTier(plan) && isBillingInterval(interval)
      ? `?${new URLSearchParams({ from: "pricing", plan, interval }).toString()}`
      : "";

  return (
    <Link href={`${href}${carry}`} className={className} {...rest}>
      {children}
    </Link>
  );
}
