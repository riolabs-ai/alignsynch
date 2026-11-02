"use client";
// template-ancestor: components/settings/appearance-settings.tsx   (variation: a smaller appearance panel — one theme choice and one reduced-motion switch, no font-size cards)

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The appearance section — the prototype's own surface, kept to what the brand actually offers:
 * a theme choice and a reduced-motion switch. No font-size cards and no claim the skin cannot
 * honour.
 */
export function AppearanceSettings() {
  const [theme, setTheme] = useState("system");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const save = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Appearance settings saved!");
    }, 600);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>How the prototype looks for you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Theme</p>
          <RadioGroup value={theme} onValueChange={setTheme} className="flex gap-4">
            {(["system", "light", "dark"] as const).map((value) => (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem value={value} id={`theme-${value}`} />
                <Label htmlFor={`theme-${value}`} className="capitalize">
                  {value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Reduced motion</p>
            <p className="text-sm text-muted-foreground">Reduce animations and transitions.</p>
          </div>
          <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={isLoading} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Save appearance settings
        </Button>
      </CardFooter>
    </Card>
  );
}
