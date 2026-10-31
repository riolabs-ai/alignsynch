import { Card, CardContent } from "@/components/ui/card";
import { formatClockTime, formatMonthDay } from "@/content/core";
import type { Activity } from "@/lib/data/users";
import { Award, CheckCircle, Clock, PenTool, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";

interface ProfileActivityProps {
  activities: Activity[];
  /**
   * The gated hrefs and route patterns the shell must not draw, resolved on the server by
   * `lib/flags.ts::hiddenNavHrefs()` (#175 follow-up, #300).
   *
   * Required, and the same list every other link surface reads. This feed builds a **concrete**
   * `/quiz/<id>`, so it asks about the pattern (`/quiz/[id]`) rather than the href: on the
   * alignment build the quiz product is gated, and a row that linked into it would be a click
   * straight into a 404 (`scripts/` acceptance crawl, #300). The row still renders — the words are
   * the activity's — it just stops being a link.
   */
  hiddenNav: readonly string[];
}

export function ProfileActivity({ activities, hiddenNav }: ProfileActivityProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "quiz_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "achievement_earned":
        return <Award className="h-4 w-4 text-amber-500" />;
      case "level_up":
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case "quiz_created":
        return <PenTool className="h-4 w-4 text-action" />;
      case "followed_user":
        return <UserPlus className="h-4 w-4 text-action" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // `May 1, 02:30 PM` — both halves are UTC-pinned (`content/core.ts`). A
  // `toLocaleDateString()` here renders the server's timezone in the HTML and the visitor's
  // after hydration, which is a React #418 mismatch on every profile with an activity feed.
  const formatTimestamp = (timestamp: string) =>
    `${formatMonthDay(timestamp)}, ${formatClockTime(timestamp)}`;

  const getActivityLink = (activity: Activity) => {
    switch (activity.type) {
      case "quiz_completed":
      case "quiz_created":
        if (activity.relatedId === undefined || hiddenNav.includes("/quiz/[id]")) return undefined;
        return `/quiz/${activity.relatedId}`;
      case "followed_user":
        return activity.relatedId ? `/profile/${activity.relatedId}` : undefined;
      default:
        return undefined;
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {activities.map((activity) => {
            const activityLink = getActivityLink(activity);

            return (
              <div key={activity.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-full bg-muted p-1.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    {activityLink ? (
                      <>
                        {activity.content.split(activity.relatedName || "").map((part, i, arr) => {
                          if (i === arr.length - 1) return part;
                          return (
                            <span key={i}>
                              {part}
                              <Link
                                href={activityLink}
                                className="font-medium text-primary hover:underline"
                              >
                                {activity.relatedName}
                              </Link>
                            </span>
                          );
                        })}
                      </>
                    ) : (
                      activity.content
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}

          {activities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Clock className="mb-2 h-10 w-10 opacity-20" />
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
