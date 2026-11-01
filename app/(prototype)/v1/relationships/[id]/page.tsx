// template-ancestor: components/assessment-flow/instance-view.tsx
import { RelationshipDetail } from "@/components/v1/relationship-detail";

/** `/v1/relationships/[id]` — the one screen every role opens a relationship from. */
export default async function V1RelationshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RelationshipDetail relationshipId={id} />;
}
