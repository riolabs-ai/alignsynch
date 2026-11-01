"use client";

// template-ancestor: components/ui/card.tsx   (variation: the overview tab — three cards: about, format and hosts)

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quizCategoryLabel } from "@/content/categories";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, itemValue, sectionOf } from "@/lib/page-copy";
import { Calendar, CheckCircle, Clock, HelpCircle, Target, Trophy, Users } from "lucide-react";
import { Tournament } from "./tournament-detail";

/**
 * The subjects a tournament spans. Slugs, not labels: `quizCategories` owns the text,
 * and the mock `Tournament` record only carries one `category` string (WU-11), so the
 * list is declared here until the domain does.
 */
const TOURNAMENT_SUBJECTS = [
  "general-knowledge",
  "science",
  "history",
  "geography",
  "sports",
] as const;

interface TournamentOverviewProps {
  tournament: Tournament;
  copy: PageCopy;
}

export function TournamentOverview({ tournament, copy }: TournamentOverviewProps) {
  const about = sectionOf(copy, "about");
  const keyDates = sectionOf(copy, "key-dates");
  const stats = sectionOf(copy, "stats");
  const categories = sectionOf(copy, "categories");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{about.heading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{fillLabel(about.body ?? "", { title: tournament.title })}</p>

            <h3 className="font-semibold text-lg">{itemLabel(about, "format-heading")}</h3>
            <p>
              {fillLabel(itemLabel(about, "format-body"), {
                format: tournament.format,
                rounds: tournament.rounds,
                questions: tournament.questionsPerRound,
                seconds: tournament.timePerQuestion,
              })}
            </p>

            <h3 className="font-semibold text-lg">{itemLabel(about, "eligibility-heading")}</h3>
            <p>
              {fillLabel(itemLabel(about, "eligibility-body"), {
                eligibility: tournament.eligibility,
              })}
            </p>

            <h3 className="font-semibold text-lg">{itemLabel(about, "participate-heading")}</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>{itemLabel(about, "participate-1")}</li>
              <li>{itemLabel(about, "participate-2")}</li>
              <li>{itemLabel(about, "participate-3")}</li>
              <li>{itemLabel(about, "participate-4")}</li>
              <li>{itemLabel(about, "participate-5")}</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{keyDates.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-action mt-0.5" />
                <div>
                  <h4 className="font-medium">{itemLabel(keyDates, "registration-period")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {itemValue(keyDates, "registration-period")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">{itemLabel(keyDates, "qualifying-round")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {itemValue(keyDates, "qualifying-round")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">{itemLabel(keyDates, "main-tournament")}</h4>
                  <p className="text-sm text-muted-foreground">{tournament.dates}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">{itemLabel(keyDates, "winners-announcement")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {itemValue(keyDates, "winners-announcement")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{stats.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{itemLabel(stats, "participants")}</span>
                </div>
                <span className="font-medium">{tournament.participants}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{itemLabel(stats, "prize-pool")}</span>
                </div>
                <span className="font-medium">{tournament.prize}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{itemLabel(stats, "difficulty")}</span>
                </div>
                <span className="font-medium">{tournament.difficulty}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{itemLabel(stats, "time-per-question")}</span>
                </div>
                <span className="font-medium">
                  {fillLabel(itemLabel(stats, "seconds"), { count: tournament.timePerQuestion })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{itemLabel(stats, "total-questions")}</span>
                </div>
                <span className="font-medium">
                  {tournament.rounds * tournament.questionsPerRound}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{categories.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {TOURNAMENT_SUBJECTS.map((slug) => (
                <div key={slug} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{quizCategoryLabel(slug)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
