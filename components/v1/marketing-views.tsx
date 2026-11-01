// template-ancestor: components/marketing/marketing-landing.tsx
import { billingPlans } from "@/data/billing-plans";
import { brand } from "@/data/brand";
import { formatCurrency } from "@/content/core";
import { SectionIntro } from "@/components/v1/v1-ui";

/**
 * The /v1 pricing surface — the same four tiers the live page renders (`data/billing-plans.ts`),
 * re-painted with the brand tokens and no checkout: nothing here is purchasable, which the note
 * states rather than hiding. The plan copy is the fixture's, so no claim is invented here.
 */
export function V1Pricing() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Pricing"
        subtitle="The four tiers, in US dollars. In this prototype nothing is charged."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {billingPlans.map((plan) => (
          <div
            key={plan.id}
            className={
              plan.popular
                ? "rounded-lg border-2 border-action bg-card p-4"
                : "rounded-lg border border-border bg-card p-4"
            }
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{plan.name}</p>
              {plan.popular && (
                <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-action-foreground">
                  Popular
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {formatCurrency(plan.monthlyCents)}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </p>
            <ul className="mt-3 space-y-1">
              {plan.features.map((feature) => (
                <li key={feature} className="text-xs text-muted-foreground">
                  {feature}
                </li>
              ))}
            </ul>
            {plan.limitations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {plan.limitations.map((limitation) => (
                  <li key={limitation} className="text-xs text-muted-foreground">
                    {limitation}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground">
              {plan.cta.label}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Prices are the fixture&apos;s. The Free plan works today; the paid plans are not purchasable
        in this prototype, so every CTA is disabled rather than a dead checkout.
      </p>
    </div>
  );
}

/**
 * The /v1 support surface — the facts the live support page states, minus the taxonomy the
 * alignment build does not offer. The contact line reads the brand record's mailbox.
 */
export function V1Support() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro title="Support" subtitle="Help for your AlignSynch account." />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            heading: "This is a beta",
            body: "The records behind these screens are a demonstration set, reset and reseeded every night from a versioned bundle.",
          },
          {
            heading: "Coach support is not built",
            body: "The Coach is a word in the product's vocabulary and a feature in no file. The app shows the Gap and stops there.",
          },
          {
            heading: "The Gap",
            body: "A Gap is the difference between two scores on one Aspect, computed from the answers and never stored.",
          },
        ].map((card) => (
          <div key={card.heading} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">{card.heading}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Email us at{" "}
        <a
          href={`mailto:${brand.supportEmail}`}
          className="font-medium text-action hover:underline"
        >
          {brand.supportEmail}
        </a>
        .
      </p>
    </div>
  );
}
