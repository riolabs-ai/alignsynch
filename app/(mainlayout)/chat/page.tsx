import { ChatPage } from "@/components/chat/chat-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat",
};

export default function Page() {
  return <ChatPage />;
}
