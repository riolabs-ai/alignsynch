import Link from "next/link"
import type { QuizHistoryItem } from "@/lib/data/users"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, FileQuestion } from "lucide-react"

interface ProfileQuizHistoryProps {
  quizHistory: QuizHistoryItem[]
}

export function ProfileQuizHistory({ quizHistory }: ProfileQuizHistoryProps) {
  const formatTimeSpent = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "medium":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 90) return "bg-green-500"
    if (percentage >= 70) return "bg-amber-500"
    return "bg-red-500"
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {quizHistory.map((quiz) => (
            <div key={quiz.id} className="p-4">
              <div className="flex items-center justify-between">
                <Link href={`/quiz/${quiz.quizId}`} className="font-medium hover:underline">
                  {quiz.quizName}
                </Link>
                <Badge className={getDifficultyColor(quiz.difficulty)} variant="secondary">
                  {quiz.difficulty}
                </Badge>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{quiz.category}</Badge>
                  <span className="text-muted-foreground">{formatDate(quiz.completedAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatTimeSpent(quiz.timeSpent)}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Score</span>
                  <span>
                    {quiz.score} / {quiz.maxScore} ({Math.round((quiz.score / quiz.maxScore) * 100)}%)
                  </span>
                </div>
                <Progress
                  value={(quiz.score / quiz.maxScore) * 100}
                  className={`h-2 ${getScoreColor(quiz.score, quiz.maxScore)}`}
                />
              </div>
            </div>
          ))}

          {quizHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <FileQuestion className="mb-2 h-10 w-10 opacity-20" />
              <p>No quiz history</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
