"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Difficulty } from "@/content/core";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { shelfCards } from "@/lib/quiz-cards";
import Image from "next/image";
import Link from "next/link";
import { media } from "@/data/media";

export function LatestQuizzes({ copy }: { copy: PageCopySection }) {
  // Projected from the catalogue, never authored here (D2).
  const quizzes = shelfCards("homeLatest");

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: Difficulty) => {
    switch (difficulty) {
      case "easy":
        return "success";
      case "medium":
        return "yellow";
      case "hard":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <section className="space-y-6 bg-indigo-50 py-10 px-4 xl:px-8 dark:bg-slate-900">
      <h2 className="text-2xl font-bold tracking-tight">{copy.heading}</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4">
        {quizzes.map((quiz) => (
          <Card
            key={quiz.id}
            className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
          >
            {/* Image with overlay */}
            <div className="relative h-48">
              <Image
                width={600}
                height={350}
                src={quiz.cover?.src ?? media.placeholder.src}
                alt={quiz.cover?.alt || quiz.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <div className="w-full">
                  <div className="flex justify-between items-center mb-2">
                    <Badge
                      variant={getDifficultyVariant(quiz.difficulty)}
                      className="font-medium capitalize"
                    >
                      {quiz.difficulty}
                    </Badge>
                  </div>
                  <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                </div>
              </div>
            </div>

            <CardContent className="p-4 xl:pt-6 flex justify-between items-center">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                {quiz.categories[0]?.name ?? itemLabel(copy, "empty-category")}
              </Badge>

              <Button size="sm" asChild>
                <Link href={quiz.href}>{itemLabel(copy, "play-now")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        {copy.cta && (
          <Button variant="outline" asChild>
            <Link href={copy.cta.href}>{copy.cta.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
