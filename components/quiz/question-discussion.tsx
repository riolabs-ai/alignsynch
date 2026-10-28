"use client";

import { Comment } from "@/components/quiz/comment";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, ChevronDown, ChevronUp, Clock, Flag, MessageSquare, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
type Reply = {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  text: string;
  timestamp: string;
  likes: number;
};

// Update the Discussion type to make replies required
type Discussion = {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  text: string;
  timestamp: string;
  likes: number;
  replies: Reply[];
};

type Question = {
  id: string;
  text: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  difficulty: string;
  timeTaken: number;
  explanation: string;
  discussions: Discussion[];
};
interface QuestionDiscussionProps {
  question: Question;
  questionNumber: number;
}

export function QuestionDiscussion({ question, questionNumber }: QuestionDiscussionProps) {
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [showAddExplanation, setShowAddExplanation] = useState(false);
  const [discussions, setDiscussions] = useState(question.discussions);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
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

    const newCommentObj = {
      id: `d${Date.now()}`,
      user: {
        id: "current-user",
        name: "You",
        avatar: "/avatars/master.png",
      },
      text: newComment,
      timestamp: new Date().toISOString(),
      likes: 0,
      replies: [],
    };

    setDiscussions([...discussions, newCommentObj]);
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
    <Card className={`border-l-4 ${question.isCorrect ? "border-l-green-500" : "border-l-red-500"}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Question {questionNumber}:</span>
            {question.isCorrect ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getDifficultyColor(question.difficulty)}>{question.difficulty}</Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{question.timeTaken}s</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium mb-4">{question.text}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
              <div className="text-xs text-muted-foreground mb-1">Correct Answer</div>
              <div className="font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{question.correctAnswer}</span>
              </div>
            </div>

            {!question.isCorrect && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                <div className="text-xs text-muted-foreground mb-1">Your Answer</div>
                <div className="font-medium flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{question.userAnswer}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Explanation</h3>
            <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
              <p className="text-sm">{question.explanation}</p>
            </div>
          </div>

          {discussions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Community Explanations & Discussion</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowDiscussion(!showDiscussion)} className="flex items-center gap-1 h-8">
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
                  {discussions.map((discussion: Discussion) => (
                    <Comment key={discussion.id} comment={discussion} />
                  ))}
                </div>
              )}
            </div>
          )}

          {showDiscussion || discussions.length === 0 ? (
            <div className="space-y-3">
              {!showAddExplanation ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddExplanation(true)} className="flex items-center gap-1">
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
                  <Textarea placeholder="Add your explanation or insight about this question..." value={newExplanation} onChange={(e) => setNewExplanation(e.target.value)} className="min-h-[100px]" />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddExplanation(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddExplanation} className="flex items-center gap-1">
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
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/avatars/master.png" alt="Your Avatar" />
                        <AvatarFallback>YO</AvatarFallback>
                      </Avatar>
                      <Textarea placeholder="Add a comment or question..." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="flex-1" />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()} className="flex items-center gap-1">
                        <Send className="h-4 w-4" />
                        <span>Post</span>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowDiscussion(true)} className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>Join Discussion ({discussions.length})</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
