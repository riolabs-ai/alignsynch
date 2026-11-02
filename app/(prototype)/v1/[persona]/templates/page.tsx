// template-ancestor: components/explore/explore-quiz-list.tsx
import { RelationshipLibrary } from "@/components/v1/relationship-library";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/templates` — the initiator's library (admin reads it too). */
export default async function TemplatesPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "templates")) notFound();
  return <RelationshipLibrary />;
}
