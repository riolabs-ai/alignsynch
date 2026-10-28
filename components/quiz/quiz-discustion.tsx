"use client";

import { QuestionDiscussion } from "@/components/quiz/question-discussion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, Clock, RotateCw, Share2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// Mock quiz result data - in a real app, you would fetch this based on the ID
const mockQuizResult = {
  id: "1",
  title: "Avengers Quiz",
  score: {
    correct: 7,
    wrong: 3,
    total: 10,
    percentage: 70,
  },
  timeTaken: "8m 45s",
  completedAt: "2023-10-15T14:30:00Z",
  questions: [
    {
      id: "q1",
      text: "Who was the first Avenger to be introduced in the MCU?",
      correctAnswer: "Iron Man",
      userAnswer: "Iron Man",
      isCorrect: true,
      difficulty: "easy",
      timeTaken: 12,
      explanation: "Iron Man was released in 2008 and was the first film in the Marvel Cinematic Universe.",
      discussions: [
        {
          id: "d1",
          user: {
            id: "u1",
            name: "MarvelFan",
            avatar: "/avatars/genious.png",
          },
          text: "Technically, Captain America existed first in the timeline, but Iron Man was the first movie released.",
          timestamp: "2023-10-15T15:30:00Z",
          likes: 12,
          replies: [
            {
              id: "r1",
              user: {
                id: "u2",
                name: "ComicBookGuru",
                avatar: "/avatars/guru.png",
              },
              text: "That's right! The Captain America movie came out in 2011 but was set during World War II.",
              timestamp: "2023-10-15T16:15:00Z",
              likes: 5,
            },
          ],
        },
      ],
    },
    {
      id: "q2",
      text: "What is the name of Thor's hammer?",
      correctAnswer: "Mjölnir",
      userAnswer: "Mjölnir",
      isCorrect: true,
      difficulty: "easy",
      timeTaken: 8,
      explanation: "Mjölnir is the enchanted hammer wielded by Thor, the Norse god of thunder.",
      discussions: [],
    },
    {
      id: "q3",
      text: "What is the real name of the Black Panther?",
      correctAnswer: "T'Challa",
      userAnswer: "T'Challa",
      isCorrect: true,
      difficulty: "medium",
      timeTaken: 15,
      explanation: "T'Challa is the king of the fictional African nation of Wakanda and the superhero known as Black Panther.",
      discussions: [],
    },
    {
      id: "q4",
      text: "Which Infinity Stone was located in Loki's scepter?",
      correctAnswer: "Mind Stone",
      userAnswer: "Soul Stone",
      isCorrect: false,
      difficulty: "medium",
      timeTaken: 20,
      explanation: "The Mind Stone was housed in Loki's scepter, which was later used to create Vision.",
      discussions: [
        {
          id: "d2",
          user: {
            id: "u3",
            name: "InfinityExpert",
            avatar: "/avatars/brain.png",
          },
          text: "The Mind Stone has a yellow color, while the Soul Stone is orange. This is a common mix-up!",
          timestamp: "2023-10-16T10:45:00Z",
          likes: 8,
          replies: [],
        },
      ],
    },
    {
      id: "q5",
      text: "Who was the main villain in 'Guardians of the Galaxy'?",
      correctAnswer: "Ronan the Accuser",
      userAnswer: "Thanos",
      isCorrect: false,
      difficulty: "medium",
      timeTaken: 18,
      explanation: "While Thanos appeared in the film, Ronan the Accuser was the main antagonist in the first Guardians of the Galaxy movie.",
      discussions: [],
    },
    {
      id: "q6",
      text: "What type of doctor is Stephen Strange?",
      correctAnswer: "Neurosurgeon",
      userAnswer: "Neurosurgeon",
      isCorrect: true,
      difficulty: "medium",
      timeTaken: 10,
      explanation: "Before becoming the Sorcerer Supreme, Dr. Stephen Strange was a brilliant neurosurgeon.",
      discussions: [],
    },
    {
      id: "q7",
      text: "What is the name of Tony Stark's AI assistant that replaced JARVIS?",
      correctAnswer: "FRIDAY",
      userAnswer: "FRIDAY",
      isCorrect: true,
      difficulty: "hard",
      timeTaken: 22,
      explanation: "After JARVIS became Vision, Tony Stark activated FRIDAY as his new AI assistant.",
      discussions: [],
    },
    {
      id: "q8",
      text: "In which film did Spider-Man make his first appearance in the MCU?",
      correctAnswer: "Captain America: Civil War",
      userAnswer: "Captain America: Civil War",
      isCorrect: true,
      difficulty: "medium",
      timeTaken: 14,
      explanation: "Spider-Man, played by Tom Holland, first appeared in the MCU in Captain America: Civil War before getting his solo film.",
      discussions: [],
    },
    {
      id: "q9",
      text: "What is the name of the planet where Thor and Hulk reunite in Thor: Ragnarok?",
      correctAnswer: "Sakaar",
      userAnswer: "Asgard",
      isCorrect: false,
      difficulty: "hard",
      timeTaken: 25,
      explanation: "Sakaar is the garbage planet ruled by the Grandmaster where Thor is captured and forced to fight in the Contest of Champions.",
      discussions: [],
    },
    {
      id: "q10",
      text: "Who directed 'Avengers: Endgame'?",
      correctAnswer: "The Russo Brothers",
      userAnswer: "The Russo Brothers",
      isCorrect: true,
      difficulty: "medium",
      timeTaken: 16,
      explanation: "Anthony and Joe Russo directed both Avengers: Infinity War and Avengers: Endgame.",
      discussions: [],
    },
  ],
};

export function QuizDiscussion({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [questionsPerPage] = useState(5);
  const [filteredQuestions, setFilteredQuestions] = useState(mockQuizResult.questions);

  // Filter questions based on active tab
  useEffect(() => {
    if (activeTab === "all") {
      setFilteredQuestions(mockQuizResult.questions);
    } else if (activeTab === "correct") {
      setFilteredQuestions(mockQuizResult.questions.filter((q) => q.isCorrect));
    } else if (activeTab === "incorrect") {
      setFilteredQuestions(mockQuizResult.questions.filter((q) => !q.isCorrect));
    } else if (activeTab === "discussed") {
      setFilteredQuestions(mockQuizResult.questions.filter((q) => q.discussions.length > 0));
    }
    setCurrentPage(1);
  }, [activeTab]);

  // Get current questions for pagination
  const indexOfLastQuestion = currentPage * questionsPerPage;
  const indexOfFirstQuestion = indexOfLastQuestion - questionsPerPage;
  const currentQuestions = filteredQuestions.slice(indexOfFirstQuestion, indexOfLastQuestion);
  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);

  return (
    <div className="container mx-auto py-4">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/quiz/${id}`} className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Quiz
          </Link>
        </Button>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl md:text-2xl">{mockQuizResult.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Completed on {new Date(mockQuizResult.completedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <RotateCw className="h-4 w-4" />
                  <span>Play Again</span>
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
                    {mockQuizResult.score.correct} / {mockQuizResult.score.total}
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
                    {mockQuizResult.score.wrong} / {mockQuizResult.score.total}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time Taken</div>
                  <div className="font-medium">{mockQuizResult.timeTaken}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="flex overflow-x-auto md:grid w-full md:grid-cols-4">
            <TabsTrigger value="all">All Questions</TabsTrigger>
            <TabsTrigger value="correct">Correct ({mockQuizResult.score.correct})</TabsTrigger>
            <TabsTrigger value="incorrect">Incorrect ({mockQuizResult.score.wrong})</TabsTrigger>
            <TabsTrigger value="discussed">Discussed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="space-y-6">
              {currentQuestions.map((question, index) => (
                <QuestionDiscussion key={question.id} question={question} questionNumber={indexOfFirstQuestion + index + 1} />
              ))}

              {filteredQuestions.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground mb-4">No questions found in this category.</p>
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
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                    Previous
                  </Button>
                  <div className="flex items-center mx-4">
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
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
