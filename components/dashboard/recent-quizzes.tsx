import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

// Sample data
const recentQuizzes = [
  {
    id: 1,
    title: "World Geography Challenge",
    plays: 42,
    date: "2 days ago",
    status: "active",
  },
  {
    id: 2,
    title: "Science Quiz: Space Exploration",
    plays: 28,
    date: "5 days ago",
    status: "active",
  },
  {
    id: 3,
    title: "History: Ancient Civilizations",
    plays: 15,
    date: "1 week ago",
    status: "active",
  },
  {
    id: 4,
    title: "Math Puzzles & Problems",
    plays: 8,
    date: "2 weeks ago",
    status: "draft",
  },
];

interface RecentQuizzesProps {
  compact?: boolean;
}

export function RecentQuizzes({ compact = false }: RecentQuizzesProps) {
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
                <span>{quiz.date}</span>
              </div>
            </div>
            <Badge variant={quiz.status === "active" ? "default" : "outline"} className="text-xs">
              {quiz.status === "active" ? "Active" : "Draft"}
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
                  <span>{quiz.date}</span>
                </div>
              </div>
              <Badge variant={quiz.status === "active" ? "default" : "outline"}>{quiz.status === "active" ? "Active" : "Draft"}</Badge>
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
