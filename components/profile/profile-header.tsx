"use client";

import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/content/core";
import type { User } from "@/lib/data/users";
import type { ProfilePerson } from "@/lib/profile";
import { CalendarDays, Flag, MessageSquare, Star, UserCheck, UserPlus } from "lucide-react";

interface ProfileHeaderProps {
  /** Identity and standing from `data/players.ts` — always present. */
  person: ProfilePerson;
  /** The `/profile` detail record when the fixture authors one; `null` otherwise. */
  detail: User | null;
  isFollowing: boolean;
  onFollowToggle: () => void;
  onMessageClick: () => void;
}

/**
 * Counts are formatted with an explicit locale and an em dash for "not measured": two of the
 * ten players carry no follower totals, and `0` would be a claim the fixture does not make.
 * The join date goes through `formatDate` (UTC-pinned) rather than `toLocaleDateString()`,
 * which renders a different day on a server in UTC and a browser west of it.
 */
const COUNT = new Intl.NumberFormat("en-US");

function count(value: number | undefined): string {
  return value === undefined ? "—" : COUNT.format(value);
}

export function ProfileHeader({
  person,
  detail,
  isFollowing,
  onFollowToggle,
  onMessageClick,
}: ProfileHeaderProps) {
  const joinedDate = detail?.joinedDate ? formatDate(detail.joinedDate) : undefined;

  return (
    <div className="rounded-xl bg-gradient-to-r from-purple-100 to-blue-100 p-6 shadow-sm dark:from-purple-950/30 dark:to-blue-950/30">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Media
          alt={person.name}
          className="border-4 border-background"
          height={96}
          kind={FALLBACK_KIND.avatar}
          seed={person.id}
          width={96}
        />

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{person.name}</h1>
            {detail?.isVerified && (
              <Badge variant="secondary" className="h-5 gap-1 px-1.5 py-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 text-blue-500"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Verified</span>
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-xs">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Level {person.level}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>@{person.handle}</span>
            {person.country && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Flag className="h-3.5 w-3.5" />
                  <span>{person.country}</span>
                </div>
              </>
            )}
            {joinedDate && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Joined {joinedDate}</span>
                </div>
              </>
            )}
          </div>

          {detail?.bio && <p className="mt-2 text-sm">{detail.bio}</p>}

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-semibold">{count(person.quizzesTaken)}</span>
              <span className="ml-1 text-muted-foreground">Quizzes Taken</span>
            </div>
            <div>
              <span className="font-semibold">{count(detail?.quizzesCreated)}</span>
              <span className="ml-1 text-muted-foreground">Quizzes Created</span>
            </div>
            <div>
              <span className="font-semibold">{count(person.followers)}</span>
              <span className="ml-1 text-muted-foreground">Followers</span>
            </div>
            <div>
              <span className="font-semibold">{count(person.following)}</span>
              <span className="ml-1 text-muted-foreground">Following</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 self-start sm:self-center">
          <Button
            variant={isFollowing ? "secondary" : "default"}
            size="sm"
            onClick={onFollowToggle}
          >
            {isFollowing ? (
              <>
                <UserCheck className="mr-1.5 h-4 w-4" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Follow
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onMessageClick}>
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Message
          </Button>
        </div>
      </div>
    </div>
  );
}
