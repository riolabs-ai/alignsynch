// template-ancestor: components/identity/settings-view.tsx
import { SettingsView } from "@/components/v1/settings/settings-view";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/**
 * `/v1/[persona]/settings` — the persona's settings.
 *
 * This page is deliberately thin: the section list is the persona's
 * (`settingsSectionsFor`), the tab strip is built from it, and the initiator's sixth section is
 * rendered by the initiator-only module. Keeping the decision inside the shared view means a
 * counterparty's page never mounts that module, and never renders, names or links a charge.
 */
export default async function SettingsPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "settings")) notFound();
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <SettingsView persona={persona} />
    </div>
  );
}
