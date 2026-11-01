// template-ancestor: components/assessment-flow/instance-view.tsx
import { AcceptSession } from "@/components/v1/accept-session";

/** `/v1/relationships/[id]/accept` — the acceptance step, the closing event of a session. */
export default async function V1AcceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AcceptSession relationshipId={id} />;
}
