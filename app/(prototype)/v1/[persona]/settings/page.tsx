// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/settings` — the settings stub (every dashboard persona). */
export default async function SettingsStubPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "settings")) notFound();
  return <SectionStub section="Settings" persona={persona} summary={SECTION_SUMMARIES.settings} />;
}
