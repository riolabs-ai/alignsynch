"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Eye, Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Mail, Trophy, Users } from "./missing-icons";

export function PrivacySettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [privacy, setPrivacy] = useState({
    profileVisibility: "public",
    quizVisibility: "public",
    showOnLeaderboard: true,
    activityVisibility: "followers",
    allowTagging: true,
    showEmail: false,
    dataCollection: true,
  });

  const handleToggle = (setting: string, value: boolean) => {
    setPrivacy((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleSelectChange = (setting: string, value: string) => {
    setPrivacy((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleSave = () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Privacy settings saved!");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Privacy Settings</h3>
        <p className="text-sm text-muted-foreground">Control your privacy and how your information is shared on QuizHub .</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Privacy</CardTitle>
          <CardDescription>Control who can see your profile and activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Profile Visibility</p>
                <p className="text-sm text-muted-foreground">Control who can see your profile.</p>
              </div>
            </div>
            <Select value={privacy.profileVisibility} onValueChange={(value) => handleSelectChange("profileVisibility", value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="followers">Followers Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Quiz Visibility</p>
                <p className="text-sm text-muted-foreground">Control who can see your created quizzes.</p>
              </div>
            </div>
            <Select value={privacy.quizVisibility} onValueChange={(value) => handleSelectChange("quizVisibility", value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="followers">Followers Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Leaderboard Visibility</p>
                <p className="text-sm text-muted-foreground">Show your profile on public leaderboards.</p>
              </div>
            </div>
            <Switch checked={privacy.showOnLeaderboard} onCheckedChange={(value) => handleToggle("showOnLeaderboard", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Activity Visibility</p>
                <p className="text-sm text-muted-foreground">Control who can see your activity feed.</p>
              </div>
            </div>
            <Select value={privacy.activityVisibility} onValueChange={(value) => handleSelectChange("activityVisibility", value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="followers">Followers Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Privacy</CardTitle>
          <CardDescription>Control how others can interact with you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Allow Tagging</p>
                <p className="text-sm text-muted-foreground">Allow others to tag you in quizzes and comments.</p>
              </div>
            </div>
            <Switch checked={privacy.allowTagging} onCheckedChange={(value) => handleToggle("allowTagging", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Show Email Address</p>
                <p className="text-sm text-muted-foreground">Show your email address on your public profile.</p>
              </div>
            </div>
            <Switch checked={privacy.showEmail} onCheckedChange={(value) => handleToggle("showEmail", value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Privacy</CardTitle>
          <CardDescription>Control how your data is used on QuizHub .</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Data Collection</p>
                <p className="text-sm text-muted-foreground">Allow QuizHub to collect data to improve your experience.</p>
              </div>
            </div>
            <Switch checked={privacy.dataCollection} onCheckedChange={(value) => handleToggle("dataCollection", value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Privacy Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
