"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState } from "react";

// Mock data for the daily quiz
export const dailyQuizData = {
  title: "Science & Technology Challenge",
  description: "Test your knowledge of scientific discoveries and technological innovations.",
  questions: [
    {
      id: 1,
      question: "Which of these is NOT a programming language?",
      options: ["Java", "Python", "HTML", "Jaguar"],
      correctAnswer: "Jaguar",
    },
    {
      id: 2,
      question: "What does CPU stand for?",
      options: ["Central Processing Unit", "Computer Personal Unit", "Central Processor Utility", "Core Processing Unit"],
      correctAnswer: "Central Processing Unit",
    },
    {
      id: 3,
      question: "Which planet has the most moons?",
      options: ["Jupiter", "Saturn", "Uranus", "Neptune"],
      correctAnswer: "Saturn",
    },
    {
      id: 4,
      question: "What is the chemical symbol for gold?",
      options: ["Go", "Gd", "Au", "Ag"],
      correctAnswer: "Au",
    },
    {
      id: 5,
      question: "Which of these is a renewable energy source?",
      options: ["Coal", "Natural Gas", "Solar", "Petroleum"],
      correctAnswer: "Solar",
    },
  ],
};

interface DailyQuizProps {
  onComplete: (result: { score: number; totalQuestions: number; timeTaken: number; rank: number; correctAnswers: number }) => void;
}

export function DailyQuiz({ onComplete }: DailyQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestion]: answer,
    });
  };

  const handleNext = () => {
    if (currentQuestion < dailyQuizData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);

    // Calculate score
    let correctCount = 0;
    dailyQuizData.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / dailyQuizData.questions.length) * 100);

    // Simulate API call delay
    setTimeout(() => {
      setIsSubmitting(false);
      onComplete({
        score,
        totalQuestions: dailyQuizData.questions.length,
        timeTaken: timeElapsed,
        rank: Math.floor(Math.random() * 50) + 1, // Mock rank
        correctAnswers: correctCount,
      });
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const question = dailyQuizData.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / dailyQuizData.questions.length) * 100;
  const isLastQuestion = currentQuestion === dailyQuizData.questions.length - 1;
  const canSubmit = Object.keys(selectedAnswers).length === dailyQuizData.questions.length;

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4">
        <div className="flex justify-between flex-wrap gap-4 items-center">
          <div>
            <CardTitle className="mb-2">{dailyQuizData.title}</CardTitle>
            <CardDescription>{dailyQuizData.description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatTime(timeElapsed)}</span>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>
              Question {currentQuestion + 1} of {dailyQuizData.questions.length}
            </span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          <div className="text-lg font-medium">{question.question}</div>

          <RadioGroup value={selectedAnswers[currentQuestion] || ""} onValueChange={handleAnswerSelect}>
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-grow cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between pt-4">
        <Button variant="outline" onClick={handlePrevious} disabled={currentQuestion === 0}>
          Previous
        </Button>

        <div className="flex space-x-2">
          {isLastQuestion ? (
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? "Submitting..." : "Submit Challenge"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!selectedAnswers[currentQuestion]}>
              Next Question
            </Button>
          )}
        </div>
      </CardFooter>

      {isLastQuestion && !canSubmit && (
        <div className="px-6 pb-4 flex items-center text-amber-600 text-sm">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span>Please answer all questions before submitting</span>
        </div>
      )}

      {isLastQuestion && canSubmit && !isSubmitting && (
        <div className="px-6 pb-4 flex items-center text-green-600 text-sm">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          <span>All questions answered! You can submit your challenge.</span>
        </div>
      )}
    </Card>
  );
}
