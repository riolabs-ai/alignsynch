"use client";

/**
 * The ONLY place a notification's `iconKey` becomes a React element.
 *
 * The fixture used to store six pre-rendered elements as data (D10), which made
 * `data/notifications.tsx` non-serializable, unvalidatable and client-only. The
 * model now carries a string key (validated against `NOTIFICATION_ICON_KEYS` in
 * `content/social.ts`); the mapping lives here.
 *
 * Two maps instead of one `Record<key, LucideIcon>` because a bound wrapper is not
 * assignable to `LucideIcon` (it carries a required `$$typeof`); keeping the
 * component map literally typed and the class strings parallel keeps both halves
 * checked against the real library types, and `renderNotificationIcon` is the only
 * reader, so the pair cannot drift.
 *
 * Class strings are byte-identical to the ones the fixture carried — changing them
 * changes the drawer's appearance, which is a design decision, not a migration.
 */
import type { NotificationIconKey } from "@/content/social";
import { isNotificationIconKey } from "@/content/social";
import type { LucideIcon, LucideProps } from "lucide-react";
import { AlertCircle, Calendar, Gift, Star, Trophy, Users } from "lucide-react";
import { createElement, type ReactElement } from "react";

export const NOTIFICATION_ICONS: Record<NotificationIconKey, LucideIcon> = {
  trophy: Trophy,
  users: Users,
  gift: Gift,
  calendar: Calendar,
  "alert-circle": AlertCircle,
  star: Star,
};

export const NOTIFICATION_ICON_CLASS: Record<NotificationIconKey, string> = {
  trophy: "h-5 w-5 text-yellow-500",
  users: "h-5 w-5 text-blue-500",
  gift: "h-5 w-5 text-green-500",
  calendar: "h-5 w-5 text-purple-500",
  "alert-circle": "h-5 w-5 text-red-500",
  star: "h-5 w-5 text-amber-500",
};

/**
 * Returns the same element the fixture used to store:
 *   <Trophy className="h-5 w-5 text-yellow-500" />
 * An unknown key throws instead of rendering a blank bubble — `data:check` should
 * have rejected it long before render.
 */
export function renderNotificationIcon(
  key: string,
  props?: Omit<LucideProps, "className">,
): ReactElement {
  if (!isNotificationIconKey(key)) {
    throw new Error(`renderNotificationIcon: unknown iconKey "${key}"`);
  }
  return createElement(NOTIFICATION_ICONS[key], {
    ...props,
    className: NOTIFICATION_ICON_CLASS[key],
  });
}
