// template-ancestor: components/assessment-flow/my-instances.tsx
"use client";

import { OPINION_LABELS, SETTING_LABELS, opinionKindsFor } from "@/content/assessment";
import { formatDate } from "@/content/core";
import { gapSummary, progressOf, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { Reveal } from "@/components/v1/reveal";
import { EmptyState, LoadingState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/** The verdict sentence the peek reads out — null is "locked", never a guess. */
function verdictLine(
  rel: Parameters<typeof gapSummary>[0],
  summary: ReturnType<typeof gapSummary>,
) {
  if (summary.verdict === null) {
    return "No verdict — the report is locked until both parties submit.";
  }
  const count = summary.totalGaps === 1 ? "Gap" : "Gaps";
  const setting = SETTING_LABELS[rel.setting];
  return summary.verdict.aligned
    ? `Aligned — ${summary.totalGaps} ${count}, all within the ${setting} Setting.`
    : `Not yet aligned — ${summary.unmetGaps} of ${summary.totalGaps} ${count} exceed the ${setting} Setting.`;
}

/** The Initiator's relationships and invitations, with the invite / re-invite action inline. */
export function RelationshipList() {
  const { hydrated, relationships, templates, sendInvite } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Relationships & invitations"
        subtitle="Invite the counterparty, re-invite them, and follow each relationship to its report."
      />

      {relationships.length === 0 ? (
        <EmptyState
          title="No relationships yet"
          body="Create one from the template library."
          action={
            <Link
              href="/v1/initiator/templates"
              className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
            >
              Open the template library
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {relationships.map((rel) => {
            const template = templates.find((t) => t.id === rel.templateId);
            const summary = gapSummary(rel);
            const progress = progressOf(rel);
            const unclaimed = rel.counterpartyName === null;
            const name = relationshipNameOf(rel, template?.title ?? "");
            const opinions = opinionKindsFor(rel.mode).map((kind) => OPINION_LABELS[kind]);
            const lastSession =
              rel.lastSessionAt === null ? "no session yet" : formatDate(rel.lastSessionAt);

            return (
              <li key={rel.id} className="flex items-center gap-2 px-4 py-2">
                <Reveal
                  variant="peek"
                  title={name}
                  description={
                    rel.counterpartyName !== null
                      ? `${rel.initiatorName} · ${rel.counterpartyName}`
                      : `${rel.initiatorName} · awaiting counterparty`
                  }
                  className="min-w-0 flex-1"
                  summary={
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <StageBadge stage={summary.stage} />
                        <span>{lastSession}</span>
                      </span>
                    </span>
                  }
                  detail={
                    <div className="space-y-3">
                      <dl className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">Opinions</dt>
                          <dd className="font-medium text-foreground">{opinions.join(" · ")}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">Initiator answered</dt>
                          <dd className="font-medium text-foreground">
                            {progress.initiatorAnswered}/{progress.aspectCount} aspects
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">Counterparty answered</dt>
                          <dd className="font-medium text-foreground">
                            {progress.counterpartyAnswered}/{progress.aspectCount} aspects
                          </dd>
                        </div>
                      </dl>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                        <span className="font-semibold">Last verdict: </span>
                        {verdictLine(rel, summary)}
                      </p>
                      <Link
                        href={`/v1/relationships/${rel.id}`}
                        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                      >
                        Open relationship
                      </Link>
                    </div>
                  }
                />
                {unclaimed && (
                  <button
                    type="button"
                    onClick={() => sendInvite(rel.id)}
                    className="inline-flex h-11 shrink-0 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {rel.inviteToken === null ? "Send invite" : "Re-invite"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
