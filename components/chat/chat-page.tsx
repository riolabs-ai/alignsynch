"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockContacts, mockConversations } from "@/data/chat-data";
import { Bell, Lock, Plus, Search, Settings, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ChatConversation } from "./chat-conversation";
import { ChatSidebar } from "./chat-sidebar";
import { SimpleDropdown, SimpleDropdownItem, SimpleDropdownLabel, SimpleDropdownSeparator } from "./simple-dropdown";

export type Contact = {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "offline" | "away";
  lastSeen?: string;
};

export type Message = {
  id: string;
  senderId: string;
  text?: string;
  image?: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
};

export type Conversation = {
  id: string;
  contactId: string;
  messages: Message[];
  unread: number;
  lastMessage?: {
    text: string;
    timestamp: string;
  };
};

export function ChatPage() {
  const [contacts, setContacts] = useState(mockContacts);
  const [conversations, setConversations] = useState(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversations.length > 0 ? conversations[0].id : null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showChat, setShowChat] = useState(false);
  const activeConversation = conversations.find((conv) => conv.id === activeConversationId) || null;
  const activeContact = activeConversation ? contacts.find((contact) => contact.id === activeConversation.contactId) : null;

  const filteredContacts = contacts.filter((contact) => contact.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSendMessage = (text: string) => {
    if (!activeConversationId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: "current-user", // Assuming current user has this ID
      text,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            lastMessage: {
              text,
              timestamp: new Date().toISOString(),
            },
          };
        }
        return conv;
      })
    );

    // Simulate reply after 1-3 seconds
    setTimeout(() => {
      const replyMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        senderId: activeConversation?.contactId || "",
        text: `This is an automated reply to: "${text}"`,
        timestamp: new Date().toISOString(),
        status: "read",
      };

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === activeConversationId) {
            return {
              ...conv,
              messages: [...conv.messages, replyMessage],
              lastMessage: {
                text: replyMessage.text || "",
                timestamp: replyMessage.timestamp,
              },
            };
          }
          return conv;
        })
      );
    }, Math.random() * 2000 + 1000);
  };

  const handleSendImage = (imageUrl: string) => {
    if (!activeConversationId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: "current-user",
      image: imageUrl,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            lastMessage: {
              text: "Sent an image",
              timestamp: new Date().toISOString(),
            },
          };
        }
        return conv;
      })
    );
  };

  const handleConversationSelect = (conversationId: string) => {
    setActiveConversationId(conversationId);

    // Mark conversation as read
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            unread: 0,
            messages: conv.messages.map((msg) => ({
              ...msg,
              status: msg.senderId !== "current-user" ? "read" : msg.status,
            })),
          };
        }
        return conv;
      })
    );
  };

  const handleNewConversation = (contactId: string) => {
    // Create a new conversation with the selected contact
    const newConversation: Conversation = {
      id: `conv-${Date.now()}`,
      contactId,
      messages: [],
      unread: 0,
    };

    // Add the new conversation to the list
    const updatedConversations = [...conversations, newConversation];
    setConversations(updatedConversations);

    // Set the new conversation as active
    setActiveConversationId(newConversation.id);
  };

  return (
    <div className="md:flex h-[calc(100vh-4rem)] overflow-y-auto bg-background">
      <button onClick={() => setShowChat(!showChat)} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md md:hidden">
        Open Chat
      </button>
      <div className={`w-72 duration-300 xl:w-80 border-r flex flex-col max-md:absolute max-md:top-32 max-md:border-t max-md: left-0 max-md:h-full max-md:z-10 max-md:bg-background ${showChat ? "max-md:translate-x-0" : "max-md:-translate-x-full"}`}>
        <div className="p-4 border-b flex items-center justify-between ">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search contacts..." className="pl-8 rounded-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="ml-2">
            <SimpleDropdown
              trigger={
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-muted">
                  <Settings className="h-4 w-4" />
                </Button>
              }
              align="right"
            >
              <SimpleDropdownLabel>Chat Settings</SimpleDropdownLabel>
              <SimpleDropdownSeparator />
              <SimpleDropdownItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </SimpleDropdownItem>
              <SimpleDropdownItem>
                <Bell className="mr-2 h-4 w-4" />
                <span>Notifications</span>
              </SimpleDropdownItem>
              <SimpleDropdownItem>
                <Lock className="mr-2 h-4 w-4" />
                <span>Privacy</span>
              </SimpleDropdownItem>
              <SimpleDropdownSeparator />
              <SimpleDropdownItem destructive>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Clear History</span>
              </SimpleDropdownItem>
            </SimpleDropdown>
          </div>
        </div>
        <ChatSidebar contacts={filteredContacts} conversations={conversations} activeConversationId={activeConversationId} onConversationSelect={handleConversationSelect} onNewConversation={handleNewConversation} />
      </div>

      <div className="flex-1 flex flex-col">
        {activeConversation && activeContact ? (
          <ChatConversation conversation={activeConversation} contact={activeContact} onSendMessage={handleSendMessage} onSendImage={handleSendImage} />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/20">
            <div className="text-center max-w-md p-6 rounded-lg bg-background shadow-sm border">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">Start a conversation</h3>
              <p className="text-muted-foreground mb-4">Select a contact from the sidebar or start a new chat to begin messaging</p>
              <Button
                onClick={() => {
                  const availableContact = contacts.find((contact) => !conversations.some((conv) => conv.contactId === contact.id));
                  if (availableContact) {
                    handleNewConversation(availableContact.id);
                  } else {
                    toast.success("No available contacts to start a new conversation with.");
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New conversation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
