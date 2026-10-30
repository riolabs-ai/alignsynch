"use client";

import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { useState } from "react";
import type { Message } from "./chat-page";
import { formatClockTime, formatDateTimeLong } from "@/content/core";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: Message;
  isOwn: boolean;
  contactName: string;
  contactSeed: string;
}

export function ChatMessage({ message, isOwn, contactName, contactSeed }: ChatMessageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  /** The registry entry behind a shared image; `undefined` means the slot draws its own. */
  const sharedEntry = entryOf(message.image);

  const formatTime = (timestamp: string) => {
    return formatClockTime(timestamp);
  };

  const formatFullTime = (timestamp: string) => {
    return formatDateTimeLong(timestamp);
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "sent":
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
      case "delivered":
        return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3.5 w-3.5 text-primary" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex items-end gap-2 group", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && (
        <div className="flex-shrink-0">
          <div className="relative w-7 h-7">
            <Media
              alt={contactName}
              height={28}
              kind={FALLBACK_KIND.avatar}
              seed={contactSeed}
              width={28}
            />
          </div>
        </div>
      )}
      <div className="max-w-[75%]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 shadow-sm",
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted text-foreground rounded-tl-none",
                )}
              >
                {message.text && (
                  <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                )}
                {message.image && (
                  <div className="relative mt-1 overflow-hidden rounded-lg">
                    {/* The overlay is for bytes that are on their way. A generated default
                        has nothing to load and paints immediately, so it never spins. */}
                    {sharedEntry !== undefined && (
                      <div
                        className={cn(
                          "absolute inset-0 flex items-center justify-center bg-muted/50 z-10",
                          imageLoaded ? "hidden" : "block",
                        )}
                      >
                        <span className="text-xs">Loading image...</span>
                      </div>
                    )}
                    <Media
                      alt="Shared image"
                      className="rounded-lg max-w-full object-contain"
                      entry={sharedEntry}
                      height={200}
                      kind={FALLBACK_KIND.illustration}
                      onLoad={() => setImageLoaded(true)}
                      seed={message.id}
                      width={300}
                    />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side={isOwn ? "left" : "right"} className="max-w-xs">
              <p>{formatFullTime(message.timestamp)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-[10px]",
            isOwn ? "justify-end pr-1" : "justify-start pl-1",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isOwn && renderStatus(message.status)}
        </div>
      </div>
    </div>
  );
}
