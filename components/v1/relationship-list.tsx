// template-ancestor: components/assessment-flow/my-instances.tsx
"use client";

import { counterpartyLabelOf, gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import type { FlowStep } from "@/data/v1/fixtures";
import Link from "next/link";

const STEP_LABELS: Record<FlowStep, string> = {
  name: "Naming",
  personalize: "Personalizing",
  purchase: "Purchase",
  invite: "Invite",
};

/** The Initiator's relationships and invitations, with the invite / re-invite action inline. */
export function RelationshipList() {
  const { hydrated, relationships, templates, drafts, sendInvite, removeDraft } = useV1Store();

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

      {drafts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Drafts</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {drafts.map((draft) => {
              const template = templates.find((t) => t.id === draft.templateId);
              return (
                <li
                  key={draft.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {template?.title ?? "Relationship"} — draft
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Left off at {STEP_LABELS[draft.step]}
                      {draft.counterpartyName.trim() === ""
                        ? ""
                        : ` · with ${draft.counterpartyName.trim()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/v1/flow/${draft.id}`}
                      className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                    >
                      Resume
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeDraft(draft.id)}
                      className="inline-flex h-11 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
                    >
                      Discard
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
            const unclaimed = rel.counterpartyName === null;
            const label = counterpartyLabelOf(rel);
            return (
              <li
                key={rel.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/v1/relationships/${rel.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {relationshipNameOf(rel, template?.title ?? "")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {rel.initiatorName}
                    {label !== null ? ` · ${label}` : " · awaiting counterparty"}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  <StageBadge stage={summary.stage} />
                  {unclaimed && (
                    <button
                      type="button"
                      onClick={() => sendInvite(rel.id)}
                      className="inline-flex h-11 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {rel.inviteToken === null ? "Send invite" : "Re-invite"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
