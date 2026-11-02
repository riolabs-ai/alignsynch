"use client";

// template-ancestor: components/header/NotificationDrawer.tsx   (variation: the list as a page — unread rows first, mark-all-read and per-row mark-read, the unread count derived from the store)

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/content/core";
import { notificationsFor } from "@/data/v1/notifications";
import type { Persona } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { renderV1NotificationIcon } from "./v1-notification-icon";

/**
 * The /v1 notifications page. The bell in the shell and this page read the same selector
 * (`notificationsFor`) over the same store, so the badge count and the list's unread count cannot
 * disagree — both are a count of the rows where `read` is false, never a stored number.
 */
export function V1Notifications({ persona }: { persona: Persona }) {
  const store = useV1Store();
  const rows = notificationsFor(persona, store.notifications);
  const unread = rows.filter((notification) => !notification.read);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread.length === 0 ? "You're all caught up." : `${unread.length} unread`}
          </p>
        </div>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => store.markAllNotificationsRead(persona)}
          >
            <Check className="mr-1 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
          <Bell className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((notification) => (
            <Link
              key={notification.id}
              href={notification.link}
              onClick={() => store.markNotificationRead(notification.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted",
                notification.read ? "opacity-70" : "border-l-2 border-l-action",
              )}
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                {renderV1NotificationIcon(notification.type)}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{notification.title}</span>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal">
                    {formatRelative(notification.createdAt)}
                  </Badge>
                </span>
                <span className="block text-sm text-muted-foreground">{notification.body}</span>
              </span>
              {/* The dot's slot is always reserved, so every row's timestamp pill lines up whether
                  or not the row is unread; the state is also spoken, not only coloured. */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  notification.read ? "bg-transparent" : "bg-action",
                )}
              />
              <span className="sr-only">{notification.read ? "Read" : "Unread"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
