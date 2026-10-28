"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Eye, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
type Quiz = {
  id: number;
  title: string;
  category: string;
  plays: number;
  rating: number;
  date: string;
  status: string;
  image: string;
};
// Sample data
const quizzes: Quiz[] = [
  {
    id: 1,
    title: "World Geography Challenge",
    category: "Geography",
    plays: 42,
    rating: 4.7,
    date: "2023-05-15",
    status: "active",
    image: "/world-map-quiz.png",
  },
  {
    id: 2,
    title: "Science Quiz: Space Exploration",
    category: "Science",
    plays: 28,
    rating: 4.5,
    date: "2023-05-10",
    status: "active",
    image: "/space-exploration-quiz.png",
  },
  {
    id: 3,
    title: "History: Ancient Civilizations",
    category: "History",
    plays: 15,
    rating: 4.2,
    date: "2023-05-03",
    status: "active",
    image: "/ancient-civilizations-quiz.png",
  },
  {
    id: 4,
    title: "Math Puzzles & Problems",
    category: "Mathematics",
    plays: 8,
    rating: 3.9,
    date: "2023-04-28",
    status: "draft",
    image: "/math-puzzles-quiz.png",
  },
  {
    id: 5,
    title: "Literature: Classic Novels",
    category: "Literature",
    plays: 0,
    rating: 0,
    date: "2023-04-25",
    status: "draft",
    image: "/classic-novels-quiz.png",
  },
];

export function MyQuizzesDashboard() {
  const [activeQuizzes, setActiveQuizzes] = useState(quizzes.filter((q) => q.status === "active"));
  const [draftQuizzes, setDraftQuizzes] = useState(quizzes.filter((q) => q.status === "draft"));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizzes.length}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeQuizzes.length}</div>
            <p className="text-xs text-muted-foreground">Published and visible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizzes.reduce((sum, quiz) => sum + quiz.plays, 0)}</div>
            <p className="text-xs text-muted-foreground">Across all quizzes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(quizzes.reduce((sum, quiz) => sum + quiz.rating, 0) / quizzes.filter((q) => q.rating > 0).length).toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Out of 5.0</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Quizzes</CardTitle>
          <CardDescription>Manage and monitor all your created quizzes</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Quizzes</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 ">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </TabsContent>

            <TabsContent value="active" className="space-y-4 ">
              {activeQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </TabsContent>

            <TabsContent value="draft" className="space-y-4 ">
              {draftQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function QuizCard({ quiz }: { quiz: Quiz }) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-lg">
      <div className="relative w-full md:w-24 h-24 rounded-md overflow-hidden">
        <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} fill className="object-cover" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div>
            <h3 className="font-medium truncate">{quiz.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{quiz.category}</span>
              <span>•</span>
              <span>{quiz.plays} plays</span>
              {quiz.rating > 0 && (
                <>
                  <span>•</span>
                  <span>{quiz.rating.toFixed(1)} rating</span>
                </>
              )}
            </div>
          </div>
          <div>
            <Badge variant={quiz.status === "active" ? "default" : "outline"}>{quiz.status === "active" ? "Active" : "Draft"}</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/quiz/${quiz.id}`}>
            <Eye className="mr-1 h-3 w-3" />
            View
          </Link>
        </Button>
        <Button variant="outline" size="sm">
          <Copy className="mr-1 h-3 w-3" />
          Clone
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}
