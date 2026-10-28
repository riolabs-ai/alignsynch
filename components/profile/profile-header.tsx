"use client"

import type { User } from "@/lib/data/users"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Flag, MessageSquare, Star, UserCheck, UserPlus } from "lucide-react"

interface ProfileHeaderProps {
  user: User
  isFollowing: boolean
  onFollowToggle: () => void
  onMessageClick: () => void
}

export function ProfileHeader({ user, isFollowing, onFollowToggle, onMessageClick }: ProfileHeaderProps) {
  const joinedDate = new Date(user.joinedDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="rounded-xl bg-gradient-to-r from-purple-100 to-blue-100 p-6 shadow-sm dark:from-purple-950/30 dark:to-blue-950/30">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Avatar className="h-24 w-24 border-4 border-background">
          <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
          <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            {user.isVerified && (
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
              Level {user.level}
            </Badge>
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>@{user.username}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Flag className="h-3.5 w-3.5" />
              <span>{user.country}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Joined {joinedDate}</span>
            </div>
          </div>

          <p className="mt-2 text-sm">{user.bio}</p>

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-semibold">{user.quizzesTaken.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">Quizzes Taken</span>
            </div>
            <div>
              <span className="font-semibold">{user.quizzesCreated.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">Quizzes Created</span>
            </div>
            <div>
              <span className="font-semibold">{user.followers.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">Followers</span>
            </div>
            <div>
              <span className="font-semibold">{user.following.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">Following</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 self-start sm:self-center">
          <Button variant={isFollowing ? "secondary" : "default"} size="sm" onClick={onFollowToggle}>
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
  )
}
