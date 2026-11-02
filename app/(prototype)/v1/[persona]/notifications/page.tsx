// template-ancestor: components/header/NotificationDrawer.tsx   (variation: the /v1 notifications page — the persona's events, rendered by V1Notifications)
import { V1Notifications } from "@/components/v1/v1-notifications";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/notifications` — the persona's notifications (every dashboard persona). */
export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "notifications")) notFound();
  return <V1Notifications persona={persona} />;
}
