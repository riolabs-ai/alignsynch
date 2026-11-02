// template-ancestor: components/my-quizzes/quiz-details.tsx
import { PersonaRelationshipDetail } from "@/components/v1/persona-relationship-detail";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/relationships/[id]` — one relationship the persona can see. */
export default async function RelationshipDetailPage({
  params,
}: {
  params: Promise<{ persona: string; id: string }>;
}) {
  const { persona, id } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "relationships")) notFound();
  return <PersonaRelationshipDetail persona={persona} relationshipId={id} />;
}
