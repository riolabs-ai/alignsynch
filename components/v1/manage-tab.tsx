// template-ancestor: components/my-quizzes/quiz-details.tsx
"use client";

import type { Assessment } from "@/content/assessment";
import { SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import type { V1Relationship } from "@/data/v1/fixtures";
import { gapSummary, meanGapOf, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/**
 * The Manage tab of the relationship detail — the ancestor manage dashboard re-keyed to
 * a relationship. Metric row (session completion, average alignment, what was paid) → status block
 * (stage + session count) → detail list (N aspects, last session, badges). The arrangement and the
 * spacing are the ancestor's; every label is the AlignSynch equivalent.
 */

function relativeDay(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const dash = (value: string | null): string => value ?? "—";

export function ManageTab({ rel, template }: { rel: V1Relationship; template?: Assessment }) {
  const { persona } = useV1Store();
  const summary = gapSummary(rel);
  const complete = summary.verdict !== null;
  const meanGap = meanGapOf(rel);
  const canSeeAlignment = persona === "initiator" || persona === "admin";

  // Blind outranks the dashboard: a counterparty whose session is open reads the stage sentence,
  // not the numbers.
  if (persona === "counterparty" && !complete) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Your session is open — you answer the sheet, so the manage numbers stay out of view until
        both parties accept. Right now this relationship is{" "}
        <span className="font-medium text-foreground">{summary.stage}</span>.
      </p>
    );
  }

  const opened = rel.openedSessions;
  const completed = rel.completedSessions;
  const completionPercent = opened === 0 ? null : `${Math.round((completed / opened) * 100)}%`;
  const completionFraction = opened === 0 ? null : `${completed} / ${opened}`;
  const nextSession = !complete
    ? "opens when both accept"
    : rel.counterpartyName === null
      ? "awaits a counterparty"
      : "available";

  return (
    <div className="space-y-6">
      {/* Metric row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-sm text-muted-foreground">Session completion</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {dash(completionPercent)}
          </div>
          <div className="text-xs text-muted-foreground">{dash(completionFraction)} sessions</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-sm text-muted-foreground">Average alignment</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {canSeeAlignment && meanGap !== null ? meanGap.toFixed(1) : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {canSeeAlignment ? "mean Gap (lower is tighter)" : "visible to the Initiator"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-sm text-muted-foreground">Subscription</div>
          <div className="mt-1 text-2xl font-semibold capitalize text-foreground">
            {rel.subscription === null ? "—" : rel.subscription.plan}
          </div>
          <div className="text-xs text-muted-foreground">
            {rel.subscription === null
              ? "no subscription"
              : `${rel.subscription.status} · ends ${formatDate(rel.subscription.periodEnd)}`}
          </div>
        </div>
      </div>

      {/* Status block */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Status</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StageBadge stage={summary.stage} />
          <span className="text-muted-foreground">
            {completed} of {opened} sessions completed
          </span>
          <span className="text-muted-foreground">next session {nextSession}</span>
        </div>
      </div>

      {/* Detail list */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Aspects in the blueprint</span>
          <span className="font-medium text-foreground">{rel.items.length}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Last session</span>
          {rel.lastSessionAt === null ? (
            <span className="text-muted-foreground">no session yet</span>
          ) : (
            <Link
              href={`/v1/relationships/${rel.id}/report`}
              className="font-medium text-action hover:underline"
            >
              {relativeDay(rel.lastSessionAt)} · {formatDate(rel.lastSessionAt)}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {rel.sharedWithCoach ? "Shared with coach" : "Private"}
          </span>
          <StageBadge stage={summary.stage} />
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {template?.title ?? relationshipNameOf(rel, "")}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {rel.mode} mode · {SETTING_LABELS[rel.setting]} setting
      </p>
    </div>
  );
}
