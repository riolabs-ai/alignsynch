"use client";

// template-ancestor: components/chat/chat-page.tsx   (variation: the two-pane page driven by the relationship store — a relationship thread plus one per Aspect, unread from the store, and a composer that persists across navigation)

import { useV1Store } from "@/lib/v1/store";
import { personaFromPathname, relationshipsVisibleTo } from "@/lib/v1/persona";
import { isBlindThread, threadsOf } from "@/lib/v1/chat";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { V1ChatThread } from "./v1-chat-thread";
import { V1ChatThreadList } from "./v1-chat-thread-list";

/**
 * The /v1 chat, filled in from the five `components/chat/` ancestors (#384). It is one component
 * for both routes: `/v1/[persona]/chat` (list, nothing open) and `/v1/[persona]/chat/[id]` (a
 * thread open). The conversation list is every thread the persona can see — one per relationship
 * plus one per Aspect — derived from `relationshipsVisibleTo` and `threadsOf`, never authored.
 * Unread comes from the store's read watermarks, and the composer writes through `sendChatMessage`
 * into the same `comments` / `aspectComments` the relationships card owns, so there is one
 * messaging system, not two.
 */
export function V1ChatPage({ threadId }: { threadId?: string }) {
  const store = useV1Store();
  const pathname = usePathname();
  const router = useRouter();
  const persona = personaFromPathname(pathname);

  const titlesById = useMemo(
    () => new Map(store.templates.map((template) => [template.id, template.title])),
    [store.templates],
  );

  const threads = useMemo(() => {
    if (persona === null) return [];
    return relationshipsVisibleTo(persona, store.relationships).flatMap((rel) =>
      threadsOf(rel, titlesById.get(rel.templateId) ?? rel.templateId),
    );
  }, [persona, store.relationships, titlesById]);

  // Opening a thread is reading it: the watermark moves to now, which clears the badge in the rail
  // and in the list. Arriving by URL does the same, so the count never disagrees with the thread on
  // screen. Declared before the persona guard so the hook order stays fixed.
  const openThreadId =
    persona !== null && threads.some((thread) => thread.id === threadId)
      ? (threadId ?? null)
      : null;
  const markThreadRead = store.markThreadRead;
  useEffect(() => {
    if (openThreadId === null || persona === null) return;
    markThreadRead(openThreadId, persona);
  }, [openThreadId, persona, markThreadRead]);

  if (persona === null) return null;

  const activeThread = threads.find((thread) => thread.id === threadId) ?? null;
  const activeRelationship =
    activeThread === null
      ? null
      : (store.relationships.find((rel) => rel.id === activeThread.relationshipId) ?? null);
  const blind = activeRelationship !== null && isBlindThread(activeRelationship);
  const readAt = store.threadReadAt[persona] ?? {};

  const selectThread = (id: string) => {
    store.markThreadRead(id, persona);
    router.push(`/v1/${persona}/chat/${id}`);
  };

  const send = (body: string) => {
    if (activeThread === null) return;
    const refusal = store.sendChatMessage(
      activeThread.relationshipId,
      activeThread.id,
      body,
      persona,
    );
    if (refusal !== null) {
      toast.error(refusal);
      return;
    }
    store.markThreadRead(activeThread.id, persona);
  };

  return (
    <div className="flex h-[calc(100vh-2.5rem)] overflow-hidden">
      <div
        className={cn(
          "w-full shrink-0 border-r md:w-72 xl:w-80",
          activeThread !== null ? "hidden md:block" : "",
        )}
      >
        <div className="border-b p-3">
          <h1 className="text-sm font-semibold">Conversations</h1>
        </div>
        <V1ChatThreadList
          threads={threads}
          activeThreadId={activeThread?.id ?? null}
          persona={persona}
          readAt={readAt}
          onSelect={selectThread}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {activeThread !== null ? (
          <>
            <Link
              href={`/v1/${persona}/chat`}
              className="flex items-center gap-1 border-b px-3 py-2 text-xs font-medium text-muted-foreground md:hidden"
            >
              Back to conversations
            </Link>
            <V1ChatThread thread={activeThread} persona={persona} onSend={send} blind={blind} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/20">
            <div className="mx-auto max-w-md p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-action/10">
                <MessageSquare className="h-6 w-6 text-action" />
              </div>
              <h2 className="text-lg font-medium">Select a conversation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                One thread per relationship, plus a thread per Aspect — pick one to read and reply.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
