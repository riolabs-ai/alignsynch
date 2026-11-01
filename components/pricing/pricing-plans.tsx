"use client";

// template-ancestor: components/ui/card.tsx   (variation: the plan grid — one card per plan, an interval switch, a feature list and a checkout button)

import { PlanCheckoutButton } from "@/components/pricing/plan-checkout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyAmount, formatPercentValue } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import type { BillingInterval } from "@/data/billing-plans";
import { metric } from "@/data/metrics";
import type { PricingPlanView } from "@/lib/billing/catalogue";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Check, HelpCircle } from "lucide-react";
import Link from "next/link";
import { type JSX, memo, useCallback, useState } from "react";

/**
 * The plan grid — four cards, rendered from `billing_plan` (#289, card 3 of 3).
 *
 * **This component owns no price, no bullet and no label for a tier.** Every card is a
 * `PricingPlanView` the server built from `data/billing-plans.ts` (the words) and `billing_plan`
 * (the money, and whether the row is live), which is what replaced the `PLANS_DATA` copy that
 * used to live here. `formatCurrencyAmount` is the only thing that turns cents into a figure, and
 * `tests/billing-plans.test.ts` fails the build if a price literal reappears under
 * `components/pricing/`. What a row may *say* is still decided by what the tree does, not by what
 * a pricing table usually promises (Jaden, 2026-10-31) — the bullets themselves are authored in
 * the fixture, with the reasoning for each removal recorded there.
 *
 * **Sellability is per interval.** `billing_plan` keys on (tier, interval), so `basic/month` can
 * be live while `basic/year` is retired: the card's button follows the toggle, and the interval
 * whose row is inactive (or missing) prints the not-available line instead. That is the card's
 * honesty rule — a button that cannot work must not render as if it does — enforced by data, not
 * by a flag in this file.
 *
 * **The account's own plan says so.** `current` comes from the server's entitlement read, never
 * from a query string: after a successful checkout the page reloads, reads the subscription, and
 * the card that was bought loses its button and gains the current-plan marker. Nothing in the
 * browser decides which plan someone is on.
 *
 * **Test mode is labelled.** When the deployment sells through the hosted adapter's test mode the
 * band says so on one line — the release candidate runs test keys in production, and a page that
 * reads as "you are being billed" without saying this would be the one false claim left.
 *
 * The support address is built from `brand.supportEmail` at render time, so neither build pins
 * the other brand's mailbox; the fixture stores the word `"support"` rather than an address.
 */
const SUPPORT_MAILTO = `mailto:${brand.supportEmail}`;

/** The copy id for the "/mo" and "/mo, billed yearly" suffixes, per interval. */
const PRICE_SUFFIX_ITEM: Readonly<Record<BillingInterval, string>> = {
  month: "price-per-month",
  year: "price-per-month-yearly",
};

interface FeatureListProps {
  features: readonly string[];
}

interface LimitationsListProps {
  limitations: readonly string[];
  copy: PageCopySection;
}

/** The features a card lists, one bullet each. */
const FeatureList = memo<FeatureListProps>(({ features }) => {
  return (
    <ul className="space-y-3">
      {features.map((feature: string) => (
        <li key={feature} className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{feature}</span>
        </li>
      ))}
    </ul>
  );
});

FeatureList.displayName = "FeatureList";

/** The limitations a card lists, when it has any. */
const LimitationsList = memo<LimitationsListProps>(({ limitations, copy }) => {
  if (limitations.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
        {itemLabel(copy, "limitations")}
      </h4>
      <ul className="space-y-3">
        {limitations.map((limitation: string) => (
          <li key={limitation} className="flex items-start">
            <span className="h-5 w-5 text-slate-400 mr-2 flex-shrink-0 mt-0.5">•</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">{limitation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

LimitationsList.displayName = "LimitationsList";

/**
 * The card's footer: one of four things, in this order.
 *
 *   current      the account is on this tier — a marker, and nothing to buy
 *   checkout     a live row at this interval — the button that posts to `/api/billing/checkout`
 *   unavailable  a checkout tier with no live row — a line, not a disabled button (a disabled
 *                button still reads as a control that would work under other circumstances)
 *   link         `/register` or the support mailbox — an ordinary destination
 */
const PlanFooter = memo<{ plan: PricingPlanView; cycle: BillingInterval; copy: PageCopySection }>(
  ({ plan, cycle, copy }) => {
    const buttonClassName = `w-full ${plan.popular ? "bg-action hover:bg-action/90 text-white border-0" : ""}`;
    const variant = plan.popular ? "default" : "outline";

    if (plan.current) {
      return (
        <Badge variant="secondary" className="w-full justify-center py-2">
          {itemLabel(copy, "current-plan")}
        </Badge>
      );
    }

    if (plan.cta.href === "checkout") {
      const interval = plan.intervals[cycle];
      if (interval === null || !interval.sellable) {
        return (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {itemLabel(copy, "not-available")}
          </p>
        );
      }
      return (
        <PlanCheckoutButton
          planId={plan.id}
          interval={cycle}
          label={plan.cta.label}
          busyLabel={itemLabel(copy, "checkout-busy")}
          errorLabel={itemLabel(copy, "checkout-error")}
          className={buttonClassName}
          variant={variant}
        />
      );
    }

    return (
      <Button asChild className={buttonClassName} variant={variant}>
        <Link href={plan.cta.href === "support" ? SUPPORT_MAILTO : plan.cta.href}>
          {plan.cta.label}
        </Link>
      </Button>
    );
  },
);

PlanFooter.displayName = "PlanFooter";

/** One card: the tier's words, its price for the selected interval, and its footer. */
const PricingCard = memo<{
  plan: PricingPlanView;
  cycle: BillingInterval;
  copy: PageCopySection;
}>(({ plan, cycle, copy }) => {
  const cardClassName = `relative flex flex-col border-2 ${
    plan.popular
      ? "border-action dark:border-action shadow-lg"
      : "border-slate-200 dark:border-slate-800"
  }`;
  const interval = plan.intervals[cycle];

  return (
    <Card className={cardClassName}>
      {plan.popular && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-action hover:bg-action/90 px-3 py-1 text-white border-0">
            {itemLabel(copy, "most-popular")}
          </Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mb-6">
          <div className="flex items-baseline">
            <span className="text-5xl font-bold">
              {interval === null ? "—" : formatCurrencyAmount(interval.displayCents)}
            </span>
            <span className="text-slate-500 dark:text-slate-400 ml-2">
              /{itemLabel(copy, PRICE_SUFFIX_ITEM[cycle])}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {itemLabel(copy, "whats-included")}
          </h4>
          <FeatureList features={plan.features} />
          <LimitationsList limitations={plan.limitations} copy={copy} />
        </div>
      </CardContent>
      <CardFooter>
        <PlanFooter plan={plan} cycle={cycle} copy={copy} />
      </CardFooter>
    </Card>
  );
});

PricingCard.displayName = "PricingCard";

export function PricingPlans({
  copy,
  plans,
  testMode,
}: {
  copy: PageCopySection;
  plans: readonly PricingPlanView[];
  testMode: boolean;
}): JSX.Element {
  const [cycle, setCycle] = useState<BillingInterval>("month");

  const handleBillingToggle = useCallback((checked: boolean): void => {
    setCycle(checked ? "year" : "month");
  }, []);

  const labelClasses = {
    monthly: cycle === "month" ? "font-medium" : "text-slate-500",
    yearly: cycle === "year" ? "font-medium" : "text-slate-500",
  };

  return (
    <section className="py-10 xl:py-20">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{copy.heading}</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {copy.body}
          </p>

          <div className="flex items-center justify-center mt-8 gap-3">
            <Label htmlFor="billing-toggle" className={labelClasses.monthly}>
              {itemLabel(copy, "monthly")}
            </Label>
            <Switch
              id="billing-toggle"
              checked={cycle === "year"}
              onCheckedChange={handleBillingToggle}
            />
            <div className="flex items-center gap-1.5">
              <Label htmlFor="billing-toggle" className={labelClasses.yearly}>
                {itemLabel(copy, "yearly")}
              </Label>
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
              >
                {fillLabel(itemLabel(copy, "save-badge"), {
                  percent: formatPercentValue(metric("pricing.annualDiscount").value),
                })}
              </Badge>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            {itemLabel(copy, "price-note")}
          </p>
          {testMode && (
            <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-500 max-w-2xl mx-auto">
              {itemLabel(copy, "test-mode")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} cycle={cycle} copy={copy} />
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{itemLabel(copy, "custom-plan-tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-sm">
              {itemLabel(copy, "custom-plan")}{" "}
              <Link href={SUPPORT_MAILTO} className="text-action hover:text-action/80 font-medium">
                {itemLabel(copy, "custom-plan-link")}
              </Link>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
