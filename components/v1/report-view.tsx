// template-ancestor: components/assessment/assessment-report.tsx
"use client";

import { useV1Store } from "@/lib/v1/store";
import { LoadingState, NotFoundState } from "@/components/v1/v1-ui";
import { ReportBody } from "@/components/v1/report-body";

/** The report — the eight gap kinds, grouped, with the Setting's verdict on top. */
export function ReportView({ relationshipId }: { relationshipId: string }) {
  const { hydrated, relationships, templates } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const rel = relationships.find((candidate) => candidate.id === relationshipId);

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

  return <ReportBody rel={rel} templateTitle={template?.title ?? ""} />;
}
