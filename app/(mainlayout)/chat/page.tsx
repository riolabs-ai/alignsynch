import { ChatPage } from "@/components/chat/chat-page";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat",
};

/**
 * `/chat` — the quiz product's conversations (`data/chat-data.ts`).
 *
 * Quiz-only (#300): the alignment build answers 404, and the header's messages drawer already
 * shows that brand no conversations, so there is no entry point left pointing here. The route is
 * gated, not removed: chat is one of the surfaces the catalogue keeps.
 */
export default function Page() {
  requireQuizProduct();
  return <ChatPage />;
}
