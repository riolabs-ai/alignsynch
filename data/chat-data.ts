import type { Contact, Conversation } from "@/components/chat/chat-page";

export const mockContacts: Contact[] = [
  {
    id: "contact-1",
    name: "Alex Johnson",
    avatar: "/avatars/alex.png",
    status: "online",
  },
  {
    id: "contact-2",
    name: "Sarah Williams",
    avatar: "/avatars/brain.png",
    status: "offline",
    lastSeen: "2 hours ago",
  },
  {
    id: "contact-3",
    name: "Michael Brown",
    avatar: "/avatars/champion.png",
    status: "online",
  },
  {
    id: "contact-4",
    name: "Emily Davis",
    avatar: "/avatars/genious.png",
    status: "away",
  },
  {
    id: "contact-5",
    name: "David Wilson",
    avatar: "/avatars/guru.png",
    status: "offline",
    lastSeen: "yesterday",
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    contactId: "contact-1",
    unread: 2,
    lastMessage: {
      text: "Hey, are you ready for the quiz tournament?",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    },
    messages: [
      {
        id: "msg-1-1",
        senderId: "contact-1",
        text: "Hi there! How's your quiz preparation going?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        status: "read",
      },
      {
        id: "msg-1-2",
        senderId: "current-user",
        text: "Pretty good! I've been studying a lot for the history section.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(), // 1.5 hours ago
        status: "read",
      },
      {
        id: "msg-1-3",
        senderId: "contact-1",
        text: "That's great! I'm focusing on science questions myself.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        status: "read",
      },
      {
        id: "msg-1-4",
        senderId: "current-user",
        text: "Nice! Maybe we can practice together sometime?",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        status: "read",
      },
      {
        id: "msg-1-5",
        senderId: "contact-1",
        text: "Definitely! How about tomorrow evening?",
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
        status: "delivered",
      },
      {
        id: "msg-1-6",
        senderId: "contact-1",
        text: "Hey, are you ready for the quiz tournament?",
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
        status: "delivered",
      },
    ],
  },
  {
    id: "conv-2",
    contactId: "contact-2",
    unread: 0,
    lastMessage: {
      text: "Thanks for your help with those tricky questions!",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    },
    messages: [
      {
        id: "msg-2-1",
        senderId: "current-user",
        text: "Hi Sarah, do you have any tips for the science quiz?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        status: "read",
      },
      {
        id: "msg-2-2",
        senderId: "contact-2",
        text: "Focus on the periodic table and basic physics formulas.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(), // 23 hours ago
        status: "read",
      },
      {
        id: "msg-2-3",
        senderId: "current-user",
        text: "That's really helpful, thank you!",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        status: "read",
      },
      {
        id: "msg-2-4",
        senderId: "contact-2",
        text: "No problem! Let me know if you need anything else.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3.5).toISOString(), // 3.5 hours ago
        status: "read",
      },
      {
        id: "msg-2-5",
        senderId: "current-user",
        text: "Will do! I'm struggling with some chemistry questions.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3.2).toISOString(), // 3.2 hours ago
        status: "read",
      },
      {
        id: "msg-2-6",
        senderId: "contact-2",
        text: "Thanks for your help with those tricky questions!",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        status: "read",
      },
    ],
  },
  {
    id: "conv-3",
    contactId: "contact-3",
    unread: 1,
    lastMessage: {
      text: "Don't forget about our team quiz tomorrow!",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    },
    messages: [
      {
        id: "msg-3-1",
        senderId: "contact-3",
        text: "Hey, are you joining the team quiz this weekend?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        status: "read",
      },
      {
        id: "msg-3-2",
        senderId: "current-user",
        text: "Yes, I'm definitely in! What time does it start?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        status: "read",
      },
      {
        id: "msg-3-3",
        senderId: "contact-3",
        text: "Great! It starts at 7 PM at the usual place.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        status: "read",
      },
      {
        id: "msg-3-4",
        senderId: "current-user",
        text: "Perfect, I'll be there!",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        status: "read",
      },
      {
        id: "msg-3-5",
        senderId: "contact-3",
        text: "Don't forget about our team quiz tomorrow!",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        status: "delivered",
      },
    ],
  },
  {
    id: "conv-4",
    contactId: "contact-4",
    unread: 0,
    lastMessage: {
      text: "I've shared some great quiz resources with you.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    },
    messages: [
      {
        id: "msg-4-1",
        senderId: "contact-4",
        text: "Hi there! I found some amazing quiz resources online.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        status: "read",
      },
      {
        id: "msg-4-2",
        senderId: "current-user",
        text: "That sounds great! Can you share them with me?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5).toISOString(), // 1.5 days ago
        status: "read",
      },
      {
        id: "msg-4-3",
        senderId: "contact-4",
        text: "Here's a link to a great quiz preparation site.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        status: "read",
      },
      {
        id: "msg-4-4",
        senderId: "contact-4",
        image: "/placeholder.svg?height=300&width=400",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(), // 23 hours ago
        status: "read",
      },
      {
        id: "msg-4-5",
        senderId: "current-user",
        text: "Thank you so much! This looks really helpful.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(), // 22 hours ago
        status: "read",
      },
      {
        id: "msg-4-6",
        senderId: "contact-4",
        text: "I've shared some great quiz resources with you.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
        status: "read",
      },
    ],
  },
  {
    id: "conv-5",
    contactId: "contact-5",
    unread: 3,
    lastMessage: {
      text: "Are you coming to the quiz meetup tonight?",
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
    },
    messages: [
      {
        id: "msg-5-1",
        senderId: "contact-5",
        text: "Hey! Long time no see. How have you been?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        status: "delivered",
      },
      {
        id: "msg-5-2",
        senderId: "contact-5",
        text: "We're organizing a quiz meetup tonight at the coffee shop.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(), // 1 hour ago
        status: "delivered",
      },
      {
        id: "msg-5-3",
        senderId: "contact-5",
        text: "Are you coming to the quiz meetup tonight?",
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
        status: "delivered",
      },
    ],
  },
];

export const recentMessages = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    sender: "Alex Johnson",
    avatar: "/avatars/alex.png",
    content: "Hey, are you ready for the quiz tournament?",
    time: "5m ago",
    unread: true,
  },
  {
    id: "msg-2",
    conversationId: "conv-3",
    sender: "Michael Brown",
    avatar: "/avatars/wizard.webp",
    content: "Don't forget about our team quiz tomorrow!",
    time: "30m ago",
    unread: true,
  },
  {
    id: "msg-3",
    conversationId: "conv-2",
    sender: "Sarah Williams",
    avatar: "/avatars/sarah.webp",
    content: "Thanks for your help with those tricky questions!",
    time: "3h ago",
    unread: false,
  },
  {
    id: "msg-4",
    conversationId: "conv-4",
    sender: "Emily Davis",
    avatar: "/avatars/brain.png",
    content: "I've shared some great quiz resources with you.",
    time: "12h ago",
    unread: false,
  },
  {
    id: "msg-5",
    conversationId: "conv-5",
    sender: "David Wilson",
    avatar: "/avatars/guru.png",
    content: "Are you coming to the quiz meetup tonight?",
    time: "15h ago",
    unread: false,
  },
];
