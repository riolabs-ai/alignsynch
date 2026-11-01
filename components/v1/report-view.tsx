// template-ancestor: components/assessment/assessment-report.tsx   (variation: four opinions per aspect with prediction-derived gaps)
"use client";

import { gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { BackLink, ContextLine, LoadingState, NotFoundState } from "@/components/v1/v1-ui";
import { ReportBody } from "@/components/v1/report-body";
import Link from "next/link";

/** The report — the eight gap kinds, grouped, with the Setting's verdict on top. */
export function ReportView({ relationshipId }: { relationshipId: string }) {
  const { hydrated, persona, relationships, templates } = useV1Store();

  const rel = relationships.find((candidate) => candidate.id === relationshipId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (rel === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No relationship with id "${relationshipId}" exists.`}
          back="/v1/initiator"
        />
      </div>
    );
  }

  const template = templates.find((t) => t.id === rel.templateId);
  const summary = gapSummary(rel);

  const name = relationshipNameOf(rel, template?.title ?? "");
  const viewer =
    persona === "initiator" ? "initiator" : persona === "counterparty" ? "counterparty" : null;
  const canStartNext = viewer === "initiator";
  const nextReady = summary.verdict !== null;
  const sessionLabel =
    rel.completedSessions === 0 ? "Report" : `Session ${rel.completedSessions} report`;

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-4xl space-y-2 p-4 pt-6 sm:px-8 sm:pt-8">
        <BackLink href={`/v1/relationships/${rel.id}`} label="Back to the relationship" />
        <ContextLine
          crumbs={[
            { label: "Relationships", href: "/v1/initiator/relationships" },
            { label: name, href: `/v1/relationships/${rel.id}` },
            { label: sessionLabel },
          ]}
        />
      </div>

      <ReportBody rel={rel} templateTitle={template?.title ?? ""} />

      <div className="mx-auto max-w-4xl p-4 pt-0 sm:px-8 sm:pb-8">
        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-semibold text-muted-foreground">What happens next</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/v1/relationships/${rel.id}`}
              className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Back to the relationship
            </Link>
            <Link
              href="/v1/initiator/relationships"
              className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              All relationships
            </Link>
            {canStartNext ? (
              nextReady ? (
                <Link
                  href={`/v1/relationships/${rel.id}/answer`}
                  className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                >
                  Start the next session
                </Link>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-11 cursor-not-allowed items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground opacity-50"
                  >
                    Start the next session
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Not time yet — both parties must submit before the next session can start.
                  </span>
                </span>
              )
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
