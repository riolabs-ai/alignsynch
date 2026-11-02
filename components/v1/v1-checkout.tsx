"use client";

// template-ancestor: components/pricing/plan-checkout-button.tsx   (variation: a prototype checkout — plan, confirm, subscribed, three steps on one form; no processor, no charge, and every figure comes from the shared plans module)

import { formatCurrency } from "@/content/core";
import type { SubscriptionPlan } from "@/data/v1/fixtures";
import { subscriptionPlan, subscriptionPlans } from "@/data/v1/plans";
import { relationshipNameOf } from "@/lib/v1/derive";
import { relationshipsVisibleTo } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { useState } from "react";

type Step = "plan" | "confirm" | "done";

/**
 * The shop's checkout — a prototype form, not a processor. It replaces the live
 * `plan-checkout-button`'s POST to `/api/billing/checkout` with a write to the in-browser store,
 * and it runs in the three steps the card asks for:
 *
 * 1. **plan** — choose the relationship and the plan (`monthly` | `quarterly`); the figure beside
 *    each plan is `data/v1/plans.ts`, the same one `/v1/pricing` prints;
 * 2. **confirm** — a summary of exactly what is about to happen, with the honest label: this
 *    charges nothing, because there is no processor behind it;
 * 3. **subscribed** — the store's `subscribe()` has run, and the panel reads back the state the
 *    store now holds rather than a canned success message.
 *
 * Nothing is collected, no card brand is named, and no total is computed: the figure shown is the
 * plan's own price, and the payment history records one purchase per period.
 */
export function V1Checkout() {
  const { relationships, templates, subscribe } = useV1Store();
  const mine = relationshipsVisibleTo("initiator", relationships);
  const subscribable = mine.filter(
    (rel) => rel.subscription === null || rel.subscription.status !== "active",
  );

  const [step, setStep] = useState<Step>("plan");
  const [plan, setPlan] = useState<SubscriptionPlan>("monthly");
  const [relationshipId, setRelationshipId] = useState<string>("");

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
  const selected = mine.find((candidate) => candidate.id === selectedId);
  const selectedName =
    selected === undefined
      ? "This relationship"
      : relationshipNameOf(
          selected,
          templates.find((t) => t.id === selected.templateId)?.title ?? "",
        );
  const info = subscriptionPlan(plan);
  const current = selected?.subscription ?? null;

  const confirm = () => {
    subscribe(selectedId, plan);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Subscribed</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {selectedName} is now {info.label.toLowerCase()}, active — {info.cadence}, unlimited
          sessions while it stays in good standing. No charge was made: this prototype has no
          processor behind it.
        </p>
        <button
          type="button"
          onClick={() => setStep("plan")}
          className="mt-3 inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          Subscribe another relationship
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Confirm</p>
        <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>Relationship</dt>
            <dd className="text-foreground">{selectedName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Plan</dt>
            <dd className="text-foreground">
              {info.label} · {info.cadence}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Price</dt>
            <dd className="text-foreground">{formatCurrency(info.priceCents)}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          This form charges nothing. It confirms a prototype subscription in this browser and
          records one purchase in the payment history — there is no processor, no card and no
          receipt.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setStep("plan")}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirm}
            className="inline-flex h-11 flex-[2] items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
          >
            Confirm — charges nothing in this prototype
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Subscribe a relationship</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        A subscription covers one relationship. While it is in good standing, sessions on that
        relationship are unlimited.
      </p>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">Relationship</span>
        <select
          value={selectedId}
          onChange={(event) => setRelationshipId(event.target.value)}
          className="mt-1 block h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
        >
          {subscribable.map((rel) => {
            const template = templates.find((t) => t.id === rel.templateId);
            const state = rel.subscription === null ? "unsubscribed" : rel.subscription.status;
            return (
              <option key={rel.id} value={rel.id}>
                {relationshipNameOf(rel, template?.title ?? "")} — {state}
              </option>
            );
          })}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">
          {selected?.counterpartyName === null || selected === undefined
            ? "No counterparty invited yet"
            : `With ${selected.counterpartyName}`}
        </span>
      </label>

      <fieldset className="mt-3 space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">Plan</legend>
        {subscriptionPlans.map((choice) => (
          <label
            key={choice.id}
            className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
          >
            <input
              type="radio"
              name="checkout-plan"
              checked={plan === choice.id}
              onChange={() => setPlan(choice.id)}
              className="h-4 w-4 shrink-0"
            />
            <span className="text-sm font-medium text-foreground">{choice.label}</span>
            <span className="text-xs text-muted-foreground">{choice.cadence}</span>
            <span className="ml-auto text-sm font-semibold text-foreground">
              {formatCurrency(choice.priceCents)}
            </span>
          </label>
        ))}
      </fieldset>

      {current !== null && (
        <p className="mt-3 text-xs text-muted-foreground">
          This relationship is {current.status} on{" "}
          {subscriptionPlan(current.plan).label.toLowerCase()} — subscribing again records a new
          purchase and starts a fresh period from today.
        </p>
      )}

      <button
        type="button"
        onClick={() => setStep("confirm")}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
      >
        Continue to confirm
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Prototype checkout — nothing is charged at any step.
      </p>
    </div>
  );
}
