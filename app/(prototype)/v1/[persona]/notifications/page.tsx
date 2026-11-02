// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/notifications` — the notifications stub (every dashboard persona). */
export default async function NotificationsStubPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "notifications")) notFound();
  return (
    <SectionStub
      section="Notifications"
      persona={persona}
      summary={SECTION_SUMMARIES.notifications}
    />
  );
}
