// template-ancestors: components/my-quizzes/my-quizzes.tsx (status rows),
//   components/explore/explore-quiz-list.tsx (card list),
//   components/my-quizzes/quiz-statistics.tsx (chart over components/ui/chart.tsx),
//   components/ui/page-header.tsx (header block)
"use client";

import { formatDate } from "@/content/core";
import { seedSessions, type V1Relationship } from "@/data/v1/fixtures";
import { bothSubmittedOf, sessionSummaryOf, trendOf } from "@/lib/v1/derive";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import Link from "next/link";
import { Line, LineChart } from "recharts";

/** One primary action — a link or a button, exactly one of the two. */
export interface PrimaryAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

const actionClasses =
  "inline-flex h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90";

/** The header's one action and the empty state's one action share this, so they cannot drift. */
export function PrimaryActionButton({ action }: { action: PrimaryAction }) {
  if (action.href !== undefined) {
    return (
      <Link href={action.href} className={actionClasses}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={actionClasses}>
      {action.label}
    </button>
  );
}

/**
 * The open session's one line, role-aware so "waiting" names who is waiting, and always
 * blind: no value, no answered count, no Gap. A party mid-answer is owed the state of the
 * conversation, never the other party's numbers.
 */
function openSessionLine(rel: V1Relationship, viewer: "initiator" | "counterparty" | null): string {
  if (viewer === "initiator") {
    return rel.initiatorSubmitted
      ? "In progress — you've answered, waiting for them."
      : "In progress — start by answering your side.";
  }
  if (viewer === "counterparty") {
    return rel.counterpartySubmitted
      ? "In progress — you've answered, waiting for them."
      : "In progress — they've answered, waiting for you.";
  }
  return "In progress — one of you has answered, waiting for the other.";
}

/** The verdict as a word, never colour alone: "Aligned" or "N unmet". */
function VerdictPill({ aligned, unmetCount }: { aligned: boolean; unmetCount: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        aligned
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {aligned ? "Aligned" : `${unmetCount} unmet`}
    </span>
  );
}

/** The one trend line — the mean Gap of each completed session, oldest → newest. */
function TrendSparkline({ points }: { points: readonly number[] }) {
  const data = points.map((gap, index) => ({ index, gap }));
  return (
    <div className="mt-3 h-12 w-full" aria-hidden="true">
      <ChartContainer
        config={{ gap: { label: "Mean gap", color: "hsl(var(--chart-1))" } }}
        className="aspect-auto h-full w-full"
      >
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line
            type="monotone"
            dataKey="gap"
            stroke="var(--color-gap)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function SessionTimeline({
  rel,
  viewer,
  primaryAction,
}: {
  rel: V1Relationship;
  viewer: "initiator" | "counterparty" | null;
  primaryAction: PrimaryAction | null;
}) {
  // The completed sessions for this relationship, newest first. The summaries are derived
  // from each session's own answers, so a row can never quote a number the report disagrees
  // with.
  const sessions = seedSessions
    .filter((session) => session.relationshipId === rel.id)
    .map((session) => sessionSummaryOf(rel, session))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const trend = trendOf(sessions);
  const hasOpenSession = rel.counterpartyName !== null && !bothSubmittedOf(rel);
  const isEmpty = !hasOpenSession && sessions.length === 0;

  if (isEmpty) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No sessions yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          A session is one conversation: both of you answer the same Aspects from your own side,
          then the gap between your answers becomes the report you read together.
        </p>
        {primaryAction !== null && (
          <div className="mt-4 flex justify-center">
            <PrimaryActionButton action={primaryAction} />
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* The open session sits at the top, distinct and blind — no value, count or Gap. */}
      {hasOpenSession && (
        <section data-blind="true" className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">In progress</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{openSessionLine(rel, viewer)}</p>
            </div>
          </div>
        </section>
      )}

      {/* One trend line, computed from the rows below — never a percent, never decorative. */}
      {sessions.length > 0 && trend.sentence !== null && (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Trend</p>
          <p className="mt-1 text-sm text-muted-foreground" data-trend-sentence>
            {trend.sentence}
          </p>
          {trend.points.length >= 2 && <TrendSparkline points={trend.points} />}
        </section>
      )}

      {/* The completed sessions, newest first. Every row leads to its report. */}
      <ul className="space-y-2">
        {sessions.map((summary) => (
          <li key={summary.completedAt}>
            <Link
              href={`/v1/relationships/${rel.id}/report`}
              className="flex min-h-11 flex-col justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span className="text-sm font-medium text-foreground">
                  {formatDate(summary.completedAt)}
                </span>
                <VerdictPill aligned={summary.aligned} unmetCount={summary.unmetCount} />
                <span className="text-sm text-muted-foreground">
                  widest gap {summary.widestGap ?? "—"}
                </span>
              </span>
              <span className="text-sm font-medium text-action">View report</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
