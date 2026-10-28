"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, HelpCircle } from "lucide-react";
import Link from "next/link";
import { JSX, memo, useCallback, useMemo, useState } from "react";

// Type definitions
type BillingCycle = "monthly" | "yearly";

interface PlanPrice {
  monthly: number;
  yearly: number;
}

interface Plan {
  name: string;
  description: string;
  price: PlanPrice;
  features: string[];
  limitations: string[];
  cta: string;
  popular: boolean;
}

interface FeatureListProps {
  features: string[];
}

interface LimitationsListProps {
  limitations: string[];
}

interface PricingCardProps {
  plan: Plan;
  billingCycle: BillingCycle;
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

// Memoized plans data - doesn't change between renders
const PLANS_DATA: readonly Plan[] = [
  {
    name: "Free",
    description: "Perfect for beginners and casual quiz takers",
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: ["Create up to 5 quizzes", "Take unlimited quizzes", "Basic analytics", "Community support", "Ad-supported experience"],
    limitations: ["Limited quiz templates", "No AI quiz generation", "No custom branding", "Basic reporting only"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Basic",
    description: "Great for educators and content creators",
    price: {
      monthly: 9.99,
      yearly: 7.99,
    },
    features: ["Create up to 50 quizzes", "Ad-free experience", "10 AI-generated quizzes/month", "Basic quiz customization", "Email support", "Download results as CSV", "Basic integrations"],
    limitations: [],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    description: "For professionals and growing businesses",
    price: {
      monthly: 19.99,
      yearly: 16.99,
    },
    features: ["Unlimited quiz creation", "Advanced quiz customization", "50 AI-generated quizzes/month", "Custom branding", "Priority support", "Advanced analytics", "Team collaboration (up to 5)", "API access", "Embed quizzes anywhere"],
    limitations: [],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    price: {
      monthly: 49.99,
      yearly: 39.99,
    },
    features: ["Everything in Pro", "Unlimited AI quiz generation", "Dedicated account manager", "Custom integrations", "SSO authentication", "Advanced security features", "Unlimited team members", "Custom reporting", "SLA guarantees", "Onboarding & training"],
    limitations: [],
    cta: "Contact Sales",
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
    [features]
  );
});

FeatureList.displayName = "FeatureList";

// Memoized limitations list component
const LimitationsList = memo<LimitationsListProps>(({ limitations }) => {
  if (limitations.length === 0) return null;

  return useMemo(
    () => (
      <div className="mt-6">
        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">LIMITATIONS:</h4>
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
    [limitations]
  );
});

LimitationsList.displayName = "LimitationsList";

// Memoized pricing card component
const PricingCard = memo<PricingCardProps>(({ plan, billingCycle }) => {
  const cardContent: CardContentData = useMemo(() => {
    const cardClassName: string = `relative flex flex-col border-2 ${plan.popular ? "border-purple-400 dark:border-purple-500 shadow-lg" : "border-slate-200 dark:border-slate-800"}`;

    const buttonClassName: string = `w-full ${plan.popular ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0" : ""}`;

    const priceDisplay: string = billingCycle === "monthly" ? "mo" : "mo, billed yearly";

    return {
      cardClassName,
      buttonClassName,
      priceDisplay,
    };
  }, [plan.popular, billingCycle]);

  return (
    <Card key={plan.name} className={cardContent.cardClassName}>
      {plan.popular && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-3 py-1 text-white border-0">Most Popular</Badge>
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
            <span className="text-slate-500 dark:text-slate-400 ml-2">/{cardContent.priceDisplay}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">WHAT&apos;S INCLUDED:</h4>
          <FeatureList features={plan.features} />
          <LimitationsList limitations={plan.limitations} />
        </div>
      </CardContent>
      <CardFooter>
        <Button className={cardContent.buttonClassName} variant={plan.popular ? "default" : "outline"}>
          {plan.cta}
        </Button>
      </CardFooter>
    </Card>
  );
});

PricingCard.displayName = "PricingCard";

export function PricingPlans(): JSX.Element {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  // Memoized billing toggle handler
  const handleBillingToggle = useCallback((checked: boolean): void => {
    setBillingCycle(checked ? "yearly" : "monthly");
  }, []);

  // Memoized pricing cards
  const pricingCards = useMemo((): JSX.Element[] => {
    return PLANS_DATA.map((plan: Plan) => <PricingCard key={plan.name} plan={plan} billingCycle={billingCycle} />);
  }, [billingCycle]);

  // Memoized label classes
  const labelClasses: LabelClasses = useMemo(
    () => ({
      monthly: billingCycle === "monthly" ? "font-medium" : "text-slate-500",
      yearly: billingCycle === "yearly" ? "font-medium" : "text-slate-500",
    }),
    [billingCycle]
  );

  return (
    <section className="py-10 xl:py-20">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Choose the perfect plan for your quiz creation and learning needs</p>

          <div className="flex items-center justify-center mt-8 gap-3">
            <Label htmlFor="billing-toggle" className={labelClasses.monthly}>
              Monthly
            </Label>
            <Switch id="billing-toggle" checked={billingCycle === "yearly"} onCheckedChange={handleBillingToggle} />
            <div className="flex items-center gap-1.5">
              <Label htmlFor="billing-toggle" className={labelClasses.yearly}>
                Yearly
              </Label>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                Save 20%
              </Badge>
            </div>
          </div>
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
                  <p className="max-w-xs">Contact our sales team for custom pricing options tailored to your organization&apos;s specific needs.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-sm">
              Need a custom plan?{" "}
              <Link href="#" className="text-purple-600 hover:text-purple-700 font-medium">
                Contact us
              </Link>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
