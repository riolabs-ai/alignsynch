"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CreatedQuiz } from "@/lib/data/users";
import { format } from "date-fns";
import { Star } from "lucide-react";
import Image from "next/image";

interface QuizPreviewModalProps {
  quiz: CreatedQuiz | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFull: () => void;
}

export function QuizPreviewModal({ quiz, isOpen, onClose, onViewFull }: QuizPreviewModalProps) {
  if (!quiz) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Quiz Preview: {quiz.title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="relative aspect-video w-full">
            <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} fill className="rounded-md object-cover" />
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Description</h3>
              <p className="text-muted-foreground">{quiz.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-background">
                {quiz.category}
              </Badge>
              <Badge
                variant="outline"
                className={`
                  ${quiz.difficulty === "easy" ? "border-green-500 bg-green-50 text-green-700" : quiz.difficulty === "medium" ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700"}
                `}
              >
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </Badge>
              <Badge variant="outline" className="bg-background">
                {quiz.questions} Questions
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Plays</span>
                    <span className="font-semibold">{quiz.plays.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Average Score</span>
                    <span className="font-semibold">{quiz.averageScore}%</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rating</span>
                    <span className="flex items-center font-semibold">
                      {quiz.rating.toFixed(1)}
                      <Star className="ml-1 h-4 w-4 text-amber-500" />
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Created</span>
                    <span className="font-semibold">{format(new Date(quiz.createdAt), "MMM d, yyyy")}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {quiz.isTournament && quiz.tournamentDetails && (
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-4">
                  <h3 className="mb-2 text-base font-semibold text-purple-800">Tournament Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-purple-700">Status:</span> <span className="capitalize text-purple-900">{quiz.tournamentDetails.status}</span>
                    </div>
                    <div>
                      <span className="font-medium text-purple-700">Participants:</span> <span className="text-purple-900">{quiz.tournamentDetails.participants}</span>
                    </div>
                    <div>
                      <span className="font-medium text-purple-700">Start Date:</span> <span className="text-purple-900">{format(new Date(quiz.tournamentDetails.startDate), "MMM d, yyyy")}</span>
                    </div>
                    <div>
                      <span className="font-medium text-purple-700">End Date:</span> <span className="text-purple-900">{format(new Date(quiz.tournamentDetails.endDate), "MMM d, yyyy")}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-purple-700">Prize:</span> <span className="text-purple-900">{quiz.tournamentDetails.prize}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onViewFull}>View Full Quiz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
