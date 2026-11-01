// template-ancestor: components/assessment/assessment-report.tsx
import { ReportView } from "@/components/v1/report-view";

/** `/v1/relationships/[id]/report` — the report. */
export default async function V1ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportView relationshipId={id} />;
}
