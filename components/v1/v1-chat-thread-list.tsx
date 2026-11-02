"use client";

// template-ancestor: components/chat/chat-sidebar.tsx   (variation: the list as a relationship rail — one relationship thread then its per-Aspect threads, each with a store-derived unread badge, no contacts or presence)

import { Badge } from "@/components/ui/badge";
import { canSendInThread, unreadCountOf, type ChatThread } from "@/lib/v1/chat";
import { cn } from "@/lib/utils";
import { dayDelta, formatClockTime, formatMonthDay, formatWeekdayShort } from "@/content/core";
import { Lock, MessageSquare, Users } from "lucide-react";
import type { Persona } from "@/data/v1/fixtures";

interface V1ChatThreadListProps {
  threads: readonly ChatThread[];
  activeThreadId: string | null;
  persona: Persona;
  readAt: Readonly<Record<string, string>>;
  onSelect: (threadId: string) => void;
}

/** Same tiers as the quiz sidebar's: clock time, "Yesterday", weekday, "Mon D". */
function formatTime(timestamp: string): string {
  const days = dayDelta(timestamp);
  if (days === 0) return formatClockTime(timestamp);
  if (days === 1) return "Yesterday";
  if (days < 7) return formatWeekdayShort(timestamp);
  return formatMonthDay(timestamp);
}

export function V1ChatThreadList({
  threads,
  activeThreadId,
  persona,
  readAt,
  onSelect,
}: V1ChatThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No conversations yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {threads.map((thread) => {
        const unread = unreadCountOf(thread, persona, readAt[thread.id]);
        const active = activeThreadId === thread.id;
        const lastMessage = thread.messages.at(-1);
        // The admin reads every thread but writes in none, and the coach writes only on the
        // relationship thread — the row says so rather than offering a composer that would refuse.
        const readOnly = !canSendInThread(persona, thread);

        return (
          <button
            key={thread.id}
            type="button"
            data-thread={thread.id}
            data-kind={thread.kind}
            data-unread={unread}
            onClick={() => onSelect(thread.id)}
            className={cn(
              "flex w-full items-start gap-3 p-3 text-left transition-colors",
              active ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
              unread > 0 && !active ? "bg-muted/30" : "",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                thread.kind === "aspect"
                  ? "bg-muted text-muted-foreground"
                  : "bg-action/10 text-action",
              )}
            >
              {thread.kind === "aspect" ? (
                <MessageSquare className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    unread > 0 && !active ? "font-semibold" : "",
                  )}
                >
                  {thread.title}
                </span>
                {readOnly && (
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="read only" />
                )}
                {lastMessage !== undefined && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTime(lastMessage.at)}
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-xs",
                    active ? "text-accent-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {lastMessage !== undefined
                    ? lastMessage.body
                    : thread.kind === "aspect"
                      ? `Aspect · ${thread.subtitle}`
                      : "Relationship thread"}
                </span>
                {unread > 0 && (
                  <Badge
                    variant="default"
                    className="ml-1 h-5 min-w-[20px] shrink-0 rounded-full px-1.5"
                  >
                    {unread}
                  </Badge>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
