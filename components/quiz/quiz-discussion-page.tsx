"use client";

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryName } from "@/content/categories";
import { formatDate } from "@/content/core";
import {
  byCommentCountDesc,
  scorePercent,
  type QuizDiscussionSummary,
} from "@/content/quiz-result";
import { CheckCircle, MessageSquare, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface QuizDiscussionsPageProps {
  /** One row per quiz with a discussion — `selectQuizDiscussions`. */
  discussions: QuizDiscussionSummary[];
}

/**
 * The discussions feed.
 *
 * The three tabs used to be three module-level arrays (`recentDiscussions`,
 * `popularDiscussions`, `yourDiscussions`) that listed the same quiz up to three
 * times with three different scores and two different avatars for the same person.
 * They are now three views of one collection: activity order, comment count, and
 * the rows the viewer took part in.
 */
export function QuizDiscussionsPage({ discussions }: QuizDiscussionsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const popular = [...discussions].sort(byCommentCountDesc);
  const yours = discussions.filter((discussion) => discussion.viewerParticipated);

  return (
    <div className="container mx-auto py-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Quiz Discussions</h1>
        <p className="text-muted-foreground">
          Join discussions about quizzes, share explanations, and learn from the community.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search discussions..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Filter</Button>
          <Button variant="outline">Sort</Button>
        </div>
      </div>

      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="sm:grid  overflow-x-auto w-full sm:grid-cols-3">
          <TabsTrigger value="recent">Recent Discussions</TabsTrigger>
          <TabsTrigger value="popular">Popular Discussions</TabsTrigger>
          <TabsTrigger value="yours">Your Discussions</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-4">
            {discussions.map((discussion) => (
              <DiscussionCard key={discussion.quiz.id} discussion={discussion} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="popular" className="mt-6">
          <div className="space-y-4">
            {popular.map((discussion) => (
              <DiscussionCard key={discussion.quiz.id} discussion={discussion} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="yours" className="mt-6">
          <div className="space-y-4">
            {yours.length > 0 ? (
              yours.map((discussion) => (
                <DiscussionCard key={discussion.quiz.id} discussion={discussion} />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No discussions yet</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't participated in any quiz discussions yet.
                  </p>
                  <Button asChild>
                    <Link href="/explore">Find Quizzes to Take</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DiscussionCard({ discussion }: { discussion: QuizDiscussionSummary }) {
  const { quiz, lastComment, commentCount, lastActivityAt, result } = discussion;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "medium":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const category = quiz.categoryIds[0];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 xl:pt-6">
        <Link
          href={`/quiz/${quiz.id}/discussion`}
          className="block hover:bg-muted/50 transition-colors"
        >
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-medium">{quiz.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {category === undefined ? "—" : categoryName(category)}
                  </Badge>
                  <Badge className={getDifficultyColor(quiz.difficulty)}>{quiz.difficulty}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Last activity: {formatDate(lastActivityAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {commentCount} {commentCount === 1 ? "comment" : "comments"}
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  View Discussion
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GeneratedAvatar
                  name={lastComment.author.name}
                  seed={lastComment.author.id ?? lastComment.author.name}
                  size={32}
                />
                <span className="text-sm font-medium">{lastComment.author.name}</span>
              </div>
              {result !== undefined && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{result.score.correct}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{result.score.total - result.score.correct}</span>
                  </div>
                  <div className="text-sm font-medium">{scorePercent(result.score)}%</div>
                </div>
              )}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
