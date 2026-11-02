// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/chat/[id]` — the chat thread stub (every dashboard persona). */
export default async function ChatThreadStubPage({
  params,
}: {
  params: Promise<{ persona: string; id: string }>;
}) {
  const { persona, id } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "chat")) notFound();
  return (
    <SectionStub section="Chat" persona={persona} summary={SECTION_SUMMARIES.chat} detail={id} />
  );
}
