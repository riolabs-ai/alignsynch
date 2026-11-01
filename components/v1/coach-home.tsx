// template-ancestor: components/assessment-flow/my-instances.tsx   (variation: the coach's read-only relationship list)
"use client";

import { gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/** The Coach's home — read-only observation of shared relationships, plus the advice thread. */
export function CoachHome() {
  const { hydrated, relationships, templates } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const shared = relationships.filter((rel) => rel.sharedWithCoach);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Coach"
        subtitle="Observe relationships shared with you and leave advice. No scoring, no answering."
      />

      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
        Prototype — not represented in the schema. <code className="text-xs">party.role</code> is
        only <code className="text-xs">initiator</code> or{" "}
        <code className="text-xs">counterparty</code>; a third party does not exist in the model.
        These screens are demonstration only.
      </p>

      {shared.length === 0 ? (
        <EmptyState
          title="No shared relationships"
          body="The Initiator shares a relationship with you to open it here."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {shared.map((rel) => {
            const template = templates.find((t) => t.id === rel.templateId);
            const summary = gapSummary(rel);
            return (
              <li key={rel.id}>
                <Link
                  href={`/v1/relationships/${rel.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {relationshipNameOf(rel, template?.title ?? "")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rel.initiatorName} · {rel.counterpartyName ?? "counterparty not claimed"} ·{" "}
                      {rel.coachComments.length} comment{rel.coachComments.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StageBadge stage={summary.stage} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
