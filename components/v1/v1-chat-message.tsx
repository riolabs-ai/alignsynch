"use client";

// template-ancestor: components/chat/chat-message.tsx   (variation: the bubble over a comment record — author avatar, body and a UTC clock time, aligned by party, with no image, no receipts and no tooltip)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { formatClockTime } from "@/content/core";
import { authorNameOf, type ChatMessage, type ChatThread } from "@/lib/v1/chat";
import { cn } from "@/lib/utils";

interface V1ChatMessageProps {
  message: ChatMessage;
  thread: ChatThread;
  isOwn: boolean;
}

export function V1ChatMessage({ message, thread, isOwn }: V1ChatMessageProps) {
  const authorName = authorNameOf(message.author, thread);

  return (
    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && <GeneratedAvatar name={authorName} seed={message.author} size={28} />}
      <div className="max-w-[75%]">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
            isOwn
              ? "rounded-tr-none bg-action text-action-foreground"
              : "rounded-tl-none bg-muted text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>
        <div
          className={cn(
            "mt-1 text-[10px] text-muted-foreground",
            isOwn ? "pr-1 text-right" : "pl-1",
          )}
        >
          {formatClockTime(message.at)}
        </div>
      </div>
    </div>
  );
}
