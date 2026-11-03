// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: five recent rows with a publish badge and an edit action, no tabs and no filters)

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelative, type PublishStatus } from "@/content/core";
import { shelfAuthoringCards } from "@/lib/quiz-cards";
import Link from "next/link";

const STATUS_LABEL: Record<PublishStatus, string> = {
  published: "Active",
  draft: "Draft",
  archived: "Completed",
};

interface RecentQuizzesProps {
  compact?: boolean;
}

export function RecentQuizzes({ compact = false }: RecentQuizzesProps) {
  // Projected from the catalogue: title, plays, creation instant and status all
  // come from the record; the prose date is derived at render (D9).
  const recentQuizzes = shelfAuthoringCards("myQuizzes")
    .slice()
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 4);

  const created = (quiz: { createdAt?: string }) =>
    quiz.createdAt ? formatRelative(quiz.createdAt) : "no date";

  if (compact) {
    return (
      <div className="space-y-4">
        {recentQuizzes.slice(0, 3).map((quiz) => (
          <div key={quiz.id} className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium text-sm">{quiz.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{quiz.plays} plays</span>
                <span>•</span>
                <span>{created(quiz)}</span>
              </div>
            </div>
            <Badge
              variant={quiz.status === "published" ? "default" : "outline"}
              className="text-xs"
            >
              {STATUS_LABEL[quiz.status]}
            </Badge>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full mt-2" asChild>
          <Link href="/my-quizzes">View All Quizzes</Link>
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Quizzes</CardTitle>
        <CardDescription>Your recently created quizzes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentQuizzes.map((quiz) => (
            <div key={quiz.id} className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">{quiz.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{quiz.plays} plays</span>
                  <span>•</span>
                  <span>{created(quiz)}</span>
                </div>
              </div>
              <Badge variant={quiz.status === "published" ? "default" : "outline"}>
                {STATUS_LABEL[quiz.status]}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/my-quizzes">View All Quizzes</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
