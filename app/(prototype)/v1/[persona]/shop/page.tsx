// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/shop` — the shop stub (initiator only). */
export default async function ShopStubPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "shop")) notFound();
  return <SectionStub section="Shop" persona={persona} summary={SECTION_SUMMARIES.shop} />;
}
