// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/relationships/[id]` — the relationship detail stub (every dashboard persona). */
export default async function RelationshipStubPage({
  params,
}: {
  params: Promise<{ persona: string; id: string }>;
}) {
  const { persona, id } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "relationships")) notFound();
  return (
    <SectionStub
      section="Relationship"
      persona={persona}
      summary={SECTION_SUMMARIES.relationships}
      detail={id}
    />
  );
}
