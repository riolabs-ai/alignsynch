"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HelpCircle, MessageSquare, BookOpen } from "lucide-react"

interface SupportHeaderProps {
  activeTab: "faq" | "contact" | "knowledge"
  setActiveTab: (tab: "faq" | "contact" | "knowledge") => void
}

export function SupportHeader({ activeTab, setActiveTab }: SupportHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Support Center</h1>
        <p className="text-muted-foreground mt-2">
          Find answers to common questions or get in touch with our support team
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "faq" | "contact" | "knowledge")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="faq" className="flex items-center">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Frequently Asked Questions</span>
            <span className="sm:hidden">FAQs</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Contact Support</span>
            <span className="sm:hidden">Contact</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center">
            <BookOpen className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Knowledge Base</span>
            <span className="sm:hidden">Articles</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
