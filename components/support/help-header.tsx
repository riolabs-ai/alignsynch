"use client";

// template-ancestor: components/ui/tabs.tsx   (variation: the help band — a hand-written title and description above two tabs over the hub's two answer panels)

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { BookOpen, HelpCircle } from "lucide-react";

/** The two panels `/help` offers. There is deliberately no third: contact lives in the app. */
export type HelpTab = "faq" | "knowledge";

interface HelpHeaderProps {
  activeTab: HelpTab;
  setActiveTab: (tab: HelpTab) => void;
  copy: PageCopy;
}

/**
 * The public help centre's hero: the route's `h1`/`subtitle`, then the two-tab band under them.
 *
 * **Two tabs, not three.** The old `/support` hub had a Contact tab beside these two, and the tab
 * opened a form that could not send. The owner's split removed the tab rather than leaving a dead
 * one behind: `/help` is answers, and the way to a person is the account page in the app — the
 * band at the foot of the page says so and links to it.
 */
export function HelpHeader({ activeTab, setActiveTab, copy }: HelpHeaderProps) {
  const tabs = sectionOf(copy, "help-tabs");
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as HelpTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="faq" className="flex items-center">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{itemLabel(tabs, "tab-faq")}</span>
            <span className="sm:hidden">{itemLabel(tabs, "tab-faq-short")}</span>
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
