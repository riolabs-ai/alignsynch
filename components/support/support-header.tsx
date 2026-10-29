"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { HelpCircle, MessageSquare, BookOpen } from "lucide-react";

interface SupportHeaderProps {
  activeTab: "faq" | "contact" | "knowledge";
  setActiveTab: (tab: "faq" | "contact" | "knowledge") => void;
  copy: PageCopy;
}

/** The hub's hero: the route's `h1`/`subtitle`, then the tab band under them. */
export function SupportHeader({ activeTab, setActiveTab, copy }: SupportHeaderProps) {
  const tabs = sectionOf(copy, "support-tabs");
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        <p className="text-muted-foreground mt-2">{copy.subtitle}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "faq" | "contact" | "knowledge")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="faq" className="flex items-center">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{tabs.heading}</span>
            <span className="sm:hidden">{itemLabel(tabs, "tab-faq-short")}</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{itemLabel(tabs, "tab-contact")}</span>
            <span className="sm:hidden">{itemLabel(tabs, "tab-contact-short")}</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center">
            <BookOpen className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{itemLabel(tabs, "tab-knowledge")}</span>
            <span className="sm:hidden">{itemLabel(tabs, "tab-knowledge-short")}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
