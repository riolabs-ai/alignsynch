// template-ancestor: components/profile/profile-achievements.tsx   (variation: earned milestones only, no rarity and no locked grid — three product milestones derived from the store, nothing the data cannot prove)
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileMilestone } from "@/lib/v1/profile";
import { Award, CheckCircle, Layers, Users } from "lucide-react";

/** The icon each milestone renders, by its id. */
const ICON = {
  "first-scored": CheckCircle,
  "three-sessions": Layers,
  "coach-joined": Users,
} as const;

/**
 * The v1 achievements — milestones the fixture can prove, and nothing more (#384). There is no
 * rarity, no locked badge and no certificate: a milestone is either earned (rendered, with its
 * data-derived evidence) or absent. The three kinds are first session scored, three sessions and
 * coach-joined, each computed by `lib/v1/profile.ts`.
 */
export function V1ProfileAchievements({ milestones }: { milestones: readonly ProfileMilestone[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Milestones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {milestones.map((milestone) => {
            const Icon = ICON[milestone.id];
            return (
              <div key={milestone.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action/10 text-action">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-medium">{milestone.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      earned
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{milestone.description}</p>
                </div>
              </div>
            );
          })}

          {milestones.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <Award className="mb-2 h-10 w-10 opacity-20" />
              <p>No milestones yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
