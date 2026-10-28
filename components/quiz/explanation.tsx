"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

interface ExplanationProps {
  explanation: {
    id: string;
    user: {
      id: string;
      name: string;
      avatar: string;
    };
    text: string;
    timestamp: string;
    upvotes: number;
    downvotes: number;
  };
}

export function Explanation({ explanation }: ExplanationProps) {
  const [upvotes, setUpvotes] = useState(explanation.upvotes || 0);
  const [downvotes, setDownvotes] = useState(explanation.downvotes || 0);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);

  const handleUpvote = () => {
    if (userVote === "up") {
      setUpvotes(upvotes - 1);
      setUserVote(null);
    } else {
      if (userVote === "down") {
        setDownvotes(downvotes - 1);
      }
      setUpvotes(upvotes + 1);
      setUserVote("up");
    }
  };

  const handleDownvote = () => {
    if (userVote === "down") {
      setDownvotes(downvotes - 1);
      setUserVote(null);
    } else {
      if (userVote === "up") {
        setUpvotes(upvotes - 1);
      }
      setDownvotes(downvotes + 1);
      setUserVote("down");
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={explanation.user.avatar || "/placeholder.svg"} alt={explanation.user.name} />
            <AvatarFallback>{explanation.user.name.substring(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{explanation.user.name}</h3>
                <p className="text-xs text-muted-foreground">{new Date(explanation.timestamp).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Flag className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm mt-2">{explanation.text}</p>
            <div className="flex items-center gap-4 mt-3">
              <Button variant="ghost" size="sm" onClick={handleUpvote} className={`flex items-center gap-1 h-8 ${userVote === "up" ? "text-green-600" : ""}`}>
                <ThumbsUp className="h-4 w-4" />
                <span>{upvotes}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownvote} className={`flex items-center gap-1 h-8 ${userVote === "down" ? "text-red-600" : ""}`}>
                <ThumbsDown className="h-4 w-4" />
                <span>{downvotes}</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
