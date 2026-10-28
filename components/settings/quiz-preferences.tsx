"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Brain, Clock, Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Lightbulb, Save } from "./missing-icons";

export function QuizPreferences() {
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    defaultTimeLimit: 30,
    defaultDifficulty: "medium",
    autoSave: true,
    showTimer: true,
    showHints: true,
    preferredCategories: ["science", "history"],
    preferredLanguage: "english",
    showCorrectAnswers: true,
  });

  const handleToggle = (setting: string, value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleSelectChange = (setting: string, value: string) => {
    setPreferences((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleSliderChange = (value: number[]) => {
    setPreferences((prev) => ({
      ...prev,
      defaultTimeLimit: value[0],
    }));
  };

  const handleSave = () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Quiz preferences saved!");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Quiz Preferences</h3>
        <p className="text-sm text-muted-foreground">Customize your quiz creation and playing experience.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Quiz Settings</CardTitle>
          <CardDescription>Set your default preferences for creating quizzes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Default Time Limit</p>
                  <p className="text-sm text-muted-foreground">Set the default time limit for quiz questions.</p>
                </div>
              </div>
              <span className="font-medium">{preferences.defaultTimeLimit} seconds</span>
            </div>
            <Slider value={[preferences.defaultTimeLimit]} min={10} max={120} step={5} onValueChange={handleSliderChange} className="mt-2" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Default Difficulty</p>
                <p className="text-sm text-muted-foreground">Set the default difficulty for your quizzes.</p>
              </div>
            </div>
            <Select value={preferences.defaultDifficulty} onValueChange={(value) => handleSelectChange("defaultDifficulty", value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Save className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Auto-Save</p>
                <p className="text-sm text-muted-foreground">Automatically save quiz drafts while editing.</p>
              </div>
            </div>
            <Switch checked={preferences.autoSave} onCheckedChange={(value) => handleToggle("autoSave", value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Playing Experience</CardTitle>
          <CardDescription>Customize how you experience quizzes when playing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Show Timer</p>
                <p className="text-sm text-muted-foreground">Show countdown timer when playing quizzes.</p>
              </div>
            </div>
            <Switch checked={preferences.showTimer} onCheckedChange={(value) => handleToggle("showTimer", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Lightbulb className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Show Hints</p>
                <p className="text-sm text-muted-foreground">Show hints when available in quizzes.</p>
              </div>
            </div>
            <Switch checked={preferences.showHints} onCheckedChange={(value) => handleToggle("showHints", value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Show Correct Answers</p>
                <p className="text-sm text-muted-foreground">Show correct answers after completing a quiz.</p>
              </div>
            </div>
            <Switch checked={preferences.showCorrectAnswers} onCheckedChange={(value) => handleToggle("showCorrectAnswers", value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content Preferences</CardTitle>
          <CardDescription>Set your preferred quiz content and language.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="font-medium">Preferred Categories</Label>
            <p className="text-sm text-muted-foreground mb-2">Select categories you're most interested in.</p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={preferences.preferredCategories.includes("science") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("science") ? preferences.preferredCategories.filter((c) => c !== "science") : [...preferences.preferredCategories, "science"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                Science
              </Badge>
              <Badge
                variant={preferences.preferredCategories.includes("history") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("history") ? preferences.preferredCategories.filter((c) => c !== "history") : [...preferences.preferredCategories, "history"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                History
              </Badge>
              <Badge
                variant={preferences.preferredCategories.includes("geography") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("geography") ? preferences.preferredCategories.filter((c) => c !== "geography") : [...preferences.preferredCategories, "geography"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                Geography
              </Badge>
              <Badge
                variant={preferences.preferredCategories.includes("literature") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("literature") ? preferences.preferredCategories.filter((c) => c !== "literature") : [...preferences.preferredCategories, "literature"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                Literature
              </Badge>
              <Badge
                variant={preferences.preferredCategories.includes("movies") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("movies") ? preferences.preferredCategories.filter((c) => c !== "movies") : [...preferences.preferredCategories, "movies"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                Movies
              </Badge>
              <Badge
                variant={preferences.preferredCategories.includes("music") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("music") ? preferences.preferredCategories.filter((c) => c !== "music") : [...preferences.preferredCategories, "music"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                Music
              </Badge>
              <Badge
                variant={preferences.preferredCategories.includes("sports") ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newCategories = preferences.preferredCategories.includes("sports") ? preferences.preferredCategories.filter((c) => c !== "sports") : [...preferences.preferredCategories, "sports"];
                  setPreferences((prev) => ({ ...prev, preferredCategories: newCategories }));
                }}
              >
                Sports
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Preferred Language</p>
                <p className="text-sm text-muted-foreground">Set your preferred language for quizzes.</p>
              </div>
            </div>
            <Select value={preferences.preferredLanguage} onValueChange={(value) => handleSelectChange("preferredLanguage", value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="german">German</SelectItem>
                <SelectItem value="chinese">Chinese</SelectItem>
                <SelectItem value="japanese">Japanese</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Quiz Preferences
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
