import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SettingsDashboard() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="display" className="space-y-4">
        <TabsList>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="display" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Layout</CardTitle>
              <CardDescription>Customize how your dashboard looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compact-mode">Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">Display more information in less space</p>
                </div>
                <Switch id="compact-mode" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-earnings">Show Earnings</Label>
                  <p className="text-sm text-muted-foreground">Display earnings information on dashboard</p>
                </div>
                <Switch id="show-earnings" defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-view">Default Dashboard View</Label>
                <Select defaultValue="overview">
                  <SelectTrigger id="default-view">
                    <SelectValue placeholder="Select default view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="my-quizzes">My Quizzes</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="affiliate">Affiliate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chart Settings</CardTitle>
              <CardDescription>Customize how charts are displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chart-timeframe">Default Chart Timeframe</Label>
                <Select defaultValue="30days">
                  <SelectTrigger id="chart-timeframe">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="year">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-tooltips">Show Chart Tooltips</Label>
                  <p className="text-sm text-muted-foreground">Display detailed information when hovering over charts</p>
                </div>
                <Switch id="show-tooltips" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Notifications</CardTitle>
              <CardDescription>Control what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="earnings-notifications">Earnings Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified about new earnings</p>
                </div>
                <Switch id="earnings-notifications" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quiz-notifications">Quiz Activity</Label>
                  <p className="text-sm text-muted-foreground">Get notified when someone plays your quiz</p>
                </div>
                <Switch id="quiz-notifications" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="referral-notifications">Referral Activity</Label>
                  <p className="text-sm text-muted-foreground">Get notified about new referrals</p>
                </div>
                <Switch id="referral-notifications" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="withdrawal-notifications">Withdrawal Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified about withdrawal status changes</p>
                </div>
                <Switch id="withdrawal-notifications" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Preferences</CardTitle>
              <CardDescription>Customize your dashboard experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency Display</Label>
                <Select defaultValue="usd">
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                    <SelectItem value="gbp">GBP (£)</SelectItem>
                    <SelectItem value="cad">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-refresh">Auto-refresh Dashboard</Label>
                  <p className="text-sm text-muted-foreground">Automatically update dashboard data</p>
                </div>
                <Switch id="auto-refresh" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-tips">Show Dashboard Tips</Label>
                  <p className="text-sm text-muted-foreground">Display helpful tips and suggestions</p>
                </div>
                <Switch id="show-tips" defaultChecked />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button>Save Settings</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
