"use client";
// template-ancestor: components/identity/settings-view.tsx   (variation: persona-scoped settings — the tab strip is built from the persona's own section list, and the initiator's sixth section is reached through a dynamic import no other persona's graph contains)

import { LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERSONA_META } from "@/data/v1/fixtures";
import { personaHandle, type DashboardPersona } from "@/lib/v1/persona";
import { memberSinceOf } from "@/lib/v1/profile";
import {
  SETTINGS_SECTION_LABEL,
  SETTINGS_SECTIONS,
  settingsSectionsFor,
  sharedNotificationEventsFor,
  type SettingsTabId,
} from "@/lib/v1/settings";
import { useV1Store } from "@/lib/v1/store";
import dynamic from "next/dynamic";
import { AccountSettings } from "./account-settings";
import { AppearanceSettings } from "./appearance-settings";
import { ConnectedAccounts } from "./connected-accounts";
import { NotificationSettings } from "./notification-settings";
import { PrivacySettings } from "./privacy-settings";

/**
 * The two initiator-only modules, reached through `import()` and never through a static edge.
 *
 * The subscription surface is the initiator's alone (#384), and the acceptance greps the
 * counterparty's render path for the money words with zero hits allowed. A static import keeps
 * those words out of the *paint* but leaves them in every persona's module graph — a weaker
 * promise than the card makes. Loaded this way, a counterparty's browser never fetches the chunk:
 * for them the section has no row in the strip, no module in the graph and no bytes in the bundle.
 * The payer's fourth notification event travels with it, for the same reason.
 */
const SubscriptionSettings = dynamic(
  () =>
    import("@/components/v1/subscription/subscription-settings").then(
      (module) => module.SubscriptionSettings,
    ),
  { ssr: false, loading: () => <LoadingState rows={2} /> },
);

const PayerNotifications = dynamic(
  () =>
    import("@/components/v1/subscription/payer-notifications").then(
      (module) => module.PayerNotifications,
    ),
  { ssr: false, loading: () => <LoadingState rows={1} /> },
);

/**
 * The tab strip's column count follows the section count: five sections, six for the initiator.
 * The list is `h-auto` because a two- or three-column grid wraps onto more than one row at phone
 * widths, and the primitive's fixed `h-10` would let the second row overlap the card below.
 */
const COLUMNS: Readonly<Record<number, string>> = {
  5: "grid-cols-2 sm:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

/**
 * The persona's settings (#384): account, appearance, notifications, privacy and connected
 * accounts — the five sections every dashboard persona holds — plus, for the initiator alone, the
 * subscription surface.
 *
 * The tab strip is generated from `settingsSectionsFor(persona)`, the same function the test
 * asserts on, so "the subscription section is present only for the initiator" is one decision in
 * one place rather than a conditional a second reader has to trust. The initiator's two extra
 * modules are fetched on demand; a counterparty, coach or admin graph never reaches them.
 */
export function SettingsView({ persona }: { persona: DashboardPersona }) {
  const { relationships, accounts } = useV1Store();
  const meta = PERSONA_META[persona];
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;
  const handle = personaHandle(persona);
  const email = accounts.find((account) => account.persona === persona)?.email ?? "";
  const memberSince = memberSinceOf(persona, relationships);

  const sections = settingsSectionsFor(persona);
  const events = sharedNotificationEventsFor(persona);

  const contentOf = (section: SettingsTabId) => {
    switch (section) {
      case "account":
        return (
          <AccountSettings
            persona={persona}
            handle={handle}
            email={email}
            memberSince={memberSince}
          />
        );
      case "appearance":
        return <AppearanceSettings />;
      case "notifications":
        return persona === "initiator" ? (
          <PayerNotifications events={events} />
        ) : (
          <NotificationSettings events={events} />
        );
      case "privacy":
        return <PrivacySettings />;
      case "connected":
        return <ConnectedAccounts email={email} handle={handle} name={fullName} />;
      case "subscription":
        return <SubscriptionSettings persona={persona} />;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionIntro title="Settings" subtitle={`${fullName} · ${meta.label}`} />

      <Tabs defaultValue={SETTINGS_SECTIONS[0]} className="w-full">
        <TabsList className={`grid h-auto w-full gap-1 ${COLUMNS[sections.length] ?? COLUMNS[6]}`}>
          {sections.map((section) => (
            <TabsTrigger key={section} value={section} className="px-2 text-xs sm:text-sm">
              {SETTINGS_SECTION_LABEL[section]}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {sections.map((section) => (
            <TabsContent key={section} value={section}>
              {contentOf(section)}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      <p className="px-1 text-xs text-muted-foreground">
        {sections.length} sections ·{" "}
        {sections.map((section) => SETTINGS_SECTION_LABEL[section]).join(" · ")}
      </p>
    </div>
  );
}
