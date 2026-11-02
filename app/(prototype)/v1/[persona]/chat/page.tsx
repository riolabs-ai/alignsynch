// template-ancestor: components/chat/chat-page.tsx   (variation: the /v1 chat list — the persona's threads, rendered by V1ChatPage)
import { V1ChatPage } from "@/components/v1/v1-chat-page";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/chat` — the conversation list (every dashboard persona). */
export default async function ChatPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "chat")) notFound();
  return <V1ChatPage />;
}
