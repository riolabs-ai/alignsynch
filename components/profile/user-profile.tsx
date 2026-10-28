"use client";
import { MessageModal } from "@/components/profile/message-modal";
import { ProfileAchievements } from "@/components/profile/profile-achievements";
import { ProfileActivity } from "@/components/profile/profile-activity";
import { ProfileCreatedQuizzes } from "@/components/profile/profile-created-quizzes";
import { ProfileFollowers } from "@/components/profile/profile-followers";
import { ProfileFollowing } from "@/components/profile/profile-following";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileQuizHistory } from "@/components/profile/profile-quiz-history";
import { ProfileStats } from "@/components/profile/profile-stats";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@/lib/data/users";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const handleFollowToggle = () => {
    // In a real app, this would call an API to follow/unfollow
    setIsFollowing(!isFollowing);
  };

  return (
    <div className="container mx-auto max-w-6xl py-6">
      <div className="mb-6">
        <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to Leaderboard
        </Link>
      </div>

      <ProfileHeader user={user} isFollowing={isFollowing} onFollowToggle={handleFollowToggle} onMessageClick={() => setIsMessageModalOpen(true)} />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes Taken</TabsTrigger>
              <TabsTrigger value="created">Created Quizzes</TabsTrigger>
              <TabsTrigger value="followers">Followers</TabsTrigger>
              <TabsTrigger value="following">Following</TabsTrigger>
            </TabsList>
            <TabsContent value="activity" className="mt-4">
              <ProfileActivity activities={user.recentActivity} />
            </TabsContent>
            <TabsContent value="quizzes" className="mt-4">
              <ProfileQuizHistory quizHistory={user.quizHistory} />
            </TabsContent>
            <TabsContent value="created" className="mt-4">
              <ProfileCreatedQuizzes user={user} />
            </TabsContent>
            <TabsContent value="followers" className="mt-4">
              <ProfileFollowers userId={user.id} />
            </TabsContent>
            <TabsContent value="following" className="mt-4">
              <ProfileFollowing userId={user.id} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <ProfileStats stats={user.stats} />
          <ProfileAchievements achievements={user.achievements} />

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold">Contact</h3>
            <Button variant="outline" className="w-full" onClick={() => setIsMessageModalOpen(true)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </div>
        </div>
      </div>

      <MessageModal isOpen={isMessageModalOpen} onClose={() => setIsMessageModalOpen(false)} recipient={user} />
    </div>
  );
}
