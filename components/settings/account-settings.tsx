"use client";

// template-ancestor: components/ui/page-header.tsx   (variation: the settings page — the page header primitive, then tabs over eight panels)

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "./profile-settings";
import { SecuritySettings } from "./security-settings";
import { NotificationSettings } from "./notification-settings";
import { PrivacySettings } from "./privacy-settings";
import { AppearanceSettings } from "./appearance-settings";
import { QuizPreferences } from "./quiz-preferences";
import { ConnectedAccounts } from "./connected-accounts";
import { SubscriptionSettings } from "./subscription-settings";
import { PageHeader } from "../ui/page-header";
import type { ShellAccount } from "@/lib/auth/shell-account";

/**
 * The settings tab shell. `account` is threaded through rather than resolved here for the reason
 * the identity panels all share (#226): a client component cannot read the session, so the one
 * identity the panels are allowed to name arrives as a prop from the server that resolved it. It
 * is required, which is what stops the "Connected Accounts" panel from falling back to a fixture
 * when a caller forgets — the compiler has no fixture to offer instead.
 */
export function AccountSettings({ account }: { account: ShellAccount }) {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="container mx-auto">
      <PageHeader
        title="Account Settings"
        description="Manage your account settings and preferences"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-8">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="quiz">Quiz Preferences</TabsTrigger>
          <TabsTrigger value="connected">Connected Accounts</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        <div className="bg-card rounded-lg border shadow-sm p-6">
          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="privacy">
            <PrivacySettings />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="quiz">
            <QuizPreferences />
          </TabsContent>

          <TabsContent value="connected">
            <ConnectedAccounts account={account} />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionSettings />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
