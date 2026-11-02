"use client";

// template-ancestor: components/header/notification-icon.tsx   (variation: the header's bell as a link — a store-derived unread badge opening the same list the notifications page renders)

import type { Persona } from "@/data/v1/fixtures";
import { unreadNotificationCountOf } from "@/data/v1/notifications";
import { useV1Store } from "@/lib/v1/store";
import { Bell } from "lucide-react";
import Link from "next/link";

/**
 * The bell in the persona bar. It is a link to `/v1/[persona]/notifications`, not a second list:
 * "the bell opens the same list" means it navigates to the page, and the badge is the page's own
 * unread count (`unreadNotificationCountOf`), so the two can never drift.
 */
export function NotificationBell({ persona }: { persona: Persona }) {
  const store = useV1Store();
  const unread = unreadNotificationCountOf(persona, store.notifications);

  return (
    <Link
      href={`/v1/${persona}/notifications`}
      className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
      aria-label={`Notifications, ${unread} unread`}
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-semibold leading-none text-action-foreground">
          {unread}
        </span>
      )}
    </Link>
  );
}
