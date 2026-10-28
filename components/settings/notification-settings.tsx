"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Bell, DollarSign, Loader2, MessageSquare, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NotificationSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    email: {
      quizComments: true,
      quizLikes: true,
      newFollowers: true,
      tournamentUpdates: true,
      earnings: true,
      newsletter: false,
      productUpdates: true,
    },
    push: {
      quizComments: true,
      quizLikes: false,
      newFollowers: true,
      tournamentUpdates: true,
      earnings: true,
      productUpdates: false,
    },
  });

  const handleToggle = (channel: "email" | "push", setting: string, value: boolean) => {
    setNotifications((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [setting]: value,
      },
    }));
  };

  const handleSave = () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Notification preferences saved!");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">Manage how and when you receive notifications from QuizHub .</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Configure which emails you want to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Quiz Comments</p>
                <p className="text-sm text-muted-foreground">Receive emails when someone comments on your quizzes.</p>
              </div>
            </div>
            <Switch checked={notifications.email.quizComments} onCheckedChange={(value) => handleToggle("email", "quizComments", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Quiz Likes</p>
                <p className="text-sm text-muted-foreground">Receive emails when someone likes your quizzes.</p>
              </div>
            </div>
            <Switch checked={notifications.email.quizLikes} onCheckedChange={(value) => handleToggle("email", "quizLikes", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">New Followers</p>
                <p className="text-sm text-muted-foreground">Receive emails when someone follows you.</p>
              </div>
            </div>
            <Switch checked={notifications.email.newFollowers} onCheckedChange={(value) => handleToggle("email", "newFollowers", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Tournament Updates</p>
                <p className="text-sm text-muted-foreground">Receive emails about tournaments you've joined.</p>
              </div>
            </div>
            <Switch checked={notifications.email.tournamentUpdates} onCheckedChange={(value) => handleToggle("email", "tournamentUpdates", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Earnings Updates</p>
                <p className="text-sm text-muted-foreground">Receive emails about your earnings and payouts.</p>
              </div>
            </div>
            <Switch checked={notifications.email.earnings} onCheckedChange={(value) => handleToggle("email", "earnings", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Newsletter</p>
                <p className="text-sm text-muted-foreground">Receive our monthly newsletter with tips and updates.</p>
              </div>
            </div>
            <Switch checked={notifications.email.newsletter} onCheckedChange={(value) => handleToggle("email", "newsletter", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Product Updates</p>
                <p className="text-sm text-muted-foreground">Receive emails about new features and improvements.</p>
              </div>
            </div>
            <Switch checked={notifications.email.productUpdates} onCheckedChange={(value) => handleToggle("email", "productUpdates", value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>Configure which push notifications you want to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Quiz Comments</p>
                <p className="text-sm text-muted-foreground">Receive push notifications when someone comments on your quizzes.</p>
              </div>
            </div>
            <Switch checked={notifications.push.quizComments} onCheckedChange={(value) => handleToggle("push", "quizComments", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Quiz Likes</p>
                <p className="text-sm text-muted-foreground">Receive push notifications when someone likes your quizzes.</p>
              </div>
            </div>
            <Switch checked={notifications.push.quizLikes} onCheckedChange={(value) => handleToggle("push", "quizLikes", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">New Followers</p>
                <p className="text-sm text-muted-foreground">Receive push notifications when someone follows you.</p>
              </div>
            </div>
            <Switch checked={notifications.push.newFollowers} onCheckedChange={(value) => handleToggle("push", "newFollowers", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Tournament Updates</p>
                <p className="text-sm text-muted-foreground">Receive push notifications about tournaments you've joined.</p>
              </div>
            </div>
            <Switch checked={notifications.push.tournamentUpdates} onCheckedChange={(value) => handleToggle("push", "tournamentUpdates", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Earnings Updates</p>
                <p className="text-sm text-muted-foreground">Receive push notifications about your earnings and payouts.</p>
              </div>
            </div>
            <Switch checked={notifications.push.earnings} onCheckedChange={(value) => handleToggle("push", "earnings", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Product Updates</p>
                <p className="text-sm text-muted-foreground">Receive push notifications about new features and improvements.</p>
              </div>
            </div>
            <Switch checked={notifications.push.productUpdates} onCheckedChange={(value) => handleToggle("push", "productUpdates", value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Notification Preferences
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
