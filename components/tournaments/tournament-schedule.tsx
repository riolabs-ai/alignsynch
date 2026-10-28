"use client";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";

export function TournamentSchedule() {
  // Mock schedule data
  const scheduleData = [
    {
      round: 1,
      date: "May 15, 2024",
      time: "14:00 - 15:00",
      description: "Qualifying Round - General Knowledge",
    },
    {
      round: 2,
      date: "May 22, 2024",
      time: "14:00 - 15:00",
      description: "Semi-Finals - Science & Technology",
    },
    {
      round: 3,
      date: "May 29, 2024",
      time: "14:00 - 16:00",
      description: "Final Round - Mixed Categories",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scheduleData.map((item) => (
          <div key={item.round} className="border rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium">Round {item.round}</h3>
              <Badge variant="outline">Qualifying</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{item.date}</span>
              <Clock className="h-4 w-4 ml-4" />
              <span>{item.time}</span>
            </div>
            <p className="mt-2 text-sm">{item.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
