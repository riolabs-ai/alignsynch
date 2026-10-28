"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Send, ImageIcon, Smile, Search, Phone, Video, MoreVertical, Check, CheckCheck } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

// Mock data for contacts and messages
const contacts = [
  {
    id: 1,
    name: "Emma Wilson",
    avatar: "/avatars/chat-avatar-1.png",
    status: "online",
    lastMessage: "Are you ready for the science quiz?",
    unread: 2,
    lastSeen: "Just now",
  },
  {
    id: 2,
    name: "Michael Chen",
    avatar: "/avatars/chat-avatar-2.png",
    status: "online",
    lastMessage: "I scored 95% on the history quiz!",
    unread: 0,
    lastSeen: "5m ago",
  },
  {
    id: 3,
    name: "Sophia Rodriguez",
    avatar: "/avatars/chat-avatar-3.png",
    status: "offline",
    lastMessage: "Can you help me with the math questions?",
    unread: 0,
    lastSeen: "1h ago",
  },
  {
    id: 4,
    name: "James Johnson",
    avatar: "/avatars/chat-avatar-4.png",
    status: "online",
    lastMessage: "Let's create a quiz together",
    unread: 0,
    lastSeen: "30m ago",
  },
  {
    id: 5,
    name: "Olivia Parker",
    avatar: "/avatars/chat-avatar-5.png",
    status: "offline",
    lastMessage: "Thanks for the quiz tips!",
    unread: 0,
    lastSeen: "2h ago",
  },
]

const initialMessages = [
  {
    id: 1,
    contactId: 1,
    content: "Hey there! How's your quiz preparation going?",
    timestamp: "10:30 AM",
    isMe: false,
    status: "read",
  },
  {
    id: 2,
    contactId: 1,
    content: "I'm doing well! Just finished creating a new science quiz.",
    timestamp: "10:32 AM",
    isMe: true,
    status: "read",
  },
  {
    id: 3,
    contactId: 1,
    content: "That's awesome! Can I try it out?",
    timestamp: "10:33 AM",
    isMe: false,
    status: "read",
  },
  {
    id: 4,
    contactId: 1,
    content: "Of course! I'll share it with you once it's published.",
    timestamp: "10:35 AM",
    isMe: true,
    status: "read",
  },
  {
    id: 5,
    contactId: 1,
    content: "Are you ready for the science quiz?",
    timestamp: "10:40 AM",
    isMe: false,
    status: "delivered",
  },
]

interface ChatWindowProps {
  onClose: () => void
}

export function ChatWindow({ onClose }: ChatWindowProps) {
  const [activeContact, setActiveContact] = useState(contacts[0])
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter contacts based on search term
  const filteredContacts = contacts.filter((contact) => contact.name.toLowerCase().includes(searchTerm.toLowerCase()))

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Send a new message
  const handleSendMessage = () => {
    if (newMessage.trim() === "") return

    const newMsg = {
      id: messages.length + 1,
      contactId: activeContact.id,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
      status: "sent" as const,
    }

    setMessages([...messages, newMsg])
    setNewMessage("")

    // Simulate reply after 1-2 seconds
    setTimeout(
      () => {
        const reply = {
          id: messages.length + 2,
          contactId: activeContact.id,
          content: `Thanks for your message! This is an automated reply from ${activeContact.name}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isMe: false,
          status: "delivered" as const,
        }
        setMessages((prev) => [...prev, reply])
      },
      1000 + Math.random() * 1000,
    )
  }

  return (
    <div className="fixed right-4 top-16 z-50 flex h-[600px] w-[350px] flex-col rounded-lg border bg-background shadow-lg md:w-[400px]">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Chat Tabs */}
      <Tabs defaultValue="chats" className="flex-1">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        {/* Chats Tab */}
        <TabsContent value="chats" className="flex h-[calc(100%-40px)] flex-col">
          {/* Search */}
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Split view: Contacts list and active chat */}
          <div className="flex flex-1 overflow-hidden">
            {/* Contacts list */}
            <div className="w-1/3 border-r">
              <ScrollArea className="h-[460px]">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`cursor-pointer p-2 hover:bg-muted ${activeContact.id === contact.id ? "bg-muted" : ""}`}
                    onClick={() => setActiveContact(contact)}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar || "/placeholder.svg"} alt={contact.name} />
                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                          contact.status === "online" ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                    {contact.unread > 0 && (
                      <Badge className="absolute right-2 top-2" variant="destructive">
                        {contact.unread}
                      </Badge>
                    )}
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Active chat */}
            <div className="flex w-2/3 flex-col">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b p-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activeContact.avatar || "/placeholder.svg"} alt={activeContact.name} />
                    <AvatarFallback>{activeContact.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{activeContact.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {activeContact.status === "online" ? "Online" : activeContact.lastSeen}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {messages
                  .filter((msg) => msg.contactId === activeContact.id)
                  .map((message) => (
                    <div key={message.id} className={`mb-2 flex ${message.isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg p-2 ${
                          message.isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <div>{message.content}</div>
                        <div className="mt-1 flex items-center justify-end gap-1 text-xs opacity-70">
                          <span>{message.timestamp}</span>
                          {message.isMe && (
                            <>
                              {message.status === "sent" && <Check className="h-3 w-3" />}
                              {message.status === "delivered" && <Check className="h-3 w-3" />}
                              {message.status === "read" && <CheckCheck className="h-3 w-3" />}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Message input */}
              <div className="border-t p-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSendMessage()
                      }
                    }}
                  />
                  <Button size="icon" onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="h-[calc(100%-40px)]">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <ScrollArea className="h-[460px]">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 hover:bg-muted"
                onClick={() => {
                  setActiveContact(contact)
                  document
                    .querySelector('[data-value="chats"]')
                    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={contact.avatar || "/placeholder.svg"} alt={contact.name} />
                      <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                        contact.status === "online" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="font-medium">{contact.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {contact.status === "online" ? "Online" : contact.lastSeen}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Message
                </Button>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="h-[calc(100%-40px)] p-4">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Create a Group</h3>
            <p className="mb-4 text-muted-foreground">Start a group chat with your friends and quiz together</p>
            <Button>Create New Group</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Users icon component for the Groups tab
function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
