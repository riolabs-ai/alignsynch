"use client";

import { Clock } from "lucide-react";

interface QuizTimerProps {
  timeRemaining: number;
  formatTime: (seconds: number) => string;
}

export function QuizTimer({ timeRemaining, formatTime }: QuizTimerProps) {
  const isLowTime = timeRemaining < 60; // Less than a minute
  const isMediumTime = timeRemaining < 180 && timeRemaining >= 60; // Less than 3 minutes

  return (
    <div className={`flex items-center gap-2 font-mono text-sm font-medium px-3 py-1.5 rounded-full ${isLowTime ? "bg-red-100 text-red-800 animate-pulse" : isMediumTime ? "bg-yellow-100 text-yellow-800" : "bg-muted text-muted-foreground"}`}>
      <Clock className={`h-4 w-4 ${isLowTime ? "text-red-600" : isMediumTime ? "text-yellow-600" : ""}`} />
      <span>{formatTime(timeRemaining)}</span>
    </div>
  );
}
