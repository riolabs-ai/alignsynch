import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Calendar, Clock, Gift, Star, Trophy, Zap } from "lucide-react";

export function DailyRewards() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Rewards & Streaks</CardTitle>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-blue-500" />
              Daily Streak
            </h3>

            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div key={day} className={`relative flex items-center justify-center h-8 w-8 rounded-full border ${day <= 4 ? "bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700" : "bg-muted/30 border-muted"}`}>
                  <span className="text-xs font-medium">{day}</span>
                  {day === 7 && (
                    <div className="absolute -top-1 -right-1">
                      <Trophy className="h-3 w-3 text-amber-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">Current streak: 4 days. Keep playing daily!</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">
              <Award className="h-4 w-4 mr-2 text-amber-500" />
              Streak Rewards
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <Badge variant="outline" className="mb-1">
                  3 Days
                </Badge>
                <span className="text-xs font-medium">+50 Coins</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <Badge variant="outline" className="mb-1">
                  5 Days
                </Badge>
                <span className="text-xs font-medium">+100 Coins</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <Badge variant="outline" className="mb-1">
                  7 Days
                </Badge>
                <span className="text-xs font-medium">Special Badge</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <Badge variant="outline" className="mb-1">
                  14 Days
                </Badge>
                <span className="text-xs font-medium">Premium Theme</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">
              <Trophy className="h-4 w-4 mr-2 text-purple-500" />
              Daily Challenge Badges
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <div className="p-1 bg-green-100 dark:bg-green-900 rounded-full mb-1">
                  <Zap className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs">First Try</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded-full mb-1">
                  <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs">Speedster</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center">
                <div className="p-1 bg-purple-100 dark:bg-purple-900 rounded-full mb-1">
                  <Star className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs">Perfect</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center opacity-50">
                <div className="p-1 bg-amber-100 dark:bg-amber-900 rounded-full mb-1">
                  <Trophy className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs">Top 3</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center opacity-50">
                <div className="p-1 bg-red-100 dark:bg-red-900 rounded-full mb-1">
                  <Gift className="h-3 w-3 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-xs">Generous</span>
              </div>

              <div className="border rounded-lg p-2 flex flex-col items-center text-center opacity-50">
                <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-full mb-1">
                  <Award className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                </div>
                <span className="text-xs">Veteran</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
