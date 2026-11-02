// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/relationships` — the relationships list stub (every dashboard persona). */
export default async function RelationshipsStubPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "relationships")) notFound();
  return (
    <SectionStub
      section="Relationships"
      persona={persona}
      summary={SECTION_SUMMARIES.relationships}
    />
  );
}
