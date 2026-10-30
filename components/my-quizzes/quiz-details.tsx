"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/content/core";
import { spotsLeftOf, type Quiz, type QuizAnalytics } from "@/content/quiz";
import type { QuizPlayersRow } from "@/content/quiz-result";
import { media } from "@/data/media";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  CheckCheck,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  Edit,
  ExternalLink,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface MyQuizDetailsProps {
  /** The authoring record the route resolves to (`/my-quizzes/[id]`). */
  quiz: Quiz;
  /** `data/quiz-analytics.ts` — absent means "no data", rendered as a dash, never zero. */
  analytics?: QuizAnalytics;
  /** Recent attempts — `selectQuizResults` over `data/quiz-results.ts`. */
  players: QuizPlayersRow[];
  /** Percent correct per question id, from `selectQuestionAccuracy`. */
  questionAccuracy: Record<string, number>;
  /** `Category.name` resolved through the taxonomy. */
  categoryLabel: string;
}

/** `undefined` -> "—". The authoring surface never prints a zero it did not measure. */
const dash = (value: number | undefined, suffix = ""): string =>
  value === undefined ? "—" : `${value}${suffix}`;

/**
 * The authoring quiz detail page (`/my-quizzes/[id]`).
 *
 * The module-level `quizData` this used to read carried a title, three questions,
 * five recent players, an analytics block and a seat snapshot — all invented. The
 * record now comes from the route and the numbers from `data/quiz-analytics.ts` and
 * `data/quiz-results.ts`, so a quiz with no questions and no plays renders as such
 * instead of showing three questions nobody wrote.
 */
export function QuizDetails({
  quiz,
  analytics,
  players,
  questionAccuracy,
  categoryLabel,
}: MyQuizDetailsProps) {
  const [copied, setCopied] = useState(false);

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "success";
      case "medium":
        return "warning";
      case "hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "published":
        return "success";
      case "draft":
        return "outline";
      case "archived":
        return "blue";
      default:
        return "default";
    }
  };

  // Copy share link
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/quiz/${quiz.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const capacity = quiz.stats.capacity;
  const spotsLeft = spotsLeftOf(quiz.stats);
  const timeLimit =
    quiz.settings.timeLimitSeconds === 0
      ? "No limit"
      : `${Math.round(quiz.settings.timeLimitSeconds / 60)} minutes`;
  const updatedAt = quiz.stats.updatedAt;

  return (
    <div className="space-y-6">
      {/* Back button and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/my-quizzes" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to My Quizzes</span>
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/create/editor?id=${quiz.id}`} className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              <span>Edit Quiz</span>
            </Link>
          </Button>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleCopyLink}>
            {copied ? (
              <>
                <CheckCheck className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </>
            )}
          </Button>
          <Button variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Quiz header */}
      <div className="relative rounded-xl overflow-hidden">
        <div className="relative h-64 w-full">
          <Image
            src={quiz.cover?.src ?? media.placeholder.src}
            alt={quiz.title}
            className="h-full w-full object-cover"
            fill
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex flex-col justify-end p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={getDifficultyVariant(quiz.difficulty)} className="font-medium">
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </Badge>
              <Badge variant={getStatusVariant(quiz.status)} className="capitalize">
                {quiz.status}
              </Badge>
              <Badge variant="outline" className="bg-white/20 text-white">
                {categoryLabel}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{quiz.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{timeLimit}</span>
              </div>
              {quiz.stats.rewardCents !== undefined && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatCurrency(quiz.stats.rewardCents)} reward</span>
                </div>
              )}
              {quiz.createdAt !== undefined && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Created {formatDate(quiz.createdAt)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{quiz.stats.plays} players</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Quiz details */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 pt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{quiz.summary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-muted-foreground mb-1 text-sm">Completion Rate</div>
                      <div className="text-2xl font-bold">
                        {dash(analytics?.completionRate, "%")}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-muted-foreground mb-1 text-sm">Average Score</div>
                      <div className="text-2xl font-bold">{dash(analytics?.averageScore, "%")}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-muted-foreground mb-1 text-sm">Avg. Time/Question</div>
                      <div className="text-2xl font-bold">
                        {dash(analytics?.averageTimeSpentSeconds, "s")}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-green-600 mb-1 text-sm">Total Revenue</div>
                      <div className="text-2xl font-bold text-green-600">
                        {analytics?.revenueCents === undefined
                          ? "—"
                          : formatCurrency(analytics.revenueCents)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {players.slice(0, 3).map((player, index) => (
                      <div key={player.result.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                            {index + 1}
                          </div>
                          <GeneratedAvatar
                            name={player.result.player.name}
                            seed={player.result.player.id ?? player.result.player.name}
                            size={40}
                          />
                          <div>
                            <p className="font-medium">{player.result.player.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(player.result.completedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-yellow-500" />
                          <span className="font-bold">{player.percent}%</span>
                        </div>
                      </div>
                    ))}
                    {players.length === 0 && (
                      <p className="text-sm text-muted-foreground">No completed attempts yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="questions" className="space-y-6 pt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  {quiz.questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This quiz has no questions yet. Add the first one from the editor.
                    </p>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {quiz.questions.map((question, index) => (
                        <AccordionItem key={question.id} value={`question-${question.id}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3 text-left">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                                {index + 1}
                              </div>
                              <span>{question.prompt}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-9 space-y-4">
                              <div className="space-y-2">
                                {question.options.map((option) => {
                                  const isCorrect = option.id === question.correctOptionId;
                                  return (
                                    <div
                                      key={option.id}
                                      className={`flex items-center p-3 rounded-md border ${isCorrect ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900" : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}
                                    >
                                      {isCorrect && (
                                        <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                                      )}
                                      <span>{option.text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              {questionAccuracy[question.id] !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {questionAccuracy[question.id]}% of players answered correctly
                                  </span>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="players" className="space-y-6 pt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Players</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player) => (
                        <TableRow key={player.result.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GeneratedAvatar
                                name={player.result.player.name}
                                seed={player.result.player.id ?? player.result.player.name}
                                size={32}
                              />
                              <span>{player.result.player.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(player.result.completedAt)}</TableCell>
                          <TableCell>{player.percent}%</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={player.passed ? "success" : "warning"}>
                              {player.passed ? "Passed" : "Failed"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {players.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Nobody has completed this quiz yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column - Stats and actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center">
                {capacity !== undefined && spotsLeft !== undefined ? (
                  <>
                    <CircularProgress
                      value={(quiz.stats.plays / capacity) * 100}
                      size={120}
                      strokeWidth={8}
                      showValue={true}
                      valueSize={24}
                      color={
                        spotsLeft <= 20
                          ? "hsl(var(--destructive))"
                          : spotsLeft <= 50
                            ? "hsl(var(--warning))"
                            : "hsl(var(--primary))"
                      }
                    />
                    <div className="mt-4 text-center">
                      <p className="text-lg font-medium">
                        {quiz.stats.plays} / {capacity}
                      </p>
                      <p className="text-sm text-muted-foreground">Players</p>
                    </div>
                    {spotsLeft <= 20 ? (
                      <div className="mt-2 flex items-center text-destructive">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">Only {spotsLeft} spots left!</span>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {spotsLeft} spots available
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-lg font-medium">{quiz.stats.plays}</p>
                    <p className="text-sm text-muted-foreground">Players</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={getStatusVariant(quiz.status)} className="capitalize">
                    {quiz.status}
                  </Badge>
                </div>
                {quiz.createdAt !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(quiz.createdAt)}</span>
                  </div>
                )}
                {updatedAt !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{formatDate(updatedAt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time Limit</span>
                  <span>{timeLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Questions</span>
                  <span>{quiz.questions.length}</span>
                </div>
                {quiz.stats.rewardCents !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Reward</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(quiz.stats.rewardCents)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full flex items-center gap-2" asChild>
                <Link href={`/analytics?quiz=${quiz.id}`}>
                  <BarChart3 className="h-4 w-4" />
                  <span>View Full Analytics</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <CheckCheck className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Share Link</span>
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full flex items-center gap-2" asChild>
                <Link href={`/quiz/${quiz.id}`} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  <span>Preview Quiz</span>
                </Link>
              </Button>
              <Button variant="outline" className="w-full flex items-center gap-2" asChild>
                <Link href={`/create/editor?id=${quiz.id}&duplicate=true`}>
                  <Copy className="h-4 w-4" />
                  <span>Duplicate Quiz</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
