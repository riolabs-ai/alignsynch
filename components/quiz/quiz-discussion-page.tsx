"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, MessageSquare, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
type Discussion = {
  id: string;
  quizId: string;
  quizTitle: string;
  lastActivity: string;
  totalComments: number;
  score: {
    correct: number;
    total: number;
  };
  category: string;
  difficulty: string;
  user: {
    name: string;
    avatar: string;
  };
};
// Mock data for recent discussions
const recentDiscussions: Discussion[] = [
  {
    id: "1",
    quizId: "1",
    quizTitle: "Space Exploration Quiz",
    lastActivity: "2023-10-18T14:30:00Z",
    totalComments: 24,
    score: {
      correct: 7,
      total: 10,
    },
    category: "Entertainment",
    difficulty: "Medium",
    user: {
      name: "MarvelFan",
      avatar: "/avatars/alex.png",
    },
  },
  {
    id: "2",
    quizId: "2",
    quizTitle: "World Geography Challenge",
    lastActivity: "2023-10-17T10:15:00Z",
    totalComments: 18,
    score: {
      correct: 8,
      total: 10,
    },
    category: "Education",
    difficulty: "Hard",
    user: {
      name: "GeoExpert",
      avatar: "/avatars/mind.webp",
    },
  },
  {
    id: "3",
    quizId: "3",
    quizTitle: "History of Ancient Civilizations",
    lastActivity: "2023-10-16T09:45:00Z",
    totalComments: 32,
    score: {
      correct: 6,
      total: 10,
    },
    category: "History",
    difficulty: "Medium",
    user: {
      name: "HistoryBuff",
      avatar: "/avatars/sarah.webp",
    },
  },
  {
    id: "4",
    quizId: "4",
    quizTitle: "Science and Technology Trivia",
    lastActivity: "2023-10-15T16:20:00Z",
    totalComments: 15,
    score: {
      correct: 9,
      total: 10,
    },
    category: "Science",
    difficulty: "Easy",
    user: {
      name: "TechWiz",
      avatar: "/avatars/wizard.webp",
    },
  },
  {
    id: "5",
    quizId: "5",
    quizTitle: "Pop Culture Quiz 2023",
    lastActivity: "2023-10-14T11:30:00Z",
    totalComments: 27,
    score: {
      correct: 5,
      total: 10,
    },
    category: "Entertainment",
    difficulty: "Easy",
    user: {
      name: "PopCultureFan",
      avatar: "/avatars/king.webp",
    },
  },
];

// Mock data for popular discussions
const popularDiscussions = [
  {
    id: "6",
    quizId: "6",
    quizTitle: "Harry Potter Wizarding World",
    lastActivity: "2023-10-13T13:45:00Z",
    totalComments: 56,
    score: {
      correct: 8,
      total: 10,
    },
    category: "Entertainment",
    difficulty: "Medium",
    user: {
      name: "WizardingExpert",
      avatar: "/avatars/wizard.webp",
    },
  },
  {
    id: "7",
    quizId: "7",
    quizTitle: "Mathematical Puzzles and Problems",
    lastActivity: "2023-10-12T09:15:00Z",
    totalComments: 42,
    score: {
      correct: 7,
      total: 10,
    },
    category: "Education",
    difficulty: "Hard",
    user: {
      name: "MathGenius",
      avatar: "/avatars/mind.webp",
    },
  },
  {
    id: "3",
    quizId: "3",
    quizTitle: "History of Ancient Civilizations",
    lastActivity: "2023-10-16T09:45:00Z",
    totalComments: 32,
    score: {
      correct: 6,
      total: 10,
    },
    category: "History",
    difficulty: "Medium",
    user: {
      name: "HistoryBuff",
      avatar: "/avatars/guru.png",
    },
  },
  {
    id: "8",
    quizId: "8",
    quizTitle: "Famous Paintings and Artists",
    lastActivity: "2023-10-11T14:30:00Z",
    totalComments: 29,
    score: {
      correct: 9,
      total: 10,
    },
    category: "Art",
    difficulty: "Medium",
    user: {
      name: "ArtLover",
      avatar: "/avatars/sarah.webp",
    },
  },
  {
    id: "9",
    quizId: "9",
    quizTitle: "World Cuisines and Food",
    lastActivity: "2023-10-10T10:45:00Z",
    totalComments: 38,
    score: {
      correct: 8,
      total: 10,
    },
    category: "Food",
    difficulty: "Easy",
    user: {
      name: "FoodieExplorer",
      avatar: "/avatars/champion.png",
    },
  },
];

// Mock data for your discussions
const yourDiscussions = [
  {
    id: "1",
    quizId: "1",
    quizTitle: "Space Exploration Quiz",
    lastActivity: "2023-10-18T14:30:00Z",
    totalComments: 24,
    score: {
      correct: 7,
      total: 10,
    },
    category: "Entertainment",
    difficulty: "Medium",
    user: {
      name: "You",
      avatar: "/avatars/sarah.webp",
    },
  },
  {
    id: "4",
    quizId: "4",
    quizTitle: "Science and Technology Trivia",
    lastActivity: "2023-10-15T16:20:00Z",
    totalComments: 15,
    score: {
      correct: 9,
      total: 10,
    },
    category: "Science",
    difficulty: "Easy",
    user: {
      name: "You",
      avatar: "/avatars/wizard.webp",
    },
  },
  {
    id: "7",
    quizId: "7",
    quizTitle: "Mathematical Puzzles and Problems",
    lastActivity: "2023-10-12T09:15:00Z",
    totalComments: 42,
    score: {
      correct: 7,
      total: 10,
    },
    category: "Education",
    difficulty: "Hard",
    user: {
      name: "You",
      avatar: "/avatars/king.webp",
    },
  },
];

export function QuizDiscussionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recent");

  return (
    <div className="container mx-auto py-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Quiz Discussions</h1>
        <p className="text-muted-foreground">Join discussions about quizzes, share explanations, and learn from the community.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search discussions..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Filter</Button>
          <Button variant="outline">Sort</Button>
        </div>
      </div>

      <Tabs defaultValue="recent" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="sm:grid  overflow-x-auto w-full sm:grid-cols-3">
          <TabsTrigger value="recent">Recent Discussions</TabsTrigger>
          <TabsTrigger value="popular">Popular Discussions</TabsTrigger>
          <TabsTrigger value="yours">Your Discussions</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-4">
            {recentDiscussions.map((discussion) => (
              <DiscussionCard key={discussion.id} discussion={discussion} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="popular" className="mt-6">
          <div className="space-y-4">
            {popularDiscussions.map((discussion) => (
              <DiscussionCard key={discussion.id} discussion={discussion} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="yours" className="mt-6">
          <div className="space-y-4">
            {yourDiscussions.length > 0 ? (
              yourDiscussions.map((discussion) => <DiscussionCard key={discussion.id} discussion={discussion} />)
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No discussions yet</h3>
                  <p className="text-muted-foreground mb-4">You haven't participated in any quiz discussions yet.</p>
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

function DiscussionCard({ discussion }: { discussion: Discussion }) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 xl:pt-6">
        <Link href={`/quiz/${discussion.id}/discussion`} className="block hover:bg-muted/50 transition-colors">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-medium">{discussion.quizTitle}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline">{discussion.category}</Badge>
                  <Badge className={getDifficultyColor(discussion.difficulty)}>{discussion.difficulty}</Badge>
                  <span className="text-sm text-muted-foreground">Last activity: {formatDate(discussion.lastActivity)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>{discussion.totalComments} comments</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  View Discussion
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={discussion.user.avatar || "/placeholder.svg"} alt={discussion.user.name} />
                  <AvatarFallback>{discussion.user.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{discussion.user.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{discussion.score.correct}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>{discussion.score.total - discussion.score.correct}</span>
                </div>
                <div className="text-sm font-medium">{Math.round((discussion.score.correct / discussion.score.total) * 100)}%</div>
              </div>
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
