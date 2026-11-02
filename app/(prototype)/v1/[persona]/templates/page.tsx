// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/templates` — the template library stub (initiator/admin only). */
export default async function TemplatesStubPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "templates")) notFound();
  return (
    <SectionStub section="Templates" persona={persona} summary={SECTION_SUMMARIES.templates} />
  );
}
