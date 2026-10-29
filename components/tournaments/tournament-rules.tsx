"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { metric } from "@/data/metrics";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Tournament } from "./tournament-detail";

/**
 * The six accordion groups, in render order: the fixture owns the words of every
 * heading and bullet, this owns the group ids and which bullets belong to which group
 * (`PageCopySection` has `items`, not nested sections — see the fixture's header).
 */
const GROUPS = [
  {
    id: "eligibility",
    heading: "group-eligibility",
    items: ["eligibility-1", "eligibility-2", "eligibility-3", "eligibility-4"],
  },
  {
    id: "format",
    heading: "group-format",
    items: [
      "format-1",
      "format-2",
      "format-3",
      "format-4",
      "format-5",
      "format-elimination",
      "format-points",
    ],
  },
  {
    id: "scoring",
    heading: "group-scoring",
    items: ["scoring-1", "scoring-2", "scoring-3", "scoring-4", "scoring-5"],
  },
  {
    id: "fair-play",
    heading: "group-fair-play",
    items: ["fair-play-1", "fair-play-2", "fair-play-3", "fair-play-4", "fair-play-5"],
  },
  {
    id: "technical",
    heading: "group-technical",
    items: ["technical-1", "technical-2", "technical-3", "technical-4"],
  },
  {
    id: "prizes",
    heading: "group-prizes",
    items: ["prizes-1", "prizes-2", "prizes-3", "prizes-4", "prizes-5"],
  },
] as const;

/**
 * Two bullets only apply to one tournament format; every other id always renders. The
 * fixture carries both so the wording lives in one place, and the view decides which
 * one the record's `format` selects.
 */
function appliesTo(id: string, format: string): boolean {
  if (id === "format-elimination") return format === "Elimination";
  if (id === "format-points") return format === "Points-based";
  return true;
}

interface TournamentRulesProps {
  tournament: Tournament;
  copy: PageCopySection;
}

export function TournamentRules({ tournament, copy }: TournamentRulesProps) {
  // What each bullet's `{placeholders}` are filled from — the record's numbers, and the
  // scoring metrics `content/metrics.ts` formats. A bullet with no entry here keeps its
  // placeholders visible (`fillLabel` leaves an unknown key as written).
  const values: Record<string, Record<string, string | number>> = {
    "eligibility-2": { days: tournament.registrationEnds },
    "format-1": { rounds: tournament.rounds },
    "format-2": { questions: tournament.questionsPerRound },
    "format-4": { seconds: tournament.timePerQuestion },
    "format-5": { format: tournament.format },
    "scoring-1": { points: formatCount(metric("tournament.rules.correctPoints").value) },
    "scoring-2": { points: formatCount(metric("tournament.rules.speedBonusPoints").value) },
    "scoring-3": { points: formatCount(metric("tournament.rules.incorrectPoints").value) },
    "scoring-4": { points: formatCount(metric("tournament.rules.unansweredPoints").value) },
    "scoring-5": {
      points: formatCount(metric("tournament.rules.streakBonusPerAnswer").value),
      max: formatCount(metric("tournament.rules.streakBonusMax").value),
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {GROUPS.map((group, index) => (
            <AccordionItem key={group.id} value={`item-${index + 1}`}>
              <AccordionTrigger>{itemLabel(copy, group.heading)}</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-5 space-y-2">
                  {group.items
                    .filter((id) => appliesTo(id, tournament.format))
                    .map((id) => (
                      <li key={id}>{fillLabel(itemLabel(copy, id), values[id] ?? {})}</li>
                    ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
