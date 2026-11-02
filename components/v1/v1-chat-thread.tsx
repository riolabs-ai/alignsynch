"use client";

// template-ancestor: components/chat/chat-conversation.tsx   (variation: the thread pane over store comments — a title bar, day-grouped bubbles and a composer, with no presence, call or profile chrome)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDayHeading, formatDayKey } from "@/content/core";
import {
  BLIND_THREAD_NOTICE,
  authorRoleOf,
  canSendInThread,
  otherPartyNameOf,
  type ChatMessage,
  type ChatThread,
} from "@/lib/v1/chat";
import type { Persona } from "@/data/v1/fixtures";
import { Lock } from "lucide-react";
import { useEffect, useRef } from "react";
import { V1ChatInput } from "./v1-chat-input";
import { V1ChatMessage } from "./v1-chat-message";

interface V1ChatThreadProps {
  thread: ChatThread;
  persona: Persona;
  onSend: (body: string) => void;
  /** True while the session is unscored — the blind notice is rendered above the messages. */
  blind: boolean;
}

interface DayGroup {
  dayKey: string;
  label: string;
  messages: ChatMessage[];
}

function groupByDay(messages: readonly ChatMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const dayKey = formatDayKey(message.at);
    const group = groups.find((candidate) => candidate.dayKey === dayKey);
    if (group !== undefined) {
      group.messages.push(message);
    } else {
      groups.push({ dayKey, label: formatDayHeading(message.at), messages: [message] });
    }
  }
  return groups;
}

export function V1ChatThread({ thread, persona, onSend, blind }: V1ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read the message list inside the effect so the dependency is the list itself: a new message
    // re-scrolls to the tail, and nothing else does.
    if (thread.messages.length === 0) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages]);

  const role = authorRoleOf(persona);
  const canSend = canSendInThread(persona, thread);
  const groups = groupByDay(thread.messages);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b p-3">
        <GeneratedAvatar name={thread.title} seed={thread.id} size={36} />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{thread.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {thread.kind === "aspect"
              ? `Aspect · ${thread.subtitle}`
              : otherPartyNameOf(persona, thread)}
          </p>
        </div>
      </header>

      {blind && (
        <p
          data-blind="true"
          className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{BLIND_THREAD_NOTICE}</span>
        </p>
      )}

      <ScrollArea className="flex-1 bg-muted/20 p-4">
        {thread.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.dayKey} className="space-y-3">
                <div className="flex justify-center">
                  <span className="rounded-full bg-muted/80 px-3 py-1 text-xs text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                {group.messages.map((message) => (
                  <V1ChatMessage
                    key={message.id}
                    message={message}
                    thread={thread}
                    isOwn={role !== null && message.author === role}
                  />
                ))}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      {canSend && (
        <div className="border-t p-3">
          <V1ChatInput onSend={onSend} />
        </div>
      )}
    </div>
  );
}
