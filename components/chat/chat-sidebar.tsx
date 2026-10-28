"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Contact, Conversation } from "./chat-page";

interface ChatSidebarProps {
  contacts: Contact[];
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation?: (contactId: string) => void;
}
type Filter = "all" | "online" | "unread";
export function ChatSidebar({ contacts, conversations, activeConversationId, onConversationSelect, onNewConversation }: ChatSidebarProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const [searchContactQuery, setSearchContactQuery] = useState("");

  const getFilteredConversations = () => {
    let filtered = [...conversations];

    if (filter === "online") {
      filtered = filtered.filter((conv) => {
        const contact = contacts.find((c) => c.id === conv.contactId);
        return contact && contact.status === "online";
      });
    } else if (filter === "unread") {
      filtered = filtered.filter((conv) => conv.unread > 0);
    }

    return filtered;
  };

  const filteredConversations = getFilteredConversations();

  // Get contacts that don't have an existing conversation
  const availableContacts = contacts.filter((contact) => !conversations.some((conv) => conv.contactId === contact.id)).filter((contact) => contact.name.toLowerCase().includes(searchContactQuery.toLowerCase()));

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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const handleNewConversation = (contactId: string) => {
    if (onNewConversation) {
      onNewConversation(contactId);
      setIsNewConversationDialogOpen(false);
      setSearchContactQuery("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all" className="rounded-full">
              All
            </TabsTrigger>
            <TabsTrigger value="online" className="rounded-full">
              Online
            </TabsTrigger>
            <TabsTrigger value="unread" className="rounded-full">
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-medium text-sm">Conversations</h3>
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setIsNewConversationDialogOpen(true)} aria-label="New conversation">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length > 0 ? (
          <div>
            {filteredConversations.map((conversation) => {
              const contact = contacts.find((c) => c.id === conversation.contactId);
              if (!contact) return null;

              return (
                <div key={conversation.id} className={cn("flex items-center p-3 cursor-pointer transition-colors", activeConversationId === conversation.id ? "bg-accent text-accent-foreground" : "hover:bg-muted/50", conversation.unread > 0 && activeConversationId !== conversation.id ? "bg-muted/30" : "")} onClick={() => onConversationSelect(conversation.id)}>
                  <div className="relative flex-shrink-0">
                    <Image src={imageErrors[contact.id] ? "/placeholder.svg?height=48&width=48" : contact.avatar} alt={contact.name} width={48} height={48} className="rounded-full object-cover border border-border" onError={() => setImageErrors((prev) => ({ ...prev, [contact.id]: true }))} />
                    <span className={cn("absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background", getStatusColor(contact.status))} />
                  </div>
                  <div className="ml-3 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h4 className={cn("font-medium truncate", conversation.unread > 0 && activeConversationId !== conversation.id ? "font-semibold" : "")}>{contact.name}</h4>
                      {conversation.lastMessage && <span className="text-xs text-muted-foreground">{formatTime(conversation.lastMessage.timestamp)}</span>}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      {conversation.lastMessage && <p className={cn("text-sm truncate max-w-[160px]", activeConversationId === conversation.id ? "text-accent-foreground/80" : "text-muted-foreground", conversation.unread > 0 && activeConversationId !== conversation.id ? "font-medium text-foreground" : "")}>{conversation.lastMessage.text}</p>}
                      {conversation.unread > 0 && (
                        <Badge variant="default" className="ml-2 rounded-full px-1.5 min-w-[20px] h-5">
                          {conversation.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            <p>No conversations found</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setIsNewConversationDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Start new chat
            </Button>
          </div>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={isNewConversationDialogOpen} onOpenChange={setIsNewConversationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search contacts..." className="pl-8" value={searchContactQuery} onChange={(e) => setSearchContactQuery(e.target.value)} />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {availableContacts.length > 0 ? (
                availableContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => handleNewConversation(contact.id)}>
                    <div className="relative">
                      <Image src={imageErrors[contact.id] ? "/placeholder.svg?height=40&width=40" : contact.avatar} alt={contact.name} width={40} height={40} className="rounded-full object-cover" onError={() => setImageErrors((prev) => ({ ...prev, [contact.id]: true }))} />
                      <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background", getStatusColor(contact.status))} />
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.status === "online" ? "Online" : contact.lastSeen ? `Last seen ${contact.lastSeen}` : "Offline"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No contacts available</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewConversationDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
