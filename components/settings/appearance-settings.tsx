"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

export function AppearanceSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState("medium");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const handleSave = () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Appearance settings saved!");
    }, 1000);
  };
  const handleThemeChange = (value: string) => {
    console.log("Selected theme:", value);
    setTheme(value);
  };
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Appearance Settings</h3>
        <p className="text-sm text-muted-foreground">Customize how QuizHub looks and feels for you.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose your preferred color theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={handleThemeChange} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
              <Label htmlFor="theme-light" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                <Sun className="mb-3 h-6 w-6" />
                <span className="font-medium">Light</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
              <Label htmlFor="theme-dark" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                <Moon className="mb-3 h-6 w-6" />
                <span className="font-medium">Dark</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="system" id="theme-system" className="peer sr-only" />
              <Label htmlFor="theme-system" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                <Monitor className="mb-3 h-6 w-6" />
                <span className="font-medium">System</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Font Size</CardTitle>
          <CardDescription>Choose your preferred font size.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={fontSize} onValueChange={setFontSize} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <RadioGroupItem value="small" id="font-small" className="peer sr-only" />
              <Label htmlFor="font-small" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                <span className="text-sm mb-3">Aa</span>
                <span className="font-medium">Small</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="medium" id="font-medium" className="peer sr-only" />
              <Label htmlFor="font-medium" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                <span className="text-base mb-3">Aa</span>
                <span className="font-medium">Medium</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="large" id="font-large" className="peer sr-only" />
              <Label htmlFor="font-large" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                <span className="text-lg mb-3">Aa</span>
                <span className="font-medium">Large</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accessibility</CardTitle>
          <CardDescription>Adjust settings to improve accessibility.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Reduced Motion</p>
              <p className="text-sm text-muted-foreground">Reduce the amount of animations and transitions.</p>
            </div>
            <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">High Contrast</p>
              <p className="text-sm text-muted-foreground">Increase contrast for better visibility.</p>
            </div>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Appearance Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
