"use client";

import { ReviewModal } from "@/components/quiz/review-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/content/core";
import { almostFullOf, spotsLeftOf, type Quiz } from "@/content/quiz";
import { formatStopwatch, type QuizLeaderboardRow, type QuizReview } from "@/content/quiz-result";
import { ArrowLeft, Award, Bookmark, Clock, Share2, Star, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { media } from "@/data/media";

interface QuizDetailsProps {
  /** The record the route resolves to. The page owns the lookup and the 404. */
  quiz: Quiz;
  /** Top attempts for this quiz — `selectQuizLeaderboard` over `data/quiz-results.ts`. */
  leaderboard: QuizLeaderboardRow[];
  /** Authored reviews — `data/quiz-reviews.ts`. */
  reviews: QuizReview[];
  /** Same-category published records — `selectRelatedQuizzes`. */
  related: Quiz[];
  /** How many records this author has written (the creator card's "Quizzes" row). */
  authoredCount: number;
  /** `Category.name` resolved through the taxonomy — never a display literal. */
  categoryLabel: string;
}

const difficultyLabel = (difficulty: Quiz["difficulty"]): string =>
  difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

/**
 * The public quiz detail page.
 *
 * Everything below used to read a module-level `quizData` object that carried its
 * own title, description, tags, creator, five leaderboard rows, three reviews and
 * three related quizzes — none of which any fixture could change. The record now
 * arrives from the route (`/quiz/[id]`), the leaderboard is a projection over
 * results, the reviews are `data/quiz-reviews.ts`, and related quizzes are the
 * collection filtered by category. The markup is the same markup.
 */
export function QuizDetails({
  quiz,
  leaderboard,
  reviews,
  related,
  authoredCount,
  categoryLabel,
}: QuizDetailsProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  /** Reviews written in this session, newest first, ahead of the authored ones. */
  const [submitted, setSubmitted] = useState<QuizReview[]>([]);

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "success";
      case "medium":
        return "yellow";
      case "hard":
        return "destructive";
      default:
        return "default";
    }
  };

  const capacity = quiz.stats.capacity;
  const spotsLeft = spotsLeftOf(quiz.stats);
  const progressPercentage = capacity === undefined ? 0 : (quiz.stats.plays / capacity) * 100;
  const updatedAt = quiz.stats.updatedAt ?? quiz.publishedAt ?? quiz.createdAt;
  const userReviews = [...submitted, ...reviews];

  const handleReviewSubmit = (review: { rating: number; comment: string }) => {
    const newReview: QuizReview = {
      id: `local-review-${submitted.length + 1}`,
      quizId: quiz.id,
      author: {
        id: "current-user",
        name: "You",
        avatar: { src: media["avatars.master"].src, alt: "You" },
      },
      rating: review.rating,
      body: review.comment,
      createdAt: new Date().toISOString(),
    };
    setSubmitted([newReview, ...submitted]);
  };
  const route = useRouter();
  const playNow = () => {
    route.push(`/quiz/${quiz.id}/play`);
  };
  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/explore" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Link>
        </Button>

        <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-6">
          <Image
            src={quiz.cover?.src ?? media.placeholder.src}
            alt={quiz.title}
            className="w-full h-full object-cover"
            fill
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4 md:p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={getDifficultyVariant(quiz.difficulty)}>
                {difficultyLabel(quiz.difficulty)}
              </Badge>
              {quiz.featured && (
                <Badge variant="secondary" className="bg-purple-500/80 text-white border-0">
                  Featured
                </Badge>
              )}
              {quiz.stats.badge && (
                <Badge variant="secondary" className="bg-blue-500/80 text-white border-0">
                  {quiz.stats.badge.label}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
              {quiz.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-white/90">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {quiz.settings.timeLimitSeconds === 0
                    ? "No time limit"
                    : `${Math.round(quiz.settings.timeLimitSeconds / 60)} min`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{quiz.stats.plays} players</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span>{quiz.questions.length} questions</span>
              </div>
              {quiz.stats.rating !== undefined && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>
                    {quiz.stats.rating}
                    {quiz.stats.ratingCount !== undefined
                      ? ` (${quiz.stats.ratingCount} ratings)`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground">{quiz.summary}</p>
                </div>

                {quiz.requirements !== undefined && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Requirements</h2>
                    <p className="text-muted-foreground">{quiz.requirements}</p>
                  </div>
                )}

                {quiz.tags.length > 0 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                      {quiz.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-semibold mb-4">Related Quizzes</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {related.map((candidate) => (
                      <Card key={candidate.id} className="overflow-hidden">
                        <div className="relative h-32">
                          <Image
                            width={600}
                            height={350}
                            src={candidate.cover?.src ?? media.placeholder.src}
                            alt={candidate.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                            <div>
                              <Badge
                                variant={getDifficultyVariant(candidate.difficulty)}
                                className="mb-1"
                              >
                                {difficultyLabel(candidate.difficulty)}
                              </Badge>
                              <h3 className="text-sm font-medium text-white">{candidate.title}</h3>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="leaderboard" className="mt-6">
                <div className="rounded-md border">
                  <div className="grid grid-cols-12 bg-muted/50 p-3 text-sm font-medium">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">Player</div>
                    <div className="col-span-3 text-center">Score</div>
                    <div className="col-span-3 text-center">Time</div>
                  </div>
                  {leaderboard.map((player) => (
                    <div key={player.rank} className="grid grid-cols-12 p-3 text-sm border-t">
                      <div className="col-span-1 text-center font-medium">{player.rank}</div>
                      <div className="col-span-5 flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={player.player.avatar?.src ?? media.placeholder.src}
                            alt={player.player.name}
                          />
                          <AvatarFallback>{player.player.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span>{player.player.name}</span>
                      </div>
                      <div className="col-span-3 text-center">{player.percent}%</div>
                      <div className="col-span-3 text-center">
                        {formatStopwatch(player.seconds)}
                      </div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground border-t">
                      No completed attempts yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Reviews</h2>
                  <Button onClick={() => setIsReviewModalOpen(true)}>Write a Review</Button>
                </div>

                {userReviews.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">
                        No reviews yet. Be the first to review!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  userReviews.map((review) => (
                    <Card key={review.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarImage
                              src={review.author.avatar?.src ?? media.placeholder.src}
                              alt={review.author.name}
                            />
                            <AvatarFallback>{review.author.name.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium">{review.author.name}</h3>
                              <div className="flex items-center">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-muted-foreground text-sm mt-1">{review.body}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Card>
              <CardContent className="p-6 space-y-6">
                {capacity !== undefined && spotsLeft !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Spots filled</span>
                      <span className="text-sm font-medium">
                        {quiz.stats.plays}/{capacity}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    {almostFullOf(quiz.stats) && (
                      <p className="text-xs font-medium text-destructive">
                        Almost full! Only {spotsLeft} spots left
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Category</div>
                    <div className="font-medium">{categoryLabel}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Questions</div>
                    <div className="font-medium">{quiz.questions.length}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Time Limit</div>
                    <div className="font-medium">
                      {quiz.settings.timeLimitSeconds === 0
                        ? "No limit"
                        : `${Math.round(quiz.settings.timeLimitSeconds / 60)} min`}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
                    <div className="font-medium">{difficultyLabel(quiz.difficulty)}</div>
                  </div>
                </div>

                {quiz.author !== undefined && (
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={quiz.author.avatar?.src ?? media.placeholder.src}
                          alt={quiz.author.name}
                        />
                        <AvatarFallback>{quiz.author.name.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{quiz.author.name}</div>
                        {quiz.author.role !== undefined && (
                          <div className="text-xs text-muted-foreground">{quiz.author.role}</div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Quizzes: </span>
                        <span className="font-medium">{authoredCount}</span>
                      </div>
                      {updatedAt !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Updated: </span>
                          <span className="font-medium">{formatDate(updatedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Button onClick={playNow} className="w-full" size="lg">
                    Play Now
                  </Button>

                  <div className="flex justify-center gap-3">
                    <Button variant="outline" size="icon" className="aspect-square">
                      <Bookmark className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="aspect-square">
                      <Share2 className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="aspect-square">
                      <Award className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleReviewSubmit}
        quizTitle={quiz.title}
      />
    </div>
  );
}
