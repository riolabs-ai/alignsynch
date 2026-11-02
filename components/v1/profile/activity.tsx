// template-ancestor: components/profile/profile-activity.tsx   (variation: relationship history instead of quiz history — one dated row per joined, invited, accepted or scored event, with the summary counts the store can prove)
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { ProfileActivity as ProfileActivityData } from "@/lib/v1/profile";
import type { ProfileActivityKind } from "@/lib/v1/profile";
import { CheckCircle, Handshake, Send, Trophy } from "lucide-react";

/** The icon each relationship event renders, by its kind. */
const ICON: Readonly<Record<ProfileActivityKind, typeof Handshake>> = {
  joined: Handshake,
  invited: Send,
  accepted: CheckCircle,
  scored: Trophy,
};

/**
 * The v1 profile activity feed — a relationship history, not a quiz history (#384). Every row is
 * a dated event the relationship's own fields carry; the header states the three counts the store
 * proves (relationships, sessions answered, sessions scored). No follower totals, no quiz streaks:
 * a fact the fixtures do not carry has no row here.
 */
export function V1ProfileActivity({ activity }: { activity: ProfileActivityData }) {
  const { events, summary } = activity;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b px-4 py-3 text-sm">
          <span>
            <span className="font-semibold text-foreground">{summary.relationshipCount}</span>{" "}
            <span className="text-muted-foreground">
              {summary.relationshipCount === 1 ? "relationship" : "relationships"}
            </span>
          </span>
          <span>
            <span className="font-semibold text-foreground">{summary.sessionsAnswered}</span>{" "}
            <span className="text-muted-foreground">
              {summary.sessionsAnswered === 1 ? "session answered" : "sessions answered"}
            </span>
          </span>
          <span>
            <span className="font-semibold text-foreground">{summary.sessionsScored}</span>{" "}
            <span className="text-muted-foreground">
              {summary.sessionsScored === 1 ? "session scored" : "sessions scored"}
            </span>
          </span>
        </div>

        <div className="divide-y">
          {events.map((event) => {
            const Icon = ICON[event.kind];
            return (
              <div key={event.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-full bg-muted p-1.5">
                  <Icon className="h-4 w-4 text-action" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{event.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.at)}</p>
                </div>
              </div>
            );
          })}

          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Handshake className="mb-2 h-10 w-10 opacity-20" />
              <p>No relationship activity yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
