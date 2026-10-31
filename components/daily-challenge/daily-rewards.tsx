import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount, formatDayCount } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { dailyChallengeBadges } from "@/data/daily-challenge";
import { metric, streakRewards } from "@/data/metrics";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Award, Calendar, Clock, Gift, Star, Trophy, Zap, type LucideIcon } from "lucide-react";

/**
 * Each badge's art, keyed by its id in `data/daily-challenge.ts`. Presentation only — the
 * label and the earned/not-earned state come from the fixture, so the view cannot invent a
 * badge and the fixture cannot drift from a row the card renders.
 */
const BADGE_ART: Record<
  string,
  { Icon: LucideIcon; wrapClassName: string; iconClassName: string }
> = {
  "first-try": {
    Icon: Zap,
    wrapClassName: "p-1 bg-green-100 dark:bg-green-900 rounded-full mb-1",
    iconClassName: "h-3 w-3 text-green-600 dark:text-green-400",
  },
  speedster: {
    Icon: Clock,
    wrapClassName: "p-1 bg-blue-100 dark:bg-blue-900 rounded-full mb-1",
    iconClassName: "h-3 w-3 text-blue-600 dark:text-blue-400",
  },
  perfect: {
    Icon: Star,
    wrapClassName: "p-1 bg-action/10 dark:bg-action/20 rounded-full mb-1",
    iconClassName: "h-3 w-3 text-action",
  },
  "top-3": {
    Icon: Trophy,
    wrapClassName: "p-1 bg-amber-100 dark:bg-amber-900 rounded-full mb-1",
    iconClassName: "h-3 w-3 text-amber-600 dark:text-amber-400",
  },
  generous: {
    Icon: Gift,
    wrapClassName: "p-1 bg-red-100 dark:bg-red-900 rounded-full mb-1",
    iconClassName: "h-3 w-3 text-red-600 dark:text-red-400",
  },
  veteran: {
    Icon: Award,
    wrapClassName: "p-1 bg-slate-100 dark:bg-slate-900 rounded-full mb-1",
    iconClassName: "h-3 w-3 text-slate-600 dark:text-slate-400",
  },
};

const DEFAULT_BADGE_ART = {
  Icon: Award,
  wrapClassName: "p-1 bg-muted rounded-full mb-1",
  iconClassName: "h-3 w-3",
};

/**
 * The rewards card: the streak bar, the streak reward bands and the badge grid.
 *
 * The bands are `streakRewards` and the numbers are metric snapshots (`data/metrics.ts`);
 * the badge grid is `dailyChallengeBadges` (`data/daily-challenge.ts`). What used to be
 * here was six hand-written badge blocks — three of them carrying a literal `opacity-50`
 * to mean "not earned" — so the set of badges was a component, not data.
 */
export function DailyRewards({ copy }: { copy: PageCopySection }) {
  const streakDays = metric("daily.challenge.streak.days").value;
  const badgeGoalDays = metric("daily.challenge.streak.badgeGoalDays").value;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{copy.heading}</CardTitle>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-blue-500" />
              {itemLabel(copy, "daily-streak")}
            </h3>

            <div className="flex space-x-1">
              {Array.from({ length: badgeGoalDays }, (_, index) => index + 1).map((day) => (
                <div
                  key={day}
                  className={`relative flex items-center justify-center h-8 w-8 rounded-full border ${day <= streakDays ? "bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700" : "bg-muted/30 border-muted"}`}
                >
                  <span className="text-xs font-medium">{day}</span>
                  {day === badgeGoalDays && (
                    <div className="absolute -top-1 -right-1">
                      <Trophy className="h-3 w-3 text-amber-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {fillLabel(itemLabel(copy, "current-streak"), {
                days: formatDayCount(streakDays),
              })}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">
              <Award className="h-4 w-4 mr-2 text-amber-500" />
              {itemLabel(copy, "streak-rewards")}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {streakRewards.map((reward) => (
                <div
                  key={reward.days}
                  className="border rounded-lg p-2 flex flex-col items-center text-center"
                >
                  <Badge variant="outline" className="mb-1">
                    {formatDayCount(reward.days, "upper")}
                  </Badge>
                  <span className="text-xs font-medium">
                    {reward.coins === undefined
                      ? reward.label
                      : fillLabel(itemLabel(copy, "coins"), {
                          amount: formatCount(reward.coins),
                        })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">
              <Trophy className="h-4 w-4 mr-2 text-action" />
              {itemLabel(copy, "badges")}
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {dailyChallengeBadges.map((badge) => {
                const { Icon, wrapClassName, iconClassName } =
                  BADGE_ART[badge.id] ?? DEFAULT_BADGE_ART;
                return (
                  <div
                    key={badge.id}
                    className={`border rounded-lg p-2 flex flex-col items-center text-center${badge.unlocked ? "" : " opacity-50"}`}
                  >
                    <div className={wrapClassName}>
                      <Icon className={iconClassName} />
                    </div>
                    <span className="text-xs">{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
