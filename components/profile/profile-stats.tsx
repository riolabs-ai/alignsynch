import type { UserStats } from "@/lib/data/users"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Award, BarChart2, Clock, Flame, Percent, Star, ThumbsUp, TrendingUp } from "lucide-react"

interface ProfileStatsProps {
  stats: UserStats
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  // Format time played in hours and minutes
  const formatTimePlayed = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Stats & Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
              Average Score
            </div>
            <div className="font-semibold">{stats.averageScore}%</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
              Win Rate
            </div>
            <div className="font-semibold">{Math.round(stats.winRate * 100)}%</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Flame className="mr-1.5 h-3.5 w-3.5" />
              Current Streak
            </div>
            <div className="font-semibold">{stats.currentStreak} quizzes</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
              Highest Streak
            </div>
            <div className="font-semibold">{stats.highestStreak} quizzes</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Time Played
            </div>
            <div className="font-semibold">{formatTimePlayed(stats.totalTimePlayed)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Percent className="mr-1.5 h-3.5 w-3.5" />
              Completion Rate
            </div>
            <div className="font-semibold">{Math.round(stats.quizCompletionRate * 100)}%</div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Star className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                <span>Best Category</span>
              </div>
              <span className="font-medium">{stats.bestCategory}</span>
            </div>
            <Progress value={95} className="h-1.5" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Award className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                <span>Favorite Category</span>
              </div>
              <span className="font-medium">{stats.favoriteCategory}</span>
            </div>
            <Progress value={85} className="h-1.5" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center text-muted-foreground">
                <span>Weakest Category</span>
              </div>
              <span className="font-medium">{stats.weakestCategory}</span>
            </div>
            <Progress value={40} className="h-1.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
