"use client";
// template-ancestor: components/settings/notification-settings.tsx   (variation: only the events that can reach this persona — the shared three for everyone, plus the payer's charge failure for the initiator, appended by the settings view)

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { V1NotificationEvent } from "@/lib/v1/settings";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Channel = "email" | "push";

interface Prefs {
  readonly [eventId: string]: Record<Channel, boolean>;
}

/** Every event is on by email; push defaults on except for the invite acknowledgement. */
function defaultsFor(events: readonly V1NotificationEvent[]): Prefs {
  const prefs: Record<string, Record<Channel, boolean>> = {};
  for (const event of events) {
    prefs[event.id] = { email: true, push: event.id !== "inviteAccepted" };
  }
  return prefs;
}

/**
 * The notifications section (#384) — one row per event this persona can actually receive, and
 * nothing more. There are no quiz likes, no followers and no tournaments, because the two-party
 * product emits none of them; a toggle for an event the flow cannot produce is a promise the
 * product cannot keep.
 *
 * The list is a prop, not a constant. The shared three come from `lib/v1/settings.ts` per persona
 * — the counterparty and the coach send no invitations, so they are not offered an "invite
 * accepted" switch — and the payer's charge failure is appended by the settings view from the
 * initiator-only module. That is how the initiator sees all four events of the product's
 * vocabulary while no other persona's settings mention a charge that cannot reach them.
 */
export function NotificationSettings({ events }: { events: readonly V1NotificationEvent[] }) {
  const [prefs, setPrefs] = useState<Prefs>(() => defaultsFor(events));
  const [isLoading, setIsLoading] = useState(false);

  const toggle = (eventId: string, channel: Channel, value: boolean) => {
    setPrefs((previous) => ({
      ...previous,
      [eventId]: { ...previous[eventId], [channel]: value },
    }));
  };

  const save = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Notification preferences saved!");
    }, 600);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>The events the product sends you, by channel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 pb-1 text-xs font-medium text-muted-foreground">
          <span>Event</span>
          <span className="w-14 text-center">Email</span>
          <span className="w-14 text-center">Push</span>
        </div>
        {events.map((event) => (
          <div key={event.id}>
            <Separator className="mb-4" />
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
              <div>
                <p className="font-medium">{event.label}</p>
                <p className="text-sm text-muted-foreground">{event.detail}</p>
              </div>
              <div className="w-14 text-center">
                <Switch
                  checked={prefs[event.id]?.email ?? true}
                  onCheckedChange={(value) => toggle(event.id, "email", value)}
                  aria-label={`Email for ${event.label}`}
                />
              </div>
              <div className="w-14 text-center">
                <Switch
                  checked={prefs[event.id]?.push ?? true}
                  onCheckedChange={(value) => toggle(event.id, "push", value)}
                  aria-label={`Push for ${event.label}`}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={isLoading} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Save notification preferences
        </Button>
      </CardFooter>
    </Card>
  );
}
