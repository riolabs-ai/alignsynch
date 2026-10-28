"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, Award, BarChart3, Calendar, CheckCheck, CheckCircle, Clock, Copy, DollarSign, Edit, ExternalLink, Share2, Trash2, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Sample quiz data
const quizData = {
  id: "1",
  title: "World Geography Challenge",
  image: "/world-map-quiz.png",
  category: "Geography",
  difficulty: "Medium",
  status: "active",
  timeLimit: 15,
  reward: "$5.00",
  players: 285,
  maxPlayers: 300,
  spotsLeft: 15,
  createdAt: "2023-11-15T10:30:00Z",
  lastUpdated: "2023-12-01T14:20:00Z",
  description: "Test your knowledge of world geography with this challenging quiz covering countries, capitals, landmarks, and geographical features from all continents.",
  stats: {
    completionRate: 78,
    averageScore: 72,
    revenue: 1425.0,
    totalQuestions: 15,
    averageTimePerQuestion: 42, // seconds
  },
  questions: [
    {
      id: 1,
      text: "What is the capital of Australia?",
      options: [
        { id: 1, text: "Sydney", isCorrect: false },
        { id: 2, text: "Melbourne", isCorrect: false },
        { id: 3, text: "Canberra", isCorrect: true },
        { id: 4, text: "Perth", isCorrect: false },
      ],
      correctPercentage: 65,
    },
    {
      id: 2,
      text: "Which mountain range separates Europe from Asia?",
      options: [
        { id: 1, text: "Alps", isCorrect: false },
        { id: 2, text: "Andes", isCorrect: false },
        { id: 3, text: "Himalayas", isCorrect: false },
        { id: 4, text: "Ural Mountains", isCorrect: true },
      ],
      correctPercentage: 58,
    },
    {
      id: 3,
      text: "Which country has the largest land area in the world?",
      options: [
        { id: 1, text: "China", isCorrect: false },
        { id: 2, text: "Russia", isCorrect: true },
        { id: 3, text: "United States", isCorrect: false },
        { id: 4, text: "Canada", isCorrect: false },
      ],
      correctPercentage: 82,
    },
  ],
  recentPlayers: [
    {
      name: "Alex Johnson",
      avatar: "/avatars/alex.png",
      score: 85,
      date: "2023-12-10T14:30:00Z",
    },
    {
      name: "Sarah Williams",
      avatar: "/avatars/wizard.webp",
      score: 92,
      date: "2023-12-09T16:45:00Z",
    },
    {
      name: "Michael Brown",
      avatar: "/avatars/sarah.webp",
      score: 78,
      date: "2023-12-08T11:20:00Z",
    },
    {
      name: "Emily Davis",
      avatar: "/avatars/king.webp",
      score: 88,
      date: "2023-12-07T09:15:00Z",
    },
    {
      name: "David Wilson",
      avatar: "/avatars/champion.png",
      score: 95,
      date: "2023-12-06T17:30:00Z",
    },
  ],
};

export function QuizDetails({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "success";
      case "Medium":
        return "warning";
      case "Hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "draft":
        return "outline";
      case "completed":
        return "blue";
      default:
        return "default";
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };

  // Calculate progress percentage
  const calculateProgress = (players: number, maxPlayers: number) => {
    return (players / maxPlayers) * 100;
  };

  // Copy share link
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/quiz/${id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <Link href={`/create/editor?id=${id}`} className="flex items-center gap-2">
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
        <div className="h-64 w-full">
          <Image src={quizData.image || "/placeholder.svg"} alt={quizData.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex flex-col justify-end p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={getDifficultyVariant(quizData.difficulty)} className="font-medium">
                {quizData.difficulty}
              </Badge>
              <Badge variant={getStatusVariant(quizData.status)} className="capitalize">
                {quizData.status}
              </Badge>
              <Badge variant="outline" className="bg-white/20 text-white">
                {quizData.category}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{quizData.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{quizData.timeLimit} minutes</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span>{quizData.reward} reward</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Created {formatDate(quizData.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{quizData.players} players</span>
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
                  <p>{quizData.description}</p>
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
                      <div className="text-2xl font-bold">{quizData.stats.completionRate}%</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-muted-foreground mb-1 text-sm">Average Score</div>
                      <div className="text-2xl font-bold">{quizData.stats.averageScore}%</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-muted-foreground mb-1 text-sm">Avg. Time/Question</div>
                      <div className="text-2xl font-bold">{quizData.stats.averageTimePerQuestion}s</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
                      <div className="text-green-600 mb-1 text-sm">Total Revenue</div>
                      <div className="text-2xl font-bold text-green-600">${quizData.stats.revenue.toFixed(2)}</div>
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
                    {quizData.recentPlayers.slice(0, 3).map((player, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={player.avatar || "/placeholder.svg"} alt={player.name} />
                            <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(player.date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-yellow-500" />
                          <span className="font-bold">{player.score}%</span>
                        </div>
                      </div>
                    ))}
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
                  <Accordion type="single" collapsible className="w-full">
                    {quizData.questions.map((question, index) => (
                      <AccordionItem key={question.id} value={`question-${question.id}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">{index + 1}</div>
                            <span>{question.text}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-9 space-y-4">
                            <div className="space-y-2">
                              {question.options.map((option) => (
                                <div key={option.id} className={`flex items-center p-3 rounded-md border ${option.isCorrect ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900" : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}>
                                  {option.isCorrect && <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />}
                                  <span>{option.text}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{question.correctPercentage}% of players answered correctly</span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
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
                      {quizData.recentPlayers.map((player, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={player.avatar || "/placeholder.svg"} alt={player.name} />
                                <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                              </Avatar>
                              <span>{player.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(player.date)}</TableCell>
                          <TableCell>{player.score}%</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={player.score >= 70 ? "success" : "warning"}>{player.score >= 70 ? "Passed" : "Failed"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                <CircularProgress value={calculateProgress(quizData.players, quizData.maxPlayers)} size={120} strokeWidth={8} showValue={true} valueSize={24} color={quizData.spotsLeft <= 20 ? "hsl(var(--destructive))" : quizData.spotsLeft <= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                <div className="mt-4 text-center">
                  <p className="text-lg font-medium">
                    {quizData.players} / {quizData.maxPlayers}
                  </p>
                  <p className="text-sm text-muted-foreground">Players</p>
                </div>
                {quizData.spotsLeft <= 20 ? (
                  <div className="mt-2 flex items-center text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Only {quizData.spotsLeft} spots left!</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">{quizData.spotsLeft} spots available</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={getStatusVariant(quizData.status)} className="capitalize">
                    {quizData.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(quizData.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{formatDate(quizData.lastUpdated)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time Limit</span>
                  <span>{quizData.timeLimit} minutes</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Questions</span>
                  <span>{quizData.stats.totalQuestions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Reward</span>
                  <span className="font-medium text-green-600">{quizData.reward}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full flex items-center gap-2" asChild>
                <Link href={`/analytics?quiz=${id}`}>
                  <BarChart3 className="h-4 w-4" />
                  <span>View Full Analytics</span>
                </Link>
              </Button>
              <Button variant="outline" className="w-full flex items-center gap-2" onClick={handleCopyLink}>
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
                <Link href={`/quiz/${id}`} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  <span>Preview Quiz</span>
                </Link>
              </Button>
              <Button variant="outline" className="w-full flex items-center gap-2" asChild>
                <Link href={`/create/editor?id=${id}&duplicate=true`}>
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
