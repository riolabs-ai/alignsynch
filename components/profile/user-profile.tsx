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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlayerProfile } from "@/lib/profile";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface UserProfileProps {
  /** One resolved `/profile/<handle>`, from `lib/profile.ts` — never a literal here. */
  profile: PlayerProfile;
  /**
   * The gated hrefs the shell must not draw, resolved on the server by
   * `lib/flags.ts::hiddenNavHrefs()` (#175 follow-up).
   *
   * Required, and a list rather than a boolean, so this component speaks the same vocabulary as
   * the sidebar and the footer: the page decides once, and every surface it mounts reads the one
   * answer. This module is `"use client"`, so it cannot resolve the flag itself.
   */
  hiddenNav: readonly string[];
}

const COUNT = new Intl.NumberFormat("en-US");

export function UserProfile({ profile, hiddenNav }: UserProfileProps) {
  const { person, detail } = profile;
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const handleFollowToggle = () => {
    // In a real app, this would call an API to follow/unfollow
    setIsFollowing(!isFollowing);
  };

  return (
    <div className="container mx-auto max-w-6xl py-6">
      {/* The back-link is this page's only leaderboard reference: a demo person is reached from
          the board, so with `community.leaderboard` off (#175 follow-up) it is not drawn — the
          header beneath already says whose page this is, and inventing a replacement destination
          would advertise a surface that answers 404. */}
      {!hiddenNav.includes("/leaderboard") && (
        <div className="mb-6">
          <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-primary">
            ← Back to Leaderboard
          </Link>
        </div>
      )}

      <ProfileHeader
        person={person}
        detail={detail}
        isFollowing={isFollowing}
        onFollowToggle={handleFollowToggle}
        onMessageClick={() => setIsMessageModalOpen(true)}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {detail ? (
            <Tabs defaultValue="activity" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes Taken</TabsTrigger>
                <TabsTrigger value="created">Created Quizzes</TabsTrigger>
                <TabsTrigger value="followers">Followers</TabsTrigger>
                <TabsTrigger value="following">Following</TabsTrigger>
              </TabsList>
              <TabsContent value="activity" className="mt-4">
                <ProfileActivity activities={detail.recentActivity} />
              </TabsContent>
              <TabsContent value="quizzes" className="mt-4">
                <ProfileQuizHistory quizHistory={detail.quizHistory} />
              </TabsContent>
              <TabsContent value="created" className="mt-4">
                <ProfileCreatedQuizzes user={detail} />
              </TabsContent>
              <TabsContent value="followers" className="mt-4">
                <ProfileFollowers userId={person.id} />
              </TabsContent>
              <TabsContent value="following" className="mt-4">
                <ProfileFollowing userId={person.id} />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Activity, quiz history, created quizzes, achievements and performance stats are
                  per-player fixture records. None are authored for @{person.handle} yet, so only
                  the standing below is shown.
                </p>
                {person.rank !== undefined && person.score !== undefined && (
                  <p className="font-medium text-foreground">
                    Global rank #{person.rank} · {COUNT.format(person.score)} points
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {detail ? (
            <>
              <ProfileStats stats={detail.stats} />
              <ProfileAchievements achievements={detail.achievements} />
            </>
          ) : null}

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold">Contact</h3>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsMessageModalOpen(true)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </div>
        </div>
      </div>

      <MessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        recipient={{ name: person.name, seed: person.id }}
      />
    </div>
  );
}
