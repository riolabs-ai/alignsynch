// template-ancestor: none — prototype screen, approved for /v1
"use client";

import { PERSONA_META } from "@/data/v1/fixtures";
import { bothSubmittedOf, gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/** The Counterparty's home — claimable invitations, and the relationships they have joined. */
export function CounterpartyHome() {
  const { hydrated, relationships, templates, claimInvite } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const claimable = relationships.filter(
    (rel) => rel.counterpartyName === null && rel.inviteToken !== null,
  );
  const mine = relationships.filter(
    (rel) => rel.counterpartyName === PERSONA_META.counterparty.name,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Your invitations"
        subtitle="Claim an invitation, then answer the same Aspects from your side."
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Claimable</h2>
        {claimable.length === 0 ? (
          <EmptyState
            title="No claimable invitations"
            body="The Initiator has not invited you yet."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {claimable.map((rel) => {
              const template = templates.find((t) => t.id === rel.templateId);
              return (
                <li key={rel.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {relationshipNameOf(rel, template?.title ?? "")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Invited by {rel.initiatorName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => claimInvite(rel.id)}
                    className="inline-flex h-11 shrink-0 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    Claim
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Your relationships</h2>
        {mine.length === 0 ? (
          <EmptyState
            title="No relationships yet"
            body="Claim an invitation to answer your first."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {mine.map((rel) => {
              const template = templates.find((t) => t.id === rel.templateId);
              const summary = gapSummary(rel);
              const yoursToAnswer = !rel.counterpartySubmitted && !summary.verdict;
              const readyToAccept = bothSubmittedOf(rel) && !summary.verdict;
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
                        {summary.verdict !== null
                          ? "Report unlocked"
                          : readyToAccept
                            ? "Review and accept"
                            : yoursToAnswer
                              ? "Yours to answer"
                              : "Awaiting the other party"}
                      </p>
                    </div>
                    <StageBadge stage={summary.stage} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
