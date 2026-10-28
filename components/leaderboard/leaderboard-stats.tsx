import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Medal, Trophy, Users } from "lucide-react"

export function LeaderboardStats() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Competition Stats</CardTitle>
        <CardDescription>Current season statistics and your ranking</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Season 3</span>
            </div>
            <Badge variant="outline">28 days left</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Participants</span>
              <span className="font-medium">1,248</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Top Badge</span>
              <div className="flex items-center">
                <Medal className="mr-1 h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium">Diamond (5 users)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your Rank</span>
              </div>
              <Badge>#42</Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Next Level</span>
                <span>3,250 / 4,000 points</span>
              </div>
              <Progress value={81.25} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center">
                  <Trophy className="mr-1 h-3 w-3 text-amber-500" />
                  Silver
                </span>
                <span className="text-muted-foreground">750 points to Gold</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
