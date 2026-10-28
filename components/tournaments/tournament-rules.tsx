"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tournament } from "./tournament-detail";

interface TournamentRulesProps {
  tournament: Tournament;
}

export function TournamentRules({ tournament }: TournamentRulesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Rules & Guidelines</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Eligibility & Registration</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>All registered users of QuizHub are eligible to participate.</li>
                <li>Registration must be completed before the deadline ({tournament.registrationEnds} remaining).</li>
                <li>Each participant may only register once using their primary account.</li>
                <li>By registering, participants agree to abide by all tournament rules.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger>Tournament Format</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>The tournament consists of {tournament.rounds} rounds.</li>
                <li>Each round contains {tournament.questionsPerRound} questions.</li>
                <li>Questions will be drawn from multiple categories.</li>
                <li>Participants have {tournament.timePerQuestion} seconds to answer each question.</li>
                <li>The format is {tournament.format}.</li>
                {tournament.format === "Elimination" && <li>Top performers from each round advance to the next round.</li>}
                {tournament.format === "Points-based" && <li>Points accumulate across all rounds to determine final standings.</li>}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger>Scoring System</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>Correct answers: 10 points</li>
                <li>Bonus for speed: Up to 5 additional points based on answer speed</li>
                <li>Incorrect answers: 0 points (no penalty)</li>
                <li>Unanswered questions: 0 points</li>
                <li>Streak bonus: 2 extra points for each consecutive correct answer (max 10)</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger>Fair Play & Conduct</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use of external resources or assistance during the tournament is prohibited.</li>
                <li>Sharing questions or answers with other participants is not allowed.</li>
                <li>Multiple accounts or collaborative play is forbidden.</li>
                <li>QuizHub reserves the right to disqualify participants suspected of cheating.</li>
                <li>All participants are expected to maintain respectful conduct in tournament discussions.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5">
            <AccordionTrigger>Technical Requirements</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>Stable internet connection is required.</li>
                <li>Participants are responsible for their own technical setup.</li>
                <li>In case of technical issues, limited accommodations may be made at the organizer's discretion.</li>
                <li>The tournament platform works best on modern browsers (Chrome, Firefox, Safari, Edge).</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6">
            <AccordionTrigger>Prizes & Winners</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>Prize distribution is detailed in the Prizes tab.</li>
                <li>Winners will be announced within 48 hours of tournament completion.</li>
                <li>All prizes will be distributed within 14 days of the announcement.</li>
                <li>Winners may be required to verify their identity before receiving prizes.</li>
                <li>All decisions by tournament organizers regarding winners are final.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
