import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { Badge } from "@/components/ui/badge";
import type { LeaderboardEntry } from "@/content/people";
import { Crown, Medal, Star } from "lucide-react";

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  if (entries.length < 3) return null;

  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd places
  const podiumHeights = ["h-28", "h-36", "h-24"];
  /** Podium avatar diameter in px: runner-up, champion, third (issue #152). */
  const avatarSizes = [64, 96, 56];
  const borderColors = ["ring-gray-300", "ring-amber-500", "ring-amber-700"];
  const bgColors = ["bg-gray-300", "bg-amber-500", "bg-amber-700"];
  const textSizes = ["text-lg", "text-xl", "text-base"];

  return (
    <div className="mb-8 mt-6">
      <div className="flex items-end flex-wrap justify-center gap-4">
        {podiumOrder.map((index, i) => {
          const entry = entries[index];
          const { player } = entry;
          const position = index + 1;
          return (
            <div key={player.id} className="flex flex-col items-center">
              <div className="relative mb-2">
                <Media
                  alt={player.name}
                  className={`ring-2 ring-offset-2 ${borderColors[i]}`}
                  height={avatarSizes[i]}
                  kind={FALLBACK_KIND.avatar}
                  seed={player.id}
                  width={avatarSizes[i]}
                />
                {i === 1 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <Crown className="h-8 w-8 text-amber-500" />
                  </div>
                )}
                <div
                  className={`absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full ${bgColors[i]} text-sm font-bold text-white`}
                >
                  {position}
                </div>
              </div>
              <h3 className={`${textSizes[i]} font-semibold`}>{player.name}</h3>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{entry.score.toLocaleString()}</span>
                <span>pts</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {player.tier !== undefined && (
                  <Badge
                    variant={i === 1 ? "default" : i === 0 ? "secondary" : "outline"}
                    className="px-2 py-0.5"
                  >
                    {i === 1 && <Medal className="mr-1 h-3 w-3" />}
                    {player.tier}
                  </Badge>
                )}
                <div className="flex items-center rounded-full bg-muted/80 px-1.5 py-0.5 text-xs">
                  <Star className="mr-0.5 h-3 w-3 text-amber-500" />
                  {player.level}
                </div>
              </div>
              <div className={`mt-3 w-full ${podiumHeights[i]} rounded-t-lg bg-muted/60`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
