"use client";
import { AffiliateDashboard } from "@/components/dashboard/affiliate-dashboard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { MyQuizzesDashboard } from "@/components/dashboard/my-quizzes-dashboard";
import { SettingsDashboard } from "@/components/dashboard/settings-dashboard";
import { WalletDashboard } from "@/components/dashboard/wallet-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * The prototype dashboard shell. **No route mounts it today**: `/dashboard/user` served this
 * until #164 replaced it with the session-backed `AccountHome`, and the panes stayed as a
 * catalogue asset.
 *
 * `hiddenNav` is a required prop for the same reason `Footer`'s is: the one link in here that
 * points at a gated route — the affiliate tab's CTA to `/affiliate`, which answers 404 while
 * `commerce.affiliate` is off (#291) — must be decided by the shell's list, not by a second check
 * written in this file. Required, with no default, so a route that mounts this later cannot draw
 * the CTA without resolving the flags first.
 */
export function DashboardPage({ hiddenNav }: { hiddenNav: readonly string[] }) {
  const tab = useSearchParams().get("tab");
  const [activeTab, setActiveTab] = useState(tab || "overview");

  return (
    <div className="flex flex-col space-y-6">
      <DashboardHeader activeTab={activeTab} />

      <Tabs defaultValue={activeTab} className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="flex gap-4 overflow-x-auto md:grid md:grid-cols-5 w-full max-w-4xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="my-quizzes">My Quizzes</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="my-quizzes" className="space-y-6">
          <MyQuizzesDashboard />
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
          <WalletDashboard />
        </TabsContent>

        <TabsContent value="affiliate" className="space-y-6">
          <AffiliateDashboard hiddenNav={hiddenNav} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
