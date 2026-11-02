// template-ancestor: components/header/notification-icon.tsx   (variation: the four v1 event types are the key — the type resolves to an element, no iconKey field to drift)

import type { V1NotificationType } from "@/data/v1/notifications";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, MessageSquare, Star, UserCheck } from "lucide-react";
import { createElement, type ReactElement } from "react";

/**
 * The ONLY place a v1 notification's `type` becomes a React element. The quiz ancestor maps a
 * stored `iconKey` string to an element because its six keys outnumber its six types; the v1
 * prototype has exactly four event types, so the type IS the key and there is no icon field that
 * can name an icon the registry does not carry. The four hues are the signal colours the ancestor
 * already used (`blue`, `amber`, `green`, `red`), which are deliberately outside the brand-class
 * rule because they mean the same thing under both brands.
 */
const NOTIFICATION_ICONS: Record<V1NotificationType, LucideIcon> = {
  invite_accepted: UserCheck,
  session_scored: Star,
  new_comment: MessageSquare,
  payment_failed: AlertCircle,
};

const NOTIFICATION_ICON_CLASS: Record<V1NotificationType, string> = {
  invite_accepted: "h-5 w-5 text-blue-500",
  session_scored: "h-5 w-5 text-amber-500",
  new_comment: "h-5 w-5 text-green-500",
  payment_failed: "h-5 w-5 text-red-500",
};

export function renderV1NotificationIcon(type: V1NotificationType): ReactElement {
  return createElement(NOTIFICATION_ICONS[type], { className: NOTIFICATION_ICON_CLASS[type] });
}
