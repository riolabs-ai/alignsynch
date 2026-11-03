"use client";

// template-ancestor: components/dashboard/dashboard-header.tsx   (variation: the countdown, the streak and the day's reward where the dashboard puts its two actions)

import { Card, CardContent } from "@/components/ui/card";
import { quizCategoryLabel } from "@/content/categories";
import { formatDayCount, formatMetricValue } from "@/content/metrics";
import type { PageCopy } from "@/content/pages";
import { metric } from "@/data/metrics";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { Calendar, Clock, Flame, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Today's subject, as the taxonomy names it. The daily challenge is a Science quiz
 * (components/daily-challenge/daily-quiz.tsx); the label comes from `quizCategories`, so a
 * renamed subject moves here without touching this file.
 */
const TODAYS_THEME = quizCategoryLabel("science");

export function DailyChallengeHeader({ copy }: { copy: PageCopy }) {
  const cards = sectionOf(copy, "stat-cards");
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      const difference = midnight.getTime() - now.getTime();

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (value: number) => value.toString().padStart(2, "0");

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-action/5 dark:bg-action/10 border-action/30">
          <CardContent className="p-4 xl:pt-4 flex items-center space-x-4">
            <div className="p-2 bg-action/10 dark:bg-action/20 rounded-full">
              <Clock className="h-5 w-5 text-action" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {itemLabel(cards, "time-remaining")}
              </p>
              <p className="text-xl font-bold">
                {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:
                {formatTime(timeLeft.seconds)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 xl:pt-4 flex items-center space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {itemLabel(cards, "todays-theme")}
              </p>
              <p className="text-xl font-bold">{TODAYS_THEME}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 xl:pt-4 flex items-center space-x-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full">
              <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {itemLabel(cards, "top-prize")}
              </p>
              <p className="text-xl font-bold">
                {fillLabel(itemLabel(cards, "coins"), {
                  amount: formatMetricValue(metric("daily.challenge.topPrize")),
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardContent className="p-4 xl:pt-4 flex items-center space-x-4">
            <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
              <Flame className="h-5 w-5 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {itemLabel(cards, "your-streak")}
              </p>
              <p className="text-xl font-bold">
                {formatDayCount(metric("daily.challenge.streak.days").value, "upper")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
