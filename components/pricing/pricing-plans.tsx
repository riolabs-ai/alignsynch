"use client";

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
import type { PageCopySection } from "@/content/pages";
import { formatPercentValue } from "@/content/metrics";
import { brand } from "@/data/brand";
import { metric } from "@/data/metrics";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Check, HelpCircle } from "lucide-react";
import Link from "next/link";
import { type JSX, memo, useCallback, useMemo, useState } from "react";

// Type definitions
type BillingCycle = "monthly" | "yearly";

interface PlanPrice {
  monthly: number;
  yearly: number;
}

interface PlanCta {
  label: string;
  /** A route or a `mailto:` — every plan CTA has a destination, because a dead button is a bug. */
  href: string;
}

interface Plan {
  name: string;
  description: string;
  price: PlanPrice;
  features: string[];
  limitations: string[];
  cta: PlanCta;
  popular: boolean;
}

interface FeatureListProps {
  features: string[];
}

interface LimitationsListProps {
  limitations: string[];
  copy: PageCopySection;
}

interface PricingCardProps {
  plan: Plan;
  billingCycle: BillingCycle;
  copy: PageCopySection;
}

interface CardContentData {
  cardClassName: string;
  buttonClassName: string;
  priceDisplay: string;
}

interface LabelClasses {
  monthly: string;
  yearly: string;
}

/**
 * The four plans, as the page states them.
 *
 * What a row may say is decided by what the tree does, not by what a pricing table
 * usually promises (Jaden, 2026-10-31). Every row below is either verifiable today —
 * an instance's mode is fixed at creation (`content/assessment.ts`), the report prints
 * one line per Gap (`components/assessment/assessment-report.tsx`), a party comes back
 * to their assessments at `/assessment/instances`, and the other party is invited by
 * link (`/invite/[token]`) — or it is one of the two facts #289's gate will enforce
 * (paid = unlimited active assessments + Advanced Mode), which is what the `price-note`
 * under the toggle declares the page to be describing.
 *
 * Removed, and why: quiz-creation caps and AI quotas (nothing enforces a limit, and the
 * generator draws from `data/mock-quizzes`); ad-supported / ad-free (no ad code);
 * basic/advanced analytics (a fixture); support tiers (one mailbox, `brand.supportEmail`);
 * custom branding and quiz customization (the build-time brand, not a per-user setting);
 * team collaboration and seats (no organisation model); API access and embeds (neither
 * exists); SSO and "advanced security" (auth is Neon's managed Better Auth); CSV export
 * and integrations (no export path); and the Enterprise list — SLA, account manager,
 * custom reporting, custom integrations, onboarding — which are not offerings.
 *
 * Basic and Pro carry the same rows. #289 gates paid plans as "unlimited active
 * assessments + Advanced Mode" and nothing else in the tree separates the two, so the
 * tier and its price stay (D1) and the rows do not invent a difference to justify one.
 */
const SUPPORT_MAILTO = `mailto:${brand.supportEmail}`;

const PLANS_DATA: readonly Plan[] = [
  {
    name: "Free",
    description: "For trying the assessment format",
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      "Basic Mode: Feel and Wish on every Aspect",
      "The report, one line per Gap",
      "Your assessments in one list",
      "Invite the other party by link",
    ],
    limitations: ["One active assessment at a time", "Advanced Mode needs a paid plan"],
    cta: { label: "Start free", href: "/register" },
    popular: false,
  },
  {
    name: "Basic",
    description: "For a two-party practice",
    price: {
      monthly: 9.99,
      yearly: 7.99,
    },
    features: [
      "Unlimited active assessments",
      "Basic Mode and Advanced Mode",
      "The report, one line per Gap",
      "Your assessments in one list",
      "Invite the other party by link",
    ],
    limitations: [],
    cta: { label: "Talk to us", href: SUPPORT_MAILTO },
    popular: false,
  },
  {
    name: "Pro",
    description: "For a busier two-party practice",
    price: {
      monthly: 19.99,
      yearly: 16.99,
    },
    features: [
      "Unlimited active assessments",
      "Basic Mode and Advanced Mode",
      "The report, one line per Gap",
      "Your assessments in one list",
      "Invite the other party by link",
    ],
    limitations: [],
    cta: { label: "Talk to us", href: SUPPORT_MAILTO },
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For organisations that want to agree terms first",
    price: {
      monthly: 49.99,
      yearly: 39.99,
    },
    features: ["Everything in Pro", "Volume, procurement and terms, agreed by email"],
    limitations: ["SSO, team management, custom reporting and integrations are not built"],
    cta: { label: "Contact us", href: SUPPORT_MAILTO },
    popular: false,
  },
] as const;

// Memoized feature list component
const FeatureList = memo<FeatureListProps>(({ features }) => {
  return useMemo(
    () => (
      <ul className="space-y-3">
        {features.map((feature: string) => (
          <li key={feature} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    ),
    [features],
  );
});

FeatureList.displayName = "FeatureList";

// Memoized limitations list component
const LimitationsList = memo<LimitationsListProps>(({ limitations, copy }) => {
  if (limitations.length === 0) return null;

  return useMemo(
    () => (
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
    ),
    [limitations, copy],
  );
});

LimitationsList.displayName = "LimitationsList";

// Memoized pricing card component
const PricingCard = memo<PricingCardProps>(({ plan, billingCycle, copy }) => {
  const cardContent: CardContentData = useMemo(() => {
    const cardClassName: string = `relative flex flex-col border-2 ${plan.popular ? "border-action dark:border-action shadow-lg" : "border-slate-200 dark:border-slate-800"}`;

    const buttonClassName: string = `w-full ${plan.popular ? "bg-action hover:bg-action/90 text-white border-0" : ""}`;

    const priceDisplay: string =
      billingCycle === "monthly"
        ? itemLabel(copy, "price-per-month")
        : itemLabel(copy, "price-per-month-yearly");

    return {
      cardClassName,
      buttonClassName,
      priceDisplay,
    };
  }, [plan.popular, billingCycle, copy]);

  return (
    <Card key={plan.name} className={cardContent.cardClassName}>
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
            <span className="text-3xl font-bold">$</span>
            <span className="text-5xl font-bold">{plan.price[billingCycle]}</span>
            <span className="text-slate-500 dark:text-slate-400 ml-2">
              /{cardContent.priceDisplay}
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
        <Button
          asChild
          className={cardContent.buttonClassName}
          variant={plan.popular ? "default" : "outline"}
        >
          <Link href={plan.cta.href}>{plan.cta.label}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
});

PricingCard.displayName = "PricingCard";

export function PricingPlans({ copy }: { copy: PageCopySection }): JSX.Element {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  // Memoized billing toggle handler
  const handleBillingToggle = useCallback((checked: boolean): void => {
    setBillingCycle(checked ? "yearly" : "monthly");
  }, []);

  // Memoized pricing cards
  const pricingCards = useMemo((): JSX.Element[] => {
    return PLANS_DATA.map((plan: Plan) => (
      <PricingCard key={plan.name} plan={plan} billingCycle={billingCycle} copy={copy} />
    ));
  }, [billingCycle, copy]);

  // Memoized label classes
  const labelClasses: LabelClasses = useMemo(
    () => ({
      monthly: billingCycle === "monthly" ? "font-medium" : "text-slate-500",
      yearly: billingCycle === "yearly" ? "font-medium" : "text-slate-500",
    }),
    [billingCycle],
  );

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
              checked={billingCycle === "yearly"}
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">{pricingCards}</div>

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
