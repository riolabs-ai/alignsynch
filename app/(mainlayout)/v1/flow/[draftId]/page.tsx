// template-ancestor: components/assessment-flow/instance-view.tsx
import { RelationshipFlow } from "@/components/v1/relationship-flow";

/** `/v1/flow/[draftId]` — the name → personalize → purchase → invite wizard, resumable. */
export default async function V1FlowPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  return <RelationshipFlow draftId={draftId} />;
}
