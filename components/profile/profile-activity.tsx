import { Card, CardContent } from "@/components/ui/card";
import type { Activity } from "@/lib/data/users";
import { Award, CheckCircle, Clock, PenTool, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";

interface ProfileActivityProps {
  activities: Activity[];
}

export function ProfileActivity({ activities }: ProfileActivityProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "quiz_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "achievement_earned":
        return <Award className="h-4 w-4 text-amber-500" />;
      case "level_up":
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case "quiz_created":
        return <PenTool className="h-4 w-4 text-purple-500" />;
      case "followed_user":
        return <UserPlus className="h-4 w-4 text-indigo-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActivityLink = (activity: Activity) => {
    switch (activity.type) {
      case "quiz_completed":
      case "quiz_created":
        return activity.relatedId ? `/quiz/${activity.relatedId}` : undefined;
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
                <div className="mt-0.5 rounded-full bg-muted p-1.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1">
                  <p className="text-sm">
                    {activityLink ? (
                      <>
                        {activity.content.split(activity.relatedName || "").map((part, i, arr) => {
                          if (i === arr.length - 1) return part;
                          return (
                            <span key={i}>
                              {part}
                              <Link href={activityLink} className="font-medium text-primary hover:underline">
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
                  <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</p>
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
