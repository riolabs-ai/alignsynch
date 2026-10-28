"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle, Clock, HelpCircle, Target, Trophy, Users } from "lucide-react";
import { Tournament } from "./tournament-detail";

interface TournamentOverviewProps {
  tournament: Tournament;
}

export function TournamentOverview({ tournament }: TournamentOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>About This Tournament</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Welcome to the {tournament.title}! This exciting tournament will test your knowledge across multiple categories and challenge you to compete against quiz enthusiasts from around the world.</p>

            <h3 className="font-semibold text-lg">Tournament Format</h3>
            <p>
              This tournament follows a {tournament.format} format with {tournament.rounds} rounds of competition. Each round consists of {tournament.questionsPerRound} questions across various categories, with {tournament.timePerQuestion} seconds allowed per question.
            </p>

            <h3 className="font-semibold text-lg">Eligibility</h3>
            <p>{tournament.eligibility}. All participants must have a registered account on QuizHub and agree to the tournament rules and fair play guidelines.</p>

            <h3 className="font-semibold text-lg">How to Participate</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Register for the tournament before the registration deadline</li>
              <li>Complete any qualifying rounds if applicable</li>
              <li>Log in during the scheduled tournament times</li>
              <li>Answer questions within the time limit</li>
              <li>Track your progress on the leaderboard</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Key Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Registration Period</h4>
                  <p className="text-sm text-muted-foreground">May 1 - May 14, 2023</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Qualifying Round</h4>
                  <p className="text-sm text-muted-foreground">May 15 - May 20, 2023</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Main Tournament</h4>
                  <p className="text-sm text-muted-foreground">{tournament.dates}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Winners Announcement</h4>
                  <p className="text-sm text-muted-foreground">June 12, 2023</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tournament Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Participants</span>
                </div>
                <span className="font-medium">{tournament.participants}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Prize Pool</span>
                </div>
                <span className="font-medium">{tournament.prize}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Difficulty</span>
                </div>
                <span className="font-medium">{tournament.difficulty}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Time per Question</span>
                </div>
                <span className="font-medium">{tournament.timePerQuestion} seconds</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Questions</span>
                </div>
                <span className="font-medium">{tournament.rounds * tournament.questionsPerRound}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>General Knowledge</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Science & Technology</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>History & Geography</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Entertainment & Pop Culture</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Sports & Leisure</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
