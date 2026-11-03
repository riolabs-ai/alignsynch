"use client";

// template-ancestor: components/ui/card.tsx   (variation: the per-question thread — the question, the reader's answer, the comments and a composer)

import { Comment } from "@/components/quiz/comment";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Difficulty } from "@/content/core";
import type { Question } from "@/content/quiz";
import type { QuizAnswer, QuizCommentThread } from "@/content/quiz-result";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  MessageSquare,
  Send,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface QuestionDiscussionProps {
  /** The quiz the question belongs to (only the draft comment needs it). */
  quizId: string;
  /** The question record — `prompt`/`options`/`correctOptionId` are the model's names. */
  question: Question;
  /** The viewer's answer to this question, when the sheet carries one. */
  answer?: QuizAnswer;
  /** The quiz's difficulty. `zQuestion` has no per-question difficulty, so there is
   *  no second value that could disagree with the record. */
  difficulty: Difficulty;
  /** Threads about this question, from `selectCommentThreads`. */
  threads: QuizCommentThread[];
  questionNumber: number;
}

/**
 * One question on the review screen: what you answered, what was right, why, and
 * the thread about it.
 *
 * This component used to take a locally-declared `Question` (`text`,
 * `correctAnswer`, `userAnswer`, `isCorrect`, `timeTaken`, `discussions`) — a second
 * shape for a quiz question that had already drifted from the model's
 * `prompt`/`options`/`correctOptionId`. Now every value is either the record or the
 * sheet, and the answer TEXT is looked up from the option id instead of stored
 * beside it, so a renamed option cannot leave a stale answer string behind.
 */
export function QuestionDiscussion({
  quizId,
  question,
  answer,
  difficulty,
  threads,
  questionNumber,
}: QuestionDiscussionProps) {
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [showAddExplanation, setShowAddExplanation] = useState(false);
  const [discussions, setDiscussions] = useState<QuizCommentThread[]>(threads);

  const correctOption = question.options.find((option) => option.id === question.correctOptionId);
  const selectedOption = question.options.find((option) => option.id === answer?.selectedOptionId);
  const isCorrect = answer?.isCorrect ?? false;

  const getDifficultyColor = (value: Difficulty) => {
    switch (value) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "medium":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    // A comment typed here is a draft, not a fixture record: it lives in this
    // session only and its id says so.
    const draft: QuizCommentThread = {
      comment: {
        id: `local-comment-${discussions.length + 1}`,
        quizId,
        questionId: question.id,
        author: {
          id: "current-user",
          name: "You",
        },
        body: newComment,
        createdAt: new Date().toISOString(),
        likes: 0,
      },
      replies: [],
    };

    setDiscussions([...discussions, draft]);
    setNewComment("");
  };

  const handleAddExplanation = () => {
    if (!newExplanation.trim()) return;

    // In a real app, you would send this to your backend
    toast.success("Explanation submitted successfully!");
    setNewExplanation("");
    setShowAddExplanation(false);
  };

  return (
    <Card className={`border-l-4 ${isCorrect ? "border-l-green-500" : "border-l-red-500"}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Question {questionNumber}:</span>
            {isCorrect ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getDifficultyColor(difficulty)}>{difficulty}</Badge>
            {answer !== undefined && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{answer.secondsSpent}s</span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium mb-4">{question.prompt}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
              <div className="text-xs text-muted-foreground mb-1">Correct Answer</div>
              <div className="font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{correctOption?.text ?? "—"}</span>
              </div>
            </div>

            {!isCorrect && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                <div className="text-xs text-muted-foreground mb-1">Your Answer</div>
                <div className="font-medium flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{selectedOption?.text ?? "Skipped"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {question.explanation !== undefined && (
            <div>
              <h3 className="text-sm font-medium mb-2">Explanation</h3>
              <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                <p className="text-sm">{question.explanation}</p>
              </div>
            </div>
          )}

          {discussions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Community Explanations & Discussion</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiscussion(!showDiscussion)}
                  className="flex items-center gap-1 h-8"
                >
                  {showDiscussion ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      <span>Show ({discussions.length})</span>
                    </>
                  )}
                </Button>
              </div>

              {showDiscussion && (
                <div className="space-y-4">
                  {discussions.map((thread) => (
                    <Comment key={thread.comment.id} thread={thread} />
                  ))}
                </div>
              )}
            </div>
          )}

          {showDiscussion || discussions.length === 0 ? (
            <div className="space-y-3">
              {!showAddExplanation ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddExplanation(true)}
                    className="flex items-center gap-1"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Add Explanation</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Flag className="h-4 w-4" />
                    <span>Report Question</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add your explanation or insight about this question..."
                    value={newExplanation}
                    onChange={(e) => setNewExplanation(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddExplanation(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddExplanation}
                      className="flex items-center gap-1"
                    >
                      <Send className="h-4 w-4" />
                      <span>Submit Explanation</span>
                    </Button>
                  </div>
                </div>
              )}

              {(showDiscussion || discussions.length === 0) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <GeneratedAvatar name="Your profile" seed="current-user" size={32} />
                      <Textarea
                        placeholder="Add a comment or question..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="flex items-center gap-1"
                      >
                        <Send className="h-4 w-4" />
                        <span>Post</span>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiscussion(true)}
              className="flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Join Discussion ({discussions.length})</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
