"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { type User, getUserFollowers } from "@/lib/data/users"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { UserCheck, UserPlus, Users } from "lucide-react"

interface ProfileFollowersProps {
  userId: string
}

export function ProfileFollowers({ userId }: ProfileFollowersProps) {
  const [followers, setFollowers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        const data = await getUserFollowers(userId)
        setFollowers(data)

        // Initialize following status
        const initialStatus: Record<string, boolean> = {}
        data.forEach((follower) => {
          initialStatus[follower.id] = Math.random() > 0.5 // Random for demo
        })
        setFollowingStatus(initialStatus)
      } catch (error) {
        console.error("Failed to fetch followers:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFollowers()
  }, [userId])

  const handleFollowToggle = (followerId: string) => {
    setFollowingStatus((prev) => ({
      ...prev,
      [followerId]: !prev[followerId],
    }))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {followers.map((follower) => (
            <div key={follower.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={follower.avatar || "/placeholder.svg"} alt={follower.name} />
                  <AvatarFallback>{follower.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <Link href={`/profile/${follower.username}`} className="font-medium hover:underline">
                    {follower.name}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>@{follower.username}</span>
                    {follower.isVerified && (
                      <Badge variant="secondary" className="h-5 gap-1 px-1.5 py-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3 text-blue-500"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant={followingStatus[follower.id] ? "secondary" : "outline"}
                size="sm"
                onClick={() => handleFollowToggle(follower.id)}
              >
                {followingStatus[follower.id] ? (
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
            </div>
          ))}

          {followers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Users className="mb-2 h-10 w-10 opacity-20" />
              <p>No followers yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
