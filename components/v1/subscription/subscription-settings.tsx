"use client";
// template-ancestor: components/settings/subscription-settings.tsx   (variation: the initiator's billing — one row per relationship subscription read from the store, with a standing badge and a card-on-file line, instead of plan tiers and a fabricated card number)

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { V1Subscription } from "@/data/v1/fixtures";
import { relationshipNameOf } from "@/lib/v1/derive";
import { relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { CreditCard } from "lucide-react";

/**
 * The initiator's settings section (#384), and the only module in the prototype whose prose
 * names billing. It is mounted by `components/v1/settings/settings-view.tsx` for the initiator
 * alone — `settingsSectionsFor("counterparty")` has no `subscription` row, so a counterparty's
 * settings cannot reach this file, its words or its numbers.
 *
 * It also owns the fourth notification event. "Payment failed" is a real event the product
 * emits, and it can only ever reach the person whose card is charged — so the event lives with
 * the billing surface rather than in the shared notification catalogue. `settings-view.tsx`
 * appends it to the initiator's notification list, which is how the initiator sees all four
 * events while every other persona's list stays free of a charge that cannot happen to them.
 *
 * Every row is a relationship's `subscription` read from the store — plan, standing, period end.
 * Nothing here invents a card number, a charge or an invoice: the prototype never charges.
 */

const STATUS_TONE: Readonly<Record<V1Subscription["status"], string>> = {
  active: "bg-green-50 text-green-700 border-green-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
  lapsed: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABEL: Readonly<Record<V1Subscription["status"], string>> = {
  active: "Active",
  past_due: "Past due",
  lapsed: "Lapsed",
};

/** The payer's fourth notification event — see the header. Only the initiator renders it. */
export const PAYER_NOTIFICATION_EVENTS = [
  {
    id: "paymentFailed",
    label: "Payment failed",
    detail: "When a subscription charge does not clear.",
  },
] as const;

export function SubscriptionSettings({ persona }: { persona: DashboardPersona }) {
  const { relationships, templates } = useV1Store();
  const owned = relationshipsVisibleTo(persona, relationships);
  const subscriptions = owned.filter((rel) => rel.subscription !== null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Subscriptions are held per relationship, by the initiator. The counterparty pays
            nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            subscriptions.map((rel) => {
              const subscription = rel.subscription;
              if (subscription === null) return null;
              const name = relationshipNameOf(
                rel,
                templates.find((t) => t.id === rel.templateId)?.title ?? rel.templateId,
              );
              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm capitalize text-muted-foreground">
                      {subscription.plan} · renews {formatDate(subscription.periodEnd)}
                    </p>
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[subscription.status]}>
                    {STATUS_LABEL[subscription.status]}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>How a subscription would be charged.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <CreditCard className="h-5 w-5 text-action" aria-hidden="true" />
          Card on file — prototype, nothing is charged.
        </CardContent>
      </Card>
    </div>
  );
}
