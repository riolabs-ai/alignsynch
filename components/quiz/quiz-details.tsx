"use client";

import { ReviewModal } from "@/components/quiz/review-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Award, Bookmark, Clock, Share2, Star, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Sample quiz data - in a real app, you would fetch this based on the ID
const quizData = {
  id: "1",
  title: "Space Exploration Quiz",
  image: "/quiz/q17.png",
  category: "Science & Technology",
  difficulty: "Medium",
  timeLimit: 20,
  reward: "$5.00",
  players: 285,
  maxPlayers: 300,
  spotsLeft: 15,
  questions: 25,
  rating: 4.8,
  ratingCount: 156,
  description: "Test your knowledge of the Space Exploration with this comprehensive trivia quiz. From Iron Man to the latest releases, this quiz covers characters, plot points, Easter eggs, and behind-the-scenes facts that only true fans would know.",
  requirements: "Basic knowledge of Marvel movies and TV shows. No specific preparation needed.",
  creator: {
    name: "MarvelFan2023",
    avatar: "/avatars/alex.png",
    level: "Expert Quiz Creator",
    quizzes: 42,
    lastUpdate: "2023-10-15",
  },
  tags: ["Marvel", "Superheroes", "Movies", "MCU", "Avengers"],
  leaderboard: [
    { rank: 1, name: "ThorFan", avatar: "/avatars/wizard.webp", score: 98, time: "12:45" },
    { rank: 2, name: "IronManRules", avatar: "/avatars/sarah.webp", score: 95, time: "13:20" },
    { rank: 3, name: "CaptainAmerica", avatar: "/avatars/king.webp", score: 92, time: "14:05" },
    { rank: 4, name: "BlackWidow", avatar: "/avatars/champion.png", score: 90, time: "15:30" },
    { rank: 5, name: "HulkSmash", avatar: "/avatars/mind.webp", score: 88, time: "16:15" },
  ],
  reviews: [
    {
      name: "MarvelFan",
      avatar: "/avatars/genious.png",
      rating: 5,
      comment: "Excellent quiz! Really tests your knowledge of the MCU.",
    },
    {
      name: "QuizLover",
      avatar: "/avatars/brain.png",
      rating: 4,
      comment: "Good variety of questions, some were quite challenging.",
    },
    {
      name: "Avenger",
      avatar: "/avatars/guru.png",
      rating: 5,
      comment: "Perfect for Marvel fans. I learned some new facts too!",
    },
  ],
  relatedQuizzes: [
    { id: 2, title: "DC Extended Universe Quiz", image: "/world-landmarks.png", difficulty: "Hard" },
    { id: 3, title: "Star Wars Saga Trivia", image: "/brain-teasers-puzzles.png", difficulty: "Medium" },
    { id: 4, title: "Harry Potter Wizarding World", image: "/history-mysteries.png", difficulty: "Easy" },
  ],
};

export function QuizDetails({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [userReviews, setUserReviews] = useState(quizData.reviews);

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "success";
      case "Medium":
        return "yellow";
      case "Hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Calculate progress percentage
  const progressPercentage = (quizData.players / quizData.maxPlayers) * 100;

  const handleReviewSubmit = (review: { rating: number; comment: string }) => {
    const newReview = {
      name: "You",
      avatar: "/avatars/master.png",
      rating: review.rating,
      comment: review.comment,
    };
    setUserReviews([newReview, ...userReviews]);
  };
  const route = useRouter();
  const playNow = () => {
    route.push(`/quiz/${id}/play`);
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
          <Image src={quizData.image || "/placeholder.svg"} alt={quizData.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4 md:p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={getDifficultyVariant(quizData.difficulty)}>{quizData.difficulty}</Badge>
              <Badge variant="secondary" className="bg-purple-500/80 text-white border-0">
                Featured
              </Badge>
              <Badge variant="secondary" className="bg-blue-500/80 text-white border-0">
                Popular
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">{quizData.title}</h1>
            <div className="flex flex-wrap gap-4 text-white/90">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{quizData.timeLimit} min</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{quizData.players} players</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span>{quizData.questions} questions</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>
                  {quizData.rating} ({quizData.ratingCount} ratings)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground">{quizData.description}</p>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">Requirements</h2>
                  <p className="text-muted-foreground">{quizData.requirements}</p>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {quizData.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-4">Related Quizzes</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {quizData.relatedQuizzes.map((quiz) => (
                      <Card key={quiz.id} className="overflow-hidden">
                        <div className="relative h-32">
                          <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                            <div>
                              <Badge variant={getDifficultyVariant(quiz.difficulty)} className="mb-1">
                                {quiz.difficulty}
                              </Badge>
                              <h3 className="text-sm font-medium text-white">{quiz.title}</h3>
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
                  {quizData.leaderboard.map((player) => (
                    <div key={player.rank} className="grid grid-cols-12 p-3 text-sm border-t">
                      <div className="col-span-1 text-center font-medium">{player.rank}</div>
                      <div className="col-span-5 flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={player.avatar || "/placeholder.svg"} alt={player.name} />
                          <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span>{player.name}</span>
                      </div>
                      <div className="col-span-3 text-center">{player.score}%</div>
                      <div className="col-span-3 text-center">{player.time}</div>
                    </div>
                  ))}
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
                      <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                    </CardContent>
                  </Card>
                ) : (
                  userReviews.map((review, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarImage src={review.avatar || "/placeholder.svg"} alt={review.name} />
                            <AvatarFallback>{review.name.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium">{review.name}</h3>
                              <div className="flex items-center">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                                ))}
                              </div>
                            </div>
                            <p className="text-muted-foreground text-sm mt-1">{review.comment}</p>
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
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Spots filled</span>
                    <span className="text-sm font-medium">
                      {quizData.players}/{quizData.maxPlayers}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  {quizData.spotsLeft <= 20 && <p className="text-xs font-medium text-destructive">Almost full! Only {quizData.spotsLeft} spots left</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Category</div>
                    <div className="font-medium">{quizData.category}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Questions</div>
                    <div className="font-medium">{quizData.questions}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Time Limit</div>
                    <div className="font-medium">{quizData.timeLimit} min</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
                    <div className="font-medium">{quizData.difficulty}</div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={quizData.creator.avatar || "/placeholder.svg"} alt={quizData.creator.name} />
                      <AvatarFallback>{quizData.creator.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{quizData.creator.name}</div>
                      <div className="text-xs text-muted-foreground">{quizData.creator.level}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Quizzes: </span>
                      <span className="font-medium">{quizData.creator.quizzes}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated: </span>
                      <span className="font-medium">{quizData.creator.lastUpdate}</span>
                    </div>
                  </div>
                </div>

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
      <ReviewModal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} onSubmit={handleReviewSubmit} quizTitle={quizData.title} />
    </div>
  );
}
