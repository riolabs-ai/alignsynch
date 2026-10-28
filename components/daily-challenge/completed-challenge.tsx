"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import confetti from "canvas-confetti";
import { Award, Clock, Facebook, Link, Medal, Share2, Trophy, Twitter } from "lucide-react";
import { useEffect, useState } from "react";
type dailyQuizData = {
  title: string;
  description: string;
  questions: {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
};
interface CompletedChallengeProps {
  result: {
    score: number;
    totalQuestions: number;
    timeTaken: number;
    rank: number;
    correctAnswers: number;
  };
  onReset: () => void;
  dailyQuizData: dailyQuizData;
  selectedAnswers: string[];
}

export function CompletedChallenge({ result, onReset, dailyQuizData, selectedAnswers }: CompletedChallengeProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Excellent! You're a quiz master!";
    if (score >= 70) return "Great job! You know your stuff!";
    if (score >= 50) return "Good effort! Keep learning!";
    return "Nice try! There's room for improvement.";
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank <= 3) return "🥈";
    if (rank <= 10) return "🥉";
    return "🏅";
  };

  const handleShare = (platform: string) => {
    const message = `I scored ${result.score}% and ranked #${result.rank} in today's quiz challenge! Can you beat me?`;

    // In a real app, these would open share dialogs or copy to clipboard
    if (platform === "twitter") {
      console.log("Sharing to Twitter:", message);
      toast({
        title: "Shared to Twitter",
        description: "Your results have been shared to Twitter.",
      });
    } else if (platform === "facebook") {
      console.log("Sharing to Facebook:", message);
      toast({
        title: "Shared to Facebook",
        description: "Your results have been shared to Facebook.",
      });
    } else if (platform === "copy") {
      navigator.clipboard.writeText(message);
      toast({
        title: "Link Copied",
        description: "Challenge link copied to clipboard.",
      });
    }
  };
  useEffect(() => {
    if (result && result.score >= 70) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        // since particles fall down, start a bit higher than random
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [result]);

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-center">Challenge Completed!</CardTitle>
        <CardDescription className="text-center">{getScoreMessage(result.score)}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative">
            <CircularProgress value={result.score} size={180} strokeWidth={10} />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-4xl font-bold">{result.score}%</span>
              <span className="text-sm text-muted-foreground">Your Score</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg">
            <Trophy className="h-5 w-5 text-amber-500 mb-1" />
            <span className="text-sm text-muted-foreground">Rank</span>
            <span className="text-xl font-bold">
              {getRankEmoji(result.rank)} #{result.rank}
            </span>
          </div>

          <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg">
            <Clock className="h-5 w-5 text-blue-500 mb-1" />
            <span className="text-sm text-muted-foreground">Time</span>
            <span className="text-xl font-bold">{formatTime(result.timeTaken)}</span>
          </div>

          <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg">
            <Award className="h-5 w-5 text-green-500 mb-1" />
            <span className="text-sm text-muted-foreground">Correct</span>
            <span className="text-xl font-bold">
              {result.correctAnswers}/{result.totalQuestions}
            </span>
          </div>

          <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg">
            <Medal className="h-5 w-5 text-purple-500 mb-1" />
            <span className="text-sm text-muted-foreground">Earned</span>
            <span className="text-xl font-bold">+125 XP</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="answers">Answers</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Your Performance</h3>
              <p className="text-sm text-muted-foreground">You completed today's challenge in {formatTime(result.timeTaken)}, which is faster than 65% of participants.</p>
              <p className="text-sm text-muted-foreground">
                Your score of {result.score}% places you in the top {result.rank <= 10 ? "10%" : "30%"} of today's participants.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-medium">Streak Update</h3>
              <p className="text-sm text-muted-foreground">You've maintained a 4-day streak! Keep it up to earn bonus rewards.</p>
              <div className="flex space-x-1 mt-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div key={day} className={`h-2 w-full rounded-full ${day <= 4 ? "bg-green-500" : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-right mt-1">3 days until 7-day streak badge</p>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 flex items-center space-x-3">
                <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-full">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-medium">Daily Participant</h4>
                  <p className="text-sm text-muted-foreground">+50 Coins</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 flex items-center space-x-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                  <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium">Score Bonus</h4>
                  <p className="text-sm text-muted-foreground">+{result.score} XP</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">
                  <Medal className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="font-medium">Streak Bonus</h4>
                  <p className="text-sm text-muted-foreground">+25 Coins (4-day streak)</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 flex items-center space-x-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-full">
                  <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium">Top 50 Rank</h4>
                  <p className="text-sm text-muted-foreground">+50 XP</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="text-center">
              <p className="font-medium">Total Earned</p>
              <div className="flex justify-center space-x-4 mt-2">
                <div className="flex items-center">
                  <div className="bg-amber-100 dark:bg-amber-900 p-1 rounded-full mr-2">
                    <span className="text-amber-600 dark:text-amber-400 text-xs font-bold">$</span>
                  </div>
                  <span className="font-bold">+75 Coins</span>
                </div>
                <div className="flex items-center">
                  <div className="bg-blue-100 dark:bg-blue-900 p-1 rounded-full mr-2">
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">XP</span>
                  </div>
                  <span className="font-bold">+125 XP</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="answers" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Review your answers and see the correct solutions.</p>

            <div className="space-y-4">
              {dailyQuizData.questions.map((q, index) => {
                const userAnswer = selectedAnswers[index] || "Not answered";
                const isCorrect = userAnswer === q.correctAnswer;

                return (
                  <div key={q.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">
                        {index + 1}. {q.question}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>{isCorrect ? "Correct" : "Incorrect"}</span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className={isCorrect ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>{userAnswer}</span>
                      </p>

                      {!isCorrect && (
                        <p>
                          <span className="text-muted-foreground">Correct answer: </span>
                          <span className="text-green-600 dark:text-green-400 font-medium">{q.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
        <Button variant="outline" onClick={onReset}>
          View Challenge Details
        </Button>

        <div className="flex space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Share2 className="h-4 w-4 mr-2" />
                Share Results
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" className="flex items-center" onClick={() => handleShare("twitter")}>
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter
                </Button>
                <Button size="sm" variant="outline" className="flex items-center" onClick={() => handleShare("facebook")}>
                  <Facebook className="h-4 w-4 mr-2" />
                  Facebook
                </Button>
                <Button size="sm" variant="outline" className="flex items-center" onClick={() => handleShare("copy")}>
                  <Link className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardFooter>
    </Card>
  );
}
