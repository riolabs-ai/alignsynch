// template-ancestor: components/chat/chat-conversation.tsx   (variation: the /v1 chat thread — one relationship or Aspect thread open, rendered by V1ChatPage)
import { V1ChatPage } from "@/components/v1/v1-chat-page";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/chat/[id]` — one relationship or Aspect thread (every dashboard persona). */
export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ persona: string; id: string }>;
}) {
  const { persona, id } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "chat")) notFound();
  return <V1ChatPage threadId={id} />;
}
