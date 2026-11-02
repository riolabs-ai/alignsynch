// template-ancestor: components/my-quizzes/my-quizzes.tsx
import { RelationshipsList } from "@/components/v1/relationships-list";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/relationships` — the persona's relationships, status-led. */
export default async function RelationshipsPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "relationships")) notFound();
  return <RelationshipsList persona={persona} />;
}
