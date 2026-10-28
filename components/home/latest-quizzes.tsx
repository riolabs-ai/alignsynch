"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

// Sample quiz data
const quizzes = [
  {
    id: 1,
    title: "World Geography Challenge",
    image: "/world-map-quiz.png",
    category: "Geography",
    difficulty: "Medium",
  },
  {
    id: 2,
    title: "Science Quiz: Space Exploration",
    image: "/space-exploration-quiz.png",
    category: "Science",
    difficulty: "Hard",
  },
  {
    id: 3,
    title: "History: Ancient Civilizations",
    image: "/ancient-civilizations-quiz.png",
    category: "History",
    difficulty: "Medium",
  },
  {
    id: 4,
    title: "Mathematical Puzzles",
    image: "/quiz/q9.png",
    category: "Mathematics",
    difficulty: "Hard",
  },
];

export function LatestQuizzes() {
  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "success";
      case "Medium":
        return "yellow";
      case "Hard":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <section className="space-y-6 bg-indigo-50 py-10 px-4 xl:px-8 dark:bg-slate-900">
      <h2 className="text-2xl font-bold tracking-tight">Latest Quizzes</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
            {/* Image with overlay */}
            <div className="relative h-48">
              <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <div className="w-full">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant={getDifficultyVariant(quiz.difficulty)} className="font-medium">
                      {quiz.difficulty}
                    </Badge>
                  </div>
                  <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                </div>
              </div>
            </div>

            <CardContent className="p-4 xl:pt-6 flex justify-between items-center">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                {quiz.category}
              </Badge>

              <Button size="sm" asChild>
                <Link href={`/quiz/${quiz.id}`}>Play Now</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/explore">View All Quizzes</Link>
        </Button>
      </div>
    </section>
  );
}
