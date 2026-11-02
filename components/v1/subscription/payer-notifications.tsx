"use client";
// template-ancestor: components/settings/notification-settings.tsx   (variation: the payer's fourth event appended inside the initiator-only module — so the shared notification catalogue and the settings family name no money word at all)

import { NotificationSettings } from "@/components/v1/settings/notification-settings";
import type { V1NotificationEvent } from "@/lib/v1/settings";
import { PAYER_NOTIFICATION_EVENTS } from "./subscription-settings";

/**
 * The initiator's notifications tab (#384): the shared events they can receive, plus the one event
 * only a payer can be sent — a charge that did not clear.
 *
 * The fourth event lives in this initiator-only module rather than in `lib/v1/settings.ts` for one
 * reason: the shared catalogue is mounted by every persona's settings, and the acceptance for
 * #384 greps the counterparty's render path for the money words and requires zero hits. Here the
 * words exist only behind the initiator's dynamic import, so a counterparty's browser never
 * downloads them either — not hidden at render time, absent from the graph.
 *
 * The list itself is still `NotificationSettings` from the settings family: one row per event, two
 * channels, no second notification component to drift.
 */
export function PayerNotifications({ events }: { events: readonly V1NotificationEvent[] }) {
  return <NotificationSettings events={[...events, ...PAYER_NOTIFICATION_EVENTS]} />;
}
