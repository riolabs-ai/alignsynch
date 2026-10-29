"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PublishStatus } from "@/content/core";
import type { QuizAuthoringCard } from "@/content/quiz";
import { shelfAuthoringCards } from "@/lib/quiz-cards";
import { Copy, Eye, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { media } from "@/data/media";

const STATUS_LABEL: Record<PublishStatus, string> = {
  published: "Active",
  draft: "Draft",
  archived: "Completed",
};

export function MyQuizzesDashboard() {
  // Projected from the catalogue + analytics; the dashboard authors no card (D2).
  const quizzes = shelfAuthoringCards("myQuizzes");
  const activeQuizzes = quizzes.filter((quiz) => quiz.status === "published");
  const draftQuizzes = quizzes.filter((quiz) => quiz.status === "draft");
  const ratedQuizzes = quizzes.filter((quiz) => quiz.rating !== undefined);

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
            <div className="text-2xl font-bold">
              {quizzes.reduce((sum, quiz) => sum + quiz.plays, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all quizzes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ratedQuizzes.length === 0
                ? "—"
                : (
                    ratedQuizzes.reduce((sum, quiz) => sum + (quiz.rating ?? 0), 0) /
                    ratedQuizzes.length
                  ).toFixed(1)}
            </div>
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
                <DashboardQuizRow key={quiz.id} quiz={quiz} />
              ))}
            </TabsContent>

            <TabsContent value="active" className="space-y-4 ">
              {activeQuizzes.map((quiz) => (
                <DashboardQuizRow key={quiz.id} quiz={quiz} />
              ))}
            </TabsContent>

            <TabsContent value="draft" className="space-y-4 ">
              {draftQuizzes.map((quiz) => (
                <DashboardQuizRow key={quiz.id} quiz={quiz} />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Was a local `QuizCard` with its own prop type — the same name as the model's
 * `QuizCard` but a different shape. It is a row over the authoring projection now.
 */
function DashboardQuizRow({ quiz }: { quiz: QuizAuthoringCard }) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-lg">
      <div className="relative w-full md:w-24 h-24 rounded-md overflow-hidden">
        <Image
          width={600}
          height={350}
          src={quiz.cover?.src ?? media.placeholder.src}
          alt={quiz.cover?.alt || quiz.title}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div>
            <h3 className="font-medium truncate">{quiz.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{quiz.categories[0]?.name ?? "Uncategorised"}</span>
              <span>•</span>
              <span>{quiz.plays} plays</span>
              {quiz.rating !== undefined && (
                <>
                  <span>•</span>
                  <span>{quiz.rating.toFixed(1)} rating</span>
                </>
              )}
            </div>
          </div>
          <div>
            <Badge variant={quiz.status === "published" ? "default" : "outline"}>
              {STATUS_LABEL[quiz.status]}
            </Badge>
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
