import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Medal, Star } from "lucide-react";
export type LeaderboardItem = {
  id: number;
  name: string;
  avatar: string;
  score: number;
  quizzes: number;
  rank: number;
  badge: string;
  winStreak: number;
  lastActive: string;
  country: string;
  level: number;
};
interface LeaderboardPodiumProps {
  leaderboardData: LeaderboardItem[];
}

export function LeaderboardPodium({ leaderboardData }: LeaderboardPodiumProps) {
  if (leaderboardData.length < 3) return null;

  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd places
  const podiumHeights = ["h-28", "h-36", "h-24"];
  const avatarSizes = ["h-16 w-16", "h-24 w-24", "h-14 w-14"];
  const borderColors = ["ring-gray-300", "ring-amber-500", "ring-amber-700"];
  const bgColors = ["bg-gray-300", "bg-amber-500", "bg-amber-700"];
  const textSizes = ["text-lg", "text-xl", "text-base"];

  return (
    <div className="mb-8 mt-6">
      <div className="flex items-end flex-wrap justify-center gap-4">
        {podiumOrder.map((index, i) => {
          const user = leaderboardData[index];
          const position = index + 1;
          return (
            <div key={user.id} className="flex flex-col items-center">
              <div className="relative mb-2">
                <Avatar className={`${avatarSizes[i]} ring-2 ring-offset-2 ${borderColors[i]}`}>
                  <AvatarImage src={user.avatar || "/placeholder.svg"} className="object-cover object-center" alt={user.name} />
                  <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                {i === 1 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <Crown className="h-8 w-8 text-amber-500" />
                  </div>
                )}
                <div className={`absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full ${bgColors[i]} text-sm font-bold text-white`}>{position}</div>
              </div>
              <h3 className={`${textSizes[i]} font-semibold`}>{user.name}</h3>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{user.score.toLocaleString()}</span>
                <span>pts</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant={i === 1 ? "default" : i === 0 ? "secondary" : "outline"} className="px-2 py-0.5">
                  {i === 1 && <Medal className="mr-1 h-3 w-3" />}
                  {user.badge}
                </Badge>
                <div className="flex items-center rounded-full bg-muted/80 px-1.5 py-0.5 text-xs">
                  <Star className="mr-0.5 h-3 w-3 text-amber-500" />
                  {user.level}
                </div>
              </div>
              <div className={`mt-3 w-full ${podiumHeights[i]} rounded-t-lg bg-gradient-to-t from-muted/80 to-muted/20`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
