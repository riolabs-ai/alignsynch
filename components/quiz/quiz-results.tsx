"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Award, CheckCircle, Clock, FileSearch, Home, Medal, MessageSquare, RotateCw, Star, Trophy } from "lucide-react";
import { StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Answer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  timeSpent: number;
}
interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation?: string;
  image?: string | StaticImageData;
}
interface Quiz {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  questions: Question[];
}

interface Results {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  totalTime: number;
  answers: Answer[];
}

interface QuizResultsProps {
  results: Results | null;
  quiz: Quiz;
  onRestart: () => void;
  onReview: () => void;
  onExit: () => void;
}

export function QuizResults({ results, quiz, onRestart, onReview, onExit }: QuizResultsProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (results && results.score >= 70) {
      setShowConfetti(true);
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
  }, [results]);

  if (!results) return null;

  const { totalQuestions, correctAnswers, score, totalTime } = results;

  // Format total time
  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Get performance message
  const getPerformanceMessage = (score: number) => {
    if (score >= 90) return "Excellent! You're a quiz master!";
    if (score >= 70) return "Great job! You know your stuff!";
    if (score >= 50) return "Good effort! Keep learning!";
    return "Nice try! Practice makes perfect!";
  };

  // Get badge based on score
  const getScoreBadge = (score: number) => {
    if (score >= 90) return { text: "Expert", variant: "success", icon: <Trophy className="h-5 w-5" /> };
    if (score >= 70) return { text: "Advanced", variant: "success", icon: <Medal className="h-5 w-5" /> };
    if (score >= 50) return { text: "Intermediate", variant: "warning", icon: <Star className="h-5 w-5" /> };
    return { text: "Beginner", variant: "default", icon: <Award className="h-5 w-5" /> };
  };

  const badge = getScoreBadge(score);

  // Calculate average time per question
  const avgTimePerQuestion = Math.round(totalTime / totalQuestions);

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="mb-8 overflow-hidden border-2 shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 text-center">
          <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
          <p className="opacity-90">{getPerformanceMessage(score)}</p>
        </div>

        <CardContent className="p-6 xl:pt-8">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <svg className="w-40 h-40">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#e6e6e6" strokeWidth="12" />
                <motion.circle cx="80" cy="80" r="70" fill="none" stroke={score >= 70 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444"} strokeWidth="12" strokeDasharray="439.8" strokeDashoffset={439.8 - (score / 100) * 439.8} strokeLinecap="round" transform="rotate(-90 80 80)" initial={{ strokeDashoffset: 439.8 }} animate={{ strokeDashoffset: 439.8 - (score / 100) * 439.8 }} transition={{ duration: 1.5, ease: "easeOut" }} />
                <text x="80" y="80" textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="bold" fill="currentColor">
                  {score}%
                </text>
                <text x="80" y="105" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="currentColor" opacity="0.7">
                  Score
                </text>
              </svg>

              <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                <div className="bg-white rounded-full p-2 shadow-lg">{badge.icon}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Badge variant={badge.variant as any} className="px-3 py-1 text-sm">
                {badge.text}
              </Badge>
              <Badge variant="outline" className="px-3 py-1 text-sm">
                {quiz.category}
              </Badge>
              <Badge variant="outline" className="px-3 py-1 text-sm">
                {quiz.difficulty}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className="bg-green-500/20 border-green-100">
              <CardContent className="p-4 text-center xl:pt-6">
                <div className="flex justify-center mb-2 text-green-600">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div className="text-sm text-muted-foreground mb-1">Correct Answers</div>
                <div className="text-2xl font-bold text-green-700">
                  {correctAnswers}/{totalQuestions}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-500/20 border-blue-100">
              <CardContent className="p-4 text-center xl:pt-6">
                <div className="flex justify-center mb-2 text-blue-600">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="text-sm text-muted-foreground mb-1">Time Taken</div>
                <div className="text-2xl font-bold text-blue-700">{formatTotalTime(totalTime)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Average time per question</span>
              <span className="font-medium">{avgTimePerQuestion} seconds</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Accuracy rate</span>
              <span className="font-medium">{Math.round((correctAnswers / totalQuestions) * 100)}%</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quiz completed</span>
              <span className="font-medium">Yes</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 p-6 pt-0">
          <Button onClick={onReview} variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
            <FileSearch className="h-4 w-4" />
            Review Answers
          </Button>
          <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto" asChild>
            <Link href={`/quiz/${quiz.id}/discussion`}>
              <MessageSquare className="h-4 w-4" />
              Join Discussion
            </Link>
          </Button>
          <Button onClick={onRestart} variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
            <RotateCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={onExit} variant="default" className="flex items-center gap-2 w-full sm:w-auto">
            <Home className="h-4 w-4" />
            Exit Quiz
          </Button>
        </CardFooter>
      </Card>

      <Card className="border shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements Unlocked
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {score >= 100 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-3 p-4 border rounded-md bg-gradient-to-r from-yellow-50 to-amber-50">
                <div className="bg-yellow-500/20 p-2 rounded-full">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="font-medium">Perfect Score</div>
                  <div className="text-sm text-muted-foreground">Answered all questions correctly</div>
                </div>
              </motion.div>
            )}

            {totalTime < totalQuestions * 10 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-3 p-4 border rounded-md bg-gradient-to-r from-blue-50 to-cyan-50">
                <div className="bg-blue-500/20 p-2 rounded-full">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">Speed Demon</div>
                  <div className="text-sm text-muted-foreground">Completed the quiz in record time</div>
                </div>
              </motion.div>
            )}

            {score >= 70 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-3 p-4 border rounded-md bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium">Knowledge Master</div>
                  <div className="text-sm text-muted-foreground">Scored over 70% on this quiz</div>
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex items-center gap-3 p-4 border rounded-md bg-gradient-to-r from-purple-50 to-violet-50">
              <div className="bg-purple-100 p-2 rounded-full">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Quiz Completed</div>
                <div className="text-sm text-muted-foreground">Finished the {quiz.title}</div>
              </div>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
