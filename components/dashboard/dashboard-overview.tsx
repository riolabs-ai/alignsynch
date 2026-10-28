import { EarningsChart } from "@/components/dashboard/earnings-chart";
import { RecentQuizzes } from "@/components/dashboard/recent-quizzes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Clock, DollarSign, Eye, TrendingUp, Trophy, Users } from "lucide-react";

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$124.50</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              <span className="text-green-500">+12%</span>
              <span className="ml-1">from last month</span>
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full">
              Withdraw
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+4 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">573</div>
            <p className="text-xs text-muted-foreground">+118 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.3%</div>
            <p className="text-xs text-muted-foreground">+2.1% from last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Earnings Overview</CardTitle>
            <CardDescription>Your earnings for the past 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <EarningsChart />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Quizzes</CardTitle>
            <CardDescription>Your recently created quizzes</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentQuizzes />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Stats</CardTitle>
            <CardDescription>Your referral performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Referrals</span>
                </div>
                <span className="font-medium">42</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Commission Earned</span>
                </div>
                <span className="font-medium">$78.25</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Conversion Rate</span>
                </div>
                <span className="font-medium">24.8%</span>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                View Affiliate Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiz Performance</CardTitle>
            <CardDescription>How your quizzes are doing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Views</span>
                </div>
                <span className="font-medium">2,845</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg. Completion Time</span>
                </div>
                <span className="font-medium">4m 12s</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Trophy className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Highest Scoring Quiz</span>
                </div>
                <span className="font-medium">Science Quiz</span>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                View All Analytics
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events on your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-2 border-primary pl-3">
                <p className="text-sm font-medium">Quiz Completed</p>
                <p className="text-xs text-muted-foreground">Someone completed "World Geography"</p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
              <div className="border-l-2 border-green-500 pl-3">
                <p className="text-sm font-medium">Earnings Received</p>
                <p className="text-xs text-muted-foreground">You earned $2.50 from quiz plays</p>
                <p className="text-xs text-muted-foreground">Yesterday</p>
              </div>
              <div className="border-l-2 border-blue-500 pl-3">
                <p className="text-sm font-medium">New Referral</p>
                <p className="text-xs text-muted-foreground">User "JohnDoe" signed up using your link</p>
                <p className="text-xs text-muted-foreground">2 days ago</p>
              </div>
              <div className="border-l-2 border-orange-500 pl-3">
                <p className="text-sm font-medium">Quiz Created</p>
                <p className="text-xs text-muted-foreground">You created "Science Trivia"</p>
                <p className="text-xs text-muted-foreground">3 days ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
