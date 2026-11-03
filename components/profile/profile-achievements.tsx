// template-ancestor: components/ui/card.tsx   (variation: the achievement grid — seven tiles with earned and locked states)

import type { Achievement } from "@/lib/data/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/content/core";
import { Award, Book, FlaskRoundIcon as Flask, Pencil, Search, Star, Trophy } from "lucide-react";

interface ProfileAchievementsProps {
  achievements: Achievement[];
}

export function ProfileAchievements({ achievements }: ProfileAchievementsProps) {
  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case "trophy":
        return <Trophy className="h-4 w-4" />;
      case "star":
        return <Star className="h-4 w-4" />;
      case "search":
        return <Search className="h-4 w-4" />;
      case "pencil":
        return <Pencil className="h-4 w-4" />;
      case "flask":
        return <Flask className="h-4 w-4" />;
      case "book":
        return <Book className="h-4 w-4" />;
      default:
        return <Award className="h-4 w-4" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "uncommon":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "rare":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "epic":
        // Purple was the game-rarity hue, not a brand colour (#187 stage 3), so "epic" rides the
        // brand's action token the way stage 2 moved the Grandmaster rank. The scale keeps its other
        // four steps — gray, green, blue, amber — and the cost is stated rather than hidden: on
        // AlignSynch, whose accent *is* blue, epic and rare are now the same hue family and read
        // apart only by weight. One accent per brand cannot also be five rarity hues.
        return "bg-action/10 text-action";
      case "legendary":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {achievements.map((achievement) => (
            <div key={achievement.id} className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${getRarityColor(achievement.rarity)}`}
              >
                {getAchievementIcon(achievement.icon)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-medium">{achievement.name}</h4>
                  <Badge variant="outline" className="text-xs capitalize">
                    {achievement.rarity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{achievement.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Earned on {formatDate(achievement.earnedAt)}
                </p>
              </div>
            </div>
          ))}

          {achievements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <Award className="mb-2 h-10 w-10 opacity-20" />
              <p>No achievements yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
