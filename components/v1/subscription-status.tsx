// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: the subscription state in a relationship header)
"use client";

import { formatDate } from "@/content/core";
import type { V1Relationship, V1Subscription } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";

/** The two mock-billing sentences, authored once and quoted by every billing surface. */
export const MOCK_SUBSCRIPTION_BADGE = "Mock subscription — no charge";
export const COUNTERPARTY_PAYS_NOTHING = "Your counterparty pays nothing.";

const STATUS_TONE: Record<V1Subscription["status"], string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
  lapsed: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<V1Subscription["status"], string> = {
  active: "Active",
  past_due: "Past due",
  lapsed: "Lapsed",
};

/** The status pill's tone and word, exported so the shop's rows paint a state the same way. */
export const SUBSCRIPTION_STATUS_TONE = STATUS_TONE;
export const SUBSCRIPTION_STATUS_LABEL = STATUS_LABEL;

/**
 * The subscription state a relationship header renders — plan, status, period end and the mock
 * badge. `lapsed` is a real screen state: it carries the one clear action to restore, and the
 * caller draws its own "sessions cannot start" sentence beside it.
 */
export function SubscriptionStatus({ rel }: { rel: V1Relationship }) {
  const { persona, restoreSubscription } = useV1Store();
  const sub = rel.subscription;
  const isInitiator = persona === "initiator";

  if (sub === null) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
        <span className="text-sm text-muted-foreground">No subscription</span>
        <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {MOCK_SUBSCRIPTION_BADGE}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-semibold capitalize text-foreground">{sub.plan}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            STATUS_TONE[sub.status],
          )}
        >
          {STATUS_LABEL[sub.status]}
        </span>
        <span className="text-xs text-muted-foreground">ends {formatDate(sub.periodEnd)}</span>
        <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {MOCK_SUBSCRIPTION_BADGE}
        </span>
        {sub.status === "lapsed" && isInitiator && (
          <button
            type="button"
            onClick={() => restoreSubscription(rel.id)}
            className="inline-flex h-9 items-center rounded-md bg-action px-3 text-sm font-medium text-action-foreground hover:bg-action/90"
          >
            Restore subscription
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{COUNTERPARTY_PAYS_NOTHING}</p>
    </div>
  );
}
