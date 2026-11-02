"use client";

// template-ancestor: components/pricing/pricing-plans.tsx   (variation: the per-relationship subscription plans — monthly and quarterly — with the initiator's own subscriptions, a prototype checkout and a payment history behind a capability check; the public pricing surface renders the same two plans with no billing)

import {
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
} from "@/components/v1/subscription-status";
import { V1Checkout } from "@/components/v1/v1-checkout";
import { SectionIntro } from "@/components/v1/v1-ui";
import { formatCurrency, formatDate } from "@/content/core";
import type { V1Subscription } from "@/data/v1/fixtures";
import { subscriptionPlan, subscriptionPlans, WHAT_EACH_BUYS } from "@/data/v1/plans";
import { relationshipNameOf } from "@/lib/v1/derive";
import { relationshipsVisibleTo } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";

/**
 * The renewal line, said three ways because the three states mean different things: a
 * subscription in good standing renews on a date, a past-due one is waiting for that payment, and
 * a lapsed one stopped at a date that has already passed. Say which — one "renews" over a lapsed
 * row would be a small lie the state does not support.
 */
function renewalLine(sub: V1Subscription): string {
  if (sub.status === "active") return `Renews ${formatDate(sub.periodEnd)}`;
  if (sub.status === "past_due") return `Renewal due ${formatDate(sub.periodEnd)}`;
  return `Lapsed since ${formatDate(sub.periodEnd)}`;
}

/**
 * The one pricing/shop surface (#384 §3). The public `/v1/pricing` and the initiator's in-app
 * `/v1/[persona]/shop` render this same component; the difference is the capability check:
 *
 *   - `canManageBilling` false (the public page) prints the two plans and the honest
 *     "nothing is charged" line, and nothing else — no subscriptions, no checkout, no billing.
 *   - `canManageBilling` true (the in-app shop) adds the initiator's own subscriptions — plan,
 *     status and renewal date, one row per relationship — the prototype checkout and the payment
 *     history: one row per purchase, never a total.
 *
 * Both halves read their money from `data/v1/plans.ts`, so a price the marketing page shows is
 * the price the checkout applies. Nothing here invents a discount, a tax line, a card brand or a
 * currency total, and nothing charges anything: there is no processor behind this form.
 */
export function V1Shop({ canManageBilling = false }: { canManageBilling?: boolean }) {
  const { relationships, templates } = useV1Store();
  const mine = relationshipsVisibleTo("initiator", relationships);

  const nameOf = (rel: (typeof mine)[number]) =>
    relationshipNameOf(rel, templates.find((t) => t.id === rel.templateId)?.title ?? "");

  const payments = mine
    .flatMap((rel) =>
      (rel.subscription?.payments ?? []).map((payment) => ({ ...payment, name: nameOf(rel) })),
    )
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Subscription"
        subtitle={
          canManageBilling
            ? "One subscription per relationship. The person you invite pays nothing — you hold the subscription."
            : "One price, per relationship. In this prototype nothing is charged."
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {subscriptionPlans.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{plan.label}</p>
              <p className="text-xs text-muted-foreground">{plan.cadence}</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {formatCurrency(plan.priceCents)}
              <span className="text-xs font-normal text-muted-foreground"> / period</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{WHAT_EACH_BUYS}</p>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        A subscription covers one relationship. The person you invite joins by link and pays nothing
        — the initiator holds the subscription. In this prototype nothing is charged, so no payment
        method is collected.
      </p>

      {canManageBilling && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Your relationships</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No relationships yet — start one from a template, then subscribe it here.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {mine.map((rel) => {
                  const sub = rel.subscription;
                  return (
                    <li key={rel.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{nameOf(rel)}</p>
                        {sub === null ? (
                          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            No subscription
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              SUBSCRIPTION_STATUS_TONE[sub.status],
                            )}
                          >
                            {SUBSCRIPTION_STATUS_LABEL[sub.status]}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {rel.counterpartyName === null
                          ? "No counterparty invited yet"
                          : `With ${rel.counterpartyName}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sub === null
                          ? "Unsubscribed — choose a plan below."
                          : `${subscriptionPlan(sub.plan).label} · ${subscriptionPlan(sub.plan).cadence} · ${renewalLine(sub)}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Checkout</h2>
            <V1Checkout />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Payment history</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{payment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.paidAt)} · {subscriptionPlan(payment.plan).label}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      {formatCurrency(payment.amountCents)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              One purchase per period. Each row is a single payment — there is no total, because no
              total is charged in this prototype.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
