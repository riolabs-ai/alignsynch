"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ArrowLeft, BarChart3, Calendar, CheckCircle, Clock, Download, Filter, Globe, PieChartIcon, Timer, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

// Mock data for the quiz
const getQuizData = (id: string) => {
  const quiz = {
    stats: {
      questionStats: [
        { id: 1, correctRate: 92, avgTimeSpent: 15 },
        { id: 2, correctRate: 85, avgTimeSpent: 22 },
        { id: 3, correctRate: 78, avgTimeSpent: 30 },
        { id: 4, correctRate: 65, avgTimeSpent: 45 },
        { id: 5, correctRate: 89, avgTimeSpent: 18 },
        { id: 6, correctRate: 72, avgTimeSpent: 25 },
        { id: 7, correctRate: 94, avgTimeSpent: 12 },
        { id: 8, correctRate: 81, avgTimeSpent: 20 },
        { id: 9, correctRate: 68, avgTimeSpent: 35 },
        { id: 10, correctRate: 75, avgTimeSpent: 28 },
        { id: 11, correctRate: 90, avgTimeSpent: 17 },
        { id: 12, correctRate: 45, avgTimeSpent: 50 }, // Most missed question
        { id: 13, correctRate: 82, avgTimeSpent: 23 },
        { id: 14, correctRate: 79, avgTimeSpent: 26 },
        { id: 15, correctRate: 88, avgTimeSpent: 19 },
        { id: 16, correctRate: 76, avgTimeSpent: 27 },
        { id: 17, correctRate: 83, avgTimeSpent: 21 },
        { id: 18, correctRate: 71, avgTimeSpent: 32 },
        { id: 19, correctRate: 87, avgTimeSpent: 24 },
        { id: 20, correctRate: 80, avgTimeSpent: 29 },
      ],
    },
  };
  return {
    id,
    title: "World Geography Challenge",
    description: "Test your knowledge of world geography with this challenging quiz!",
    image: "/world-map-quiz.png",
    category: "Geography",
    difficulty: "medium",
    questions: 20,
    plays: 1245,
    averageScore: 76,
    rating: 4.7,
    createdAt: "2023-01-15T10:30:00Z",
    updatedAt: "2023-02-10T14:20:00Z",
    published: true,
    featured: true,
    isTournament: false,
    stats: {
      completionRate: 87,
      averageTimeSpent: 840, // in seconds
      mostMissedQuestion: 12,
      highestScore: 100,
      lowestScore: 35,
      questionStats: [
        { id: 1, correctRate: 92, avgTimeSpent: 15 },
        { id: 2, correctRate: 85, avgTimeSpent: 22 },
        { id: 3, correctRate: 78, avgTimeSpent: 30 },
        { id: 4, correctRate: 65, avgTimeSpent: 45 },
        { id: 5, correctRate: 89, avgTimeSpent: 18 },
        { id: 6, correctRate: 72, avgTimeSpent: 25 },
        { id: 7, correctRate: 94, avgTimeSpent: 12 },
        { id: 8, correctRate: 81, avgTimeSpent: 20 },
        { id: 9, correctRate: 68, avgTimeSpent: 35 },
        { id: 10, correctRate: 75, avgTimeSpent: 28 },
        { id: 11, correctRate: 90, avgTimeSpent: 17 },
        { id: 12, correctRate: 45, avgTimeSpent: 50 }, // Most missed question
        { id: 13, correctRate: 82, avgTimeSpent: 23 },
        { id: 14, correctRate: 79, avgTimeSpent: 26 },
        { id: 15, correctRate: 88, avgTimeSpent: 19 },
        { id: 16, correctRate: 76, avgTimeSpent: 27 },
        { id: 17, correctRate: 83, avgTimeSpent: 21 },
        { id: 18, correctRate: 71, avgTimeSpent: 32 },
        { id: 19, correctRate: 87, avgTimeSpent: 24 },
        { id: 20, correctRate: 80, avgTimeSpent: 29 },
      ],
      playerDemographics: {
        ageGroups: [
          { group: "13-17", percentage: 15 },
          { group: "18-24", percentage: 35 },
          { group: "25-34", percentage: 25 },
          { group: "35-44", percentage: 15 },
          { group: "45+", percentage: 10 },
        ],
        genderDistribution: [
          { gender: "Male", percentage: 55 },
          { gender: "Female", percentage: 42 },
          { gender: "Other", percentage: 3 },
        ],
        topCountries: [
          { country: "United States", percentage: 30 },
          { country: "United Kingdom", percentage: 15 },
          { country: "Canada", percentage: 12 },
          { country: "Australia", percentage: 10 },
          { country: "Germany", percentage: 8 },
          { country: "France", percentage: 6 },
          { country: "India", percentage: 5 },
          { country: "Brazil", percentage: 4 },
          { country: "Japan", percentage: 3 },
          { country: "Other", percentage: 7 },
        ],
      },
      playTimeDistribution: [
        { hour: "00:00", count: 15 },
        { hour: "01:00", count: 10 },
        { hour: "02:00", count: 5 },
        { hour: "03:00", count: 3 },
        { hour: "04:00", count: 2 },
        { hour: "05:00", count: 4 },
        { hour: "06:00", count: 8 },
        { hour: "07:00", count: 20 },
        { hour: "08:00", count: 35 },
        { hour: "09:00", count: 50 },
        { hour: "10:00", count: 65 },
        { hour: "11:00", count: 75 },
        { hour: "12:00", count: 85 },
        { hour: "13:00", count: 90 },
        { hour: "14:00", count: 95 },
        { hour: "15:00", count: 100 },
        { hour: "16:00", count: 110 },
        { hour: "17:00", count: 120 },
        { hour: "18:00", count: 115 },
        { hour: "19:00", count: 105 },
        { hour: "20:00", count: 90 },
        { hour: "21:00", count: 70 },
        { hour: "22:00", count: 45 },
        { hour: "23:00", count: 25 },
      ],
      scoreDistribution: [
        { range: "0-10%", count: 5, color: "#ef4444" },
        { range: "11-20%", count: 10, color: "#f97316" },
        { range: "21-30%", count: 15, color: "#f59e0b" },
        { range: "31-40%", count: 25, color: "#eab308" },
        { range: "41-50%", count: 45, color: "#84cc16" },
        { range: "51-60%", count: 75, color: "#22c55e" },
        { range: "61-70%", count: 120, color: "#10b981" },
        { range: "71-80%", count: 180, color: "#06b6d4" },
        { range: "81-90%", count: 150, color: "#0ea5e9" },
        { range: "91-100%", count: 95, color: "#3b82f6" },
      ],
      dailyPlayers: [
        { date: "2023-01-01", players: 45 },
        { date: "2023-01-02", players: 52 },
        { date: "2023-01-03", players: 49 },
        { date: "2023-01-04", players: 63 },
        { date: "2023-01-05", players: 58 },
        { date: "2023-01-06", players: 72 },
        { date: "2023-01-07", players: 85 },
        { date: "2023-01-08", players: 68 },
        { date: "2023-01-09", players: 74 },
        { date: "2023-01-10", players: 89 },
        { date: "2023-01-11", players: 95 },
        { date: "2023-01-12", players: 86 },
        { date: "2023-01-13", players: 92 },
        { date: "2023-01-14", players: 105 },
      ],
      completionAnalysis: [
        { name: "Completed", value: 87, color: "#22c55e" },
        { name: "Abandoned", value: 13, color: "#ef4444" },
      ],
      completionRateOverTime: [
        { date: "2023-01-01", rate: 82 },
        { date: "2023-01-02", rate: 83 },
        { date: "2023-01-03", rate: 81 },
        { date: "2023-01-04", rate: 84 },
        { date: "2023-01-05", rate: 85 },
        { date: "2023-01-06", rate: 86 },
        { date: "2023-01-07", rate: 87 },
        { date: "2023-01-08", rate: 85 },
        { date: "2023-01-09", rate: 86 },
        { date: "2023-01-10", rate: 88 },
        { date: "2023-01-11", rate: 89 },
        { date: "2023-01-12", rate: 87 },
        { date: "2023-01-13", rate: 88 },
        { date: "2023-01-14", rate: 90 },
      ],
      averageTimeSpentOverTime: [
        { date: "2023-01-01", time: 820 },
        { date: "2023-01-02", time: 825 },
        { date: "2023-01-03", time: 815 },
        { date: "2023-01-04", time: 830 },
        { date: "2023-01-05", time: 835 },
        { date: "2023-01-06", time: 840 },
        { date: "2023-01-07", time: 845 },
        { date: "2023-01-08", time: 835 },
        { date: "2023-01-09", time: 840 },
        { date: "2023-01-10", time: 850 },
        { date: "2023-01-11", time: 855 },
        { date: "2023-01-12", time: 845 },
        { date: "2023-01-13", time: 850 },
        { date: "2023-01-14", time: 860 },
      ],
      playerRetention: [
        { day: "Day 1", retention: 100 },
        { day: "Day 2", retention: 65 },
        { day: "Day 3", retention: 48 },
        { day: "Day 7", retention: 32 },
        { day: "Day 14", retention: 24 },
        { day: "Day 30", retention: 18 },
        { day: "Day 60", retention: 12 },
        { day: "Day 90", retention: 8 },
      ],
      questionPerformanceData: quiz.stats.questionStats.map((q) => ({
        id: q.id,
        correctRate: q.correctRate,
        avgTimeSpent: q.avgTimeSpent,
        difficulty: q.correctRate >= 80 ? "Easy" : q.correctRate >= 60 ? "Medium" : "Hard",
      })),
    },
  };
};

// Format time from seconds to minutes:seconds
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Format date for charts
const formatDate = (dateString: string) => {
  return format(new Date(dateString), "MMM d");
};

export function QuizStatistics({ id }: { id: string }) {
  const quiz = getQuizData(id);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  // Custom colors for charts
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  const RADIAN = Math.PI / 180;

  // Custom label for pie charts
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="container mx-auto max-w-7xl py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <Link href={`/my-quizzes/${id}`} className="mb-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Quiz Details
          </Link>
          <h1 className="text-2xl font-bold">{quiz.title} - Statistics</h1>
          <p className="text-muted-foreground">Analyze performance and engagement metrics for your quiz</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                {timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : timeRange === "90d" ? "Last 90 days" : "All time"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTimeRange("7d")}>Last 7 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange("30d")}>Last 30 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange("90d")}>Last 90 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange("all")}>All time</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Quiz Info */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row">
          <div className="relative h-48 w-full md:h-auto md:w-64">
            <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} fill className="object-cover md:rounded-l-lg" />
          </div>
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{quiz.title}</h2>
              <p className="text-muted-foreground">{quiz.description}</p>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-background">
                {quiz.category}
              </Badge>
              <Badge
                variant="outline"
                className={`
                  ${quiz.difficulty === "easy" ? "border-green-500 bg-green-50 text-green-700" : quiz.difficulty === "medium" ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700"}
                `}
              >
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </Badge>
              <Badge variant="outline" className="bg-background">
                {quiz.questions} Questions
              </Badge>
              <Badge variant="outline" className="bg-background">
                <Calendar className="mr-1 h-3.5 w-3.5" />
                {format(new Date(quiz.createdAt), "MMM d, yyyy")}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Plays</p>
                <p className="text-2xl font-bold">{quiz.plays.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Score</p>
                <p className="text-2xl font-bold">{quiz.averageScore}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{quiz.stats.completionRate}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Time</p>
                <p className="text-2xl font-bold">{formatTime(quiz.stats.averageTimeSpent)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Question Analysis</TabsTrigger>
          <TabsTrigger value="players">Player Demographics</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ChartContainer
                    config={{
                      count: {
                        label: "Number of Players",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={quiz.stats.scoreDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" name="Players" radius={[4, 4, 0, 0]}>
                          {quiz.stats.scoreDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Play Time Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ChartContainer
                    config={{
                      count: {
                        label: "Number of Plays",
                        color: "hsl(var(--chart-2))",
                      },
                    }}
                    className="h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={quiz.stats.playTimeDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="count" name="Plays" stroke="var(--color-count)" fill="var(--color-count)" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Daily Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ChartContainer
                    config={{
                      players: {
                        label: "Players",
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={quiz.stats.dailyPlayers} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="players" name="Players" stroke="var(--color-players)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChartIcon className="mr-2 h-5 w-5" />
                  Completion Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={quiz.stats.completionAnalysis} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={80} fill="#8884d8" dataKey="value">
                        {quiz.stats.completionAnalysis.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Question Analysis Tab */}
        <TabsContent value="questions" className="space-y-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Question Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-full w-full">
                <ChartContainer
                  config={{
                    correctRate: {
                      label: "Correct Rate (%)",
                      color: "hsl(var(--chart-1))",
                    },
                    avgTimeSpent: {
                      label: "Avg. Time (sec)",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-80 w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quiz.stats.questionStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="id" />
                      <YAxis yAxisId="left" orientation="left" stroke="var(--color-correctRate)" />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--color-avgTimeSpent)" domain={[0, 60]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="correctRate" name="Correct Rate" fill="var(--color-correctRate)" radius={[4, 4, 0, 0]}>
                        {quiz.stats.questionStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.correctRate >= 80 ? "#22c55e" : entry.correctRate >= 60 ? "#eab308" : "#ef4444"} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="avgTimeSpent" name="Avg. Time" stroke="var(--color-avgTimeSpent)" strokeWidth={2} dot={{ r: 4 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Question Difficulty Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="correctRate" name="Correct Rate" domain={[0, 100]} label={{ value: "Correct Rate (%)", position: "insideBottom", offset: -5 }} />
                    <YAxis type="number" dataKey="avgTimeSpent" name="Avg. Time" label={{ value: "Avg. Time (sec)", angle: -90, position: "insideLeft" }} />
                    <ZAxis type="number" range={[100, 500]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <p className="text-sm font-medium">Question {data.id}</p>
                              <p className="text-sm text-muted-foreground">Correct Rate: {data.correctRate}%</p>
                              <p className="text-sm text-muted-foreground">Avg. Time: {data.avgTimeSpent} sec</p>
                              <p className="text-sm text-muted-foreground">Difficulty: {data.difficulty}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter
                      name="Questions"
                      data={quiz.stats.questionStats.map((q) => ({
                        ...q,
                        difficulty: q.correctRate >= 80 ? "Easy" : q.correctRate >= 60 ? "Medium" : "Hard",
                      }))}
                      fill="#8884d8"
                    >
                      {quiz.stats.questionStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.correctRate >= 80 ? "#22c55e" : entry.correctRate >= 60 ? "#eab308" : "#ef4444"} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Question Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium">Question #</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Correct Rate</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Avg. Time Spent</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quiz.stats.questionStats.map((question) => (
                        <tr key={question.id} className="border-b">
                          <td className="px-4 py-3 text-sm">Question {question.id}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center">
                              <div className="mr-2 h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                                <div className={`h-full ${question.correctRate >= 80 ? "bg-green-500" : question.correctRate >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${question.correctRate}%` }} />
                              </div>
                              <span>{question.correctRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{question.avgTimeSpent} seconds</td>
                          <td className="px-4 py-3 text-sm">
                            {question.id === quiz.stats.mostMissedQuestion ? (
                              <Badge variant="destructive">Most Missed</Badge>
                            ) : question.correctRate >= 90 ? (
                              <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">
                                Easy
                              </Badge>
                            ) : question.correctRate <= 50 ? (
                              <Badge variant="outline" className="border-red-500 bg-red-50 text-red-700">
                                Difficult
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-yellow-500 bg-yellow-50 text-yellow-700">
                                Average
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Demographics Tab */}
        <TabsContent value="players" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Age Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={quiz.stats.playerDemographics.ageGroups} cx="50%" cy="50%" labelLine={true} outerRadius={80} fill="#8884d8" dataKey="percentage" nameKey="group" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {quiz.stats.playerDemographics.ageGroups.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Percentage"]}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <p className="text-sm font-medium">{payload[0].name}</p>
                                <p className="text-sm text-muted-foreground">{payload[0].value}% of players</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={quiz.stats.playerDemographics.genderDistribution} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="percentage" nameKey="gender" label={renderCustomizedLabel}>
                        {quiz.stats.playerDemographics.genderDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Percentage"]}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <p className="text-sm font-medium">{payload[0].name}</p>
                                <p className="text-sm text-muted-foreground">{payload[0].value}% of players</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5" />
                  Geographic Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ChartContainer
                    config={{
                      percentage: {
                        label: "Percentage of Players",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={quiz.stats.playerDemographics.topCountries} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="country" width={80} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="percentage" name="Percentage" fill="var(--color-percentage)" radius={[0, 4, 4, 0]}>
                          {quiz.stats.playerDemographics.topCountries.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Completion Rate Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ChartContainer
                    config={{
                      rate: {
                        label: "Completion Rate (%)",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={quiz.stats.completionRateOverTime} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} />
                        <YAxis domain={[70, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="rate" name="Completion Rate" stroke="var(--color-rate)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Timer className="mr-2 h-5 w-5" />
                  Average Time Spent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ChartContainer
                    config={{
                      time: {
                        label: "Time (seconds)",
                        color: "hsl(var(--chart-2))",
                      },
                    }}
                    className="h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={quiz.stats.averageTimeSpentOverTime} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} />
                        <YAxis domain={[800, 900]} />
                        <ChartTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <p className="text-sm font-medium">{formatDate(label)}</p>
                                  <p className="text-sm text-muted-foreground">Average Time: {formatTime(payload[0]?.value as number)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area type="monotone" dataKey="time" name="Average Time" stroke="var(--color-time)" fill="var(--color-time)" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Player Retention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ChartContainer
                    config={{
                      retention: {
                        label: "Retention Rate (%)",
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="size-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={quiz.stats.playerRetention} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="retention" name="Retention Rate" stroke="var(--color-retention)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
