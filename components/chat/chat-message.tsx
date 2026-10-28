"use client"

import { useState } from "react"
import Image from "next/image"
import type { Message } from "./chat-page"
import { Check, CheckCheck, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ChatMessageProps {
  message: Message
  isOwn: boolean
  contactName: string
  contactAvatar: string
}

export function ChatMessage({ message, isOwn, contactName, contactAvatar }: ChatMessageProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatFullTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const renderStatus = (status: string) => {
    switch (status) {
      case "sent":
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      case "delivered":
        return <Check className="h-3.5 w-3.5 text-muted-foreground" />
      case "read":
        return <CheckCheck className="h-3.5 w-3.5 text-primary" />
      default:
        return null
    }
  }

  return (
    <div className={cn("flex items-end gap-2 group", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && (
        <div className="flex-shrink-0">
          <div className="relative w-7 h-7">
            <Image
              src={imageError ? "/placeholder.svg?height=28&width=28" : contactAvatar}
              alt={contactName}
              width={28}
              height={28}
              className="rounded-full object-cover mb-1 border border-border"
              onError={() => setImageError(true)}
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
                {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
                {message.image && (
                  <div className="relative mt-1 overflow-hidden rounded-lg">
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center bg-muted/50 z-10",
                        imageLoaded ? "hidden" : "block",
                      )}
                    >
                      <span className="text-xs">Loading image...</span>
                    </div>
                    <Image
                      src={message.image || "/placeholder.svg"}
                      alt="Shared image"
                      width={300}
                      height={200}
                      className="rounded-lg max-w-full object-contain"
                      onLoad={() => setImageLoaded(true)}
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
  )
}
