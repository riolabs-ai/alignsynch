"use client";

import { QuestionDiscussion } from "@/components/quiz/question-discussion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/content/core";
import type { Quiz } from "@/content/quiz";
import {
  formatDurationWords,
  type QuizCommentThread,
  type QuizResult,
} from "@/content/quiz-result";
import { ArrowLeft, CheckCircle, Clock, RotateCw, Share2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface QuizDiscussionProps {
  /** The quiz record the review belongs to. */
  quiz: Quiz;
  /** The viewer's attempt. Absent means the review screen has nothing to show. */
  result?: QuizResult;
  /** Threads per question id, from `selectCommentThreads`. */
  threads: Record<string, QuizCommentThread[]>;
}

/**
 * The result review — `quiz-discustion` in the route tree (`/quiz/[id]/discussion`).
 *
 * Every value here used to come from `mockQuizResult`: a ten-record object that
 * carried its own title, its own score, its own per-question answers and its own
 * nested discussion threads, so the page could not change when a fixture did and
 * `data:check` could not see it. Now the header is `quiz` + `result`, the question
 * list is `quiz.questions` joined to `result.answers`, and the threads come from
 * `data/quiz-comments.ts` through `selectCommentThreads`.
 */
export function QuizDiscussion({ quiz, result, threads }: QuizDiscussionProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [questionsPerPage] = useState(5);

  const answers = result?.answers ?? [];
  const questions = quiz.questions.map((question) => ({
    question,
    answer: answers.find((entry) => entry.questionId === question.id),
    threads: threads[question.id] ?? [],
  }));

  const filtered = questions.filter(({ answer, threads: about }) => {
    if (activeTab === "correct") return answer?.isCorrect === true;
    if (activeTab === "incorrect") return answer?.isCorrect === false;
    if (activeTab === "discussed") return about.length > 0;
    return true;
  });

  const indexOfLastQuestion = currentPage * questionsPerPage;
  const indexOfFirstQuestion = indexOfLastQuestion - questionsPerPage;
  const currentQuestions = filtered.slice(indexOfFirstQuestion, indexOfLastQuestion);
  const totalPages = Math.ceil(filtered.length / questionsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  if (result === undefined) {
    return (
      <div className="container mx-auto py-4">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/quiz/${quiz.id}`} className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Quiz
            </Link>
          </Button>

          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl md:text-2xl">{quiz.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">
                You have not completed this quiz yet, so there is no result to review.
              </p>
              <Button asChild>
                <Link href={`/quiz/${quiz.id}/play`}>Play Quiz</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const incorrect = result.score.total - result.score.correct;

  return (
    <div className="container mx-auto py-4">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/quiz/${quiz.id}`} className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Quiz
          </Link>
        </Button>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl md:text-2xl">{quiz.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Completed on {formatDate(result.completedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" className="flex items-center gap-1" asChild>
                  <Link href={`/quiz/${quiz.id}/play`}>
                    <RotateCw className="h-4 w-4" />
                    <span>Play Again</span>
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <Share2 className="h-4 w-4" />
                  <span>Challenge Friend</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
                <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Correct</div>
                  <div className="font-medium">
                    {result.score.correct} / {result.score.total}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                <div className="bg-red-100 dark:bg-red-800 p-2 rounded-full">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Incorrect</div>
                  <div className="font-medium">
                    {incorrect} / {result.score.total}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time Taken</div>
                  <div className="font-medium">{formatDurationWords(result.timeTakenSeconds)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="flex overflow-x-auto md:grid w-full md:grid-cols-4">
            <TabsTrigger value="all">All Questions</TabsTrigger>
            <TabsTrigger value="correct">Correct ({result.score.correct})</TabsTrigger>
            <TabsTrigger value="incorrect">Incorrect ({incorrect})</TabsTrigger>
            <TabsTrigger value="discussed">Discussed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="space-y-6">
              {currentQuestions.map(({ question, answer, threads: about }, index) => (
                <QuestionDiscussion
                  key={question.id}
                  quizId={quiz.id}
                  question={question}
                  {...(answer !== undefined ? { answer } : {})}
                  difficulty={quiz.difficulty}
                  threads={about}
                  questionNumber={indexOfFirstQuestion + index + 1}
                />
              ))}

              {filtered.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      No questions found in this category.
                    </p>
                    <Button variant="outline" onClick={() => setActiveTab("all")}>
                      View All Questions
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <Pagination>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center mx-4">
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </Pagination>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
