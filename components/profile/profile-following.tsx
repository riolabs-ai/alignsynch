"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { type User, getUserFollowing } from "@/lib/data/users"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { UserCheck, UserPlus } from "lucide-react"

interface ProfileFollowingProps {
  userId: string
}

export function ProfileFollowing({ userId }: ProfileFollowingProps) {
  const [following, setFollowing] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const data = await getUserFollowing(userId)
        setFollowing(data)
      } catch (error) {
        console.error("Failed to fetch following:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFollowing()
  }, [userId])

  const handleUnfollow = (followingId: string) => {
    // In a real app, this would call an API to unfollow
    setFollowing((prev) => prev.filter((user) => user.id !== followingId))
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
          {following.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                  <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <Link href={`/profile/${user.username}`} className="font-medium hover:underline">
                    {user.name}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>@{user.username}</span>
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
              <Button variant="secondary" size="sm" onClick={() => handleUnfollow(user.id)}>
                <UserCheck className="mr-1.5 h-4 w-4" />
                Following
              </Button>
            </div>
          ))}

          {following.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <UserPlus className="mb-2 h-10 w-10 opacity-20" />
              <p>Not following anyone yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
