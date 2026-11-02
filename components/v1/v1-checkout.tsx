"use client";

// template-ancestor: components/pricing/plan-checkout-button.tsx   (variation: a prototype checkout form — pick a plan and a relationship, confirm, and subscribe the in-browser store; no processor, no charge, and the amount comes from the shared plans module)

import { formatCurrency } from "@/content/core";
import type { SubscriptionPlan } from "@/data/v1/fixtures";
import { subscriptionPlans } from "@/data/v1/plans";
import { relationshipNameOf } from "@/lib/v1/derive";
import { relationshipsVisibleTo } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { useState } from "react";

/**
 * The shop's checkout — a prototype form, not a processor. It replaces the live
 * `plan-checkout-button`'s POST to `/api/billing/checkout` with a write to the in-browser store:
 * choose a plan (monthly | quarterly) and a relationship, confirm, and that relationship is
 * subscribed. The honest label says so — nothing is charged — and the price beside each plan is
 * the same figure `/v1/pricing` prints, read from `data/v1/plans.ts`.
 */
export function V1Checkout() {
  const { relationships, templates, subscribe } = useV1Store();
  const mine = relationshipsVisibleTo("initiator", relationships);
  const subscribable = mine.filter(
    (rel) => rel.subscription === null || rel.subscription.status !== "active",
  );
  const [plan, setPlan] = useState<SubscriptionPlan>("monthly");
  const [relationshipId, setRelationshipId] = useState<string>("");
  const [done, setDone] = useState<{ name: string; plan: SubscriptionPlan } | null>(null);

  if (subscribable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every relationship you hold is in good standing — there is nothing to subscribe.
      </p>
    );
  }

  const selectedId = subscribable.some((rel) => rel.id === relationshipId)
    ? relationshipId
    : subscribable[0].id;

  const confirm = () => {
    subscribe(selectedId, plan);
    const rel = mine.find((candidate) => candidate.id === selectedId);
    const template = rel === undefined ? undefined : templates.find((t) => t.id === rel.templateId);
    setDone({
      name:
        rel === undefined ? "This relationship" : relationshipNameOf(rel, template?.title ?? ""),
      plan,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Subscribe a relationship</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        A subscription covers one relationship. While it is in good standing, sessions on that
        relationship are unlimited.
      </p>

      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">Plan</legend>
        {subscriptionPlans.map((info) => (
          <label
            key={info.id}
            className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
          >
            <input
              type="radio"
              name="checkout-plan"
              checked={plan === info.id}
              onChange={() => setPlan(info.id)}
              className="h-4 w-4 shrink-0"
            />
            <span className="text-sm font-medium text-foreground">{info.label}</span>
            <span className="text-xs text-muted-foreground">{info.cadence}</span>
            <span className="ml-auto text-sm font-semibold text-foreground">
              {formatCurrency(info.priceCents)}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">Relationship</span>
        <select
          value={selectedId}
          onChange={(event) => setRelationshipId(event.target.value)}
          className="mt-1 block h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
        >
          {subscribable.map((rel) => {
            const template = templates.find((t) => t.id === rel.templateId);
            return (
              <option key={rel.id} value={rel.id}>
                {relationshipNameOf(rel, template?.title ?? "")}
              </option>
            );
          })}
        </select>
      </label>

      <button
        type="button"
        onClick={confirm}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
      >
        Subscribe — charges nothing in this prototype
      </button>

      {done !== null && (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {done.name} is now subscribed {done.plan}, active. No charge in this prototype.
        </p>
      )}
    </div>
  );
}
