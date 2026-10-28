"use client";
// Import cn function
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Archive, Info, MoreVertical, Phone, Search, Trash2, UserPlus, Video } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import type { Contact, Conversation, Message } from "./chat-page";

interface ChatConversationProps {
  conversation: Conversation;
  contact: Contact;
  onSendMessage: (text: string) => void;
  onSendImage: (imageUrl: string) => void;
}

export function ChatConversation({ conversation, contact, onSendMessage, onSendImage }: ChatConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "online":
        return "Online";
      case "away":
        return "Away";
      default:
        return contact.lastSeen ? `Last seen ${contact.lastSeen}` : "Offline";
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toLocaleDateString();
      const existingGroup = groups.find((group) => group.date === messageDate);

      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({ date: messageDate, messages: [message] });
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(conversation.messages);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center">
          <div className="relative">
            <Image src={avatarError ? "/placeholder.svg?height=40&width=40" : contact.avatar} alt={contact.name} width={40} height={40} className="rounded-full object-cover" onError={() => setAvatarError(true)} />
            <span className={cn("absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background", getStatusColor(contact.status))} />
          </div>
          <div className="ml-3">
            <h3 className="font-medium">{contact.name}</h3>
            <p className="text-xs text-muted-foreground">{getStatusText(contact.status)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                  <Phone className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice call</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                  <Video className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Video call</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                  <Search className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search in conversation</TooltipContent>
            </Tooltip>
          </TooltipProvider>      
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreVertical className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem className="flex items-center gap-2">
                <UserPlus className="size-4" />
                <span>Add to group</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Info className="size-4" />
                <span>View profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Archive className="size-4" />
                <span>Archive chat</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Trash2 className="size-4" />
                <span>Delete chat</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-muted/30 to-background">
        <div className="space-y-6">
          {messageGroups.map((group, index) => (
            <div key={index} className="space-y-4">
              <div className="flex justify-center">
                <span className="text-xs bg-muted/80 px-3 py-1 rounded-full text-muted-foreground font-medium shadow-sm">{formatDate(group.date)}</span>
              </div>
              {group.messages.map((message) => (
                <ChatMessage key={message.id} message={message} isOwn={message.senderId === "current-user"} contactName={contact.name} contactAvatar={contact.avatar} />
              ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput onSendMessage={onSendMessage} onSendImage={onSendImage} />
      </div>
    </div>
  );
}
