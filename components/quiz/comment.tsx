"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Flag, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { useState } from "react";
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
interface CommentProps {
  comment: {
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
}

export function Comment({ comment }: CommentProps) {
  const [likes, setLikes] = useState(comment.likes);
  const [userLiked, setUserLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState(comment.replies);

  const handleLike = () => {
    if (userLiked) {
      setLikes(likes - 1);
      setUserLiked(false);
    } else {
      setLikes(likes + 1);
      setUserLiked(true);
    }
  };

  const handleAddReply = () => {
    if (!replyText.trim()) return;

    const newReply = {
      id: `r${Date.now()}`,
      user: {
        id: "current-user",
        name: "You",
        avatar: "/avatars/master.png",
      },
      text: replyText,
      timestamp: new Date().toISOString(),
      likes: 0,
    };

    setReplies([...replies, newReply]);
    setReplyText("");
    setShowReplyForm(false);
    setShowReplies(true);
  };

  return (
    <div className="border rounded-md p-4">
      <div className="flex items-start gap-3">
        <Avatar>
          <AvatarImage src={comment.user.avatar || "/placeholder.svg"} alt={comment.user.name} />
          <AvatarFallback>{comment.user.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{comment.user.name}</h3>
              <p className="text-xs text-muted-foreground">{new Date(comment.timestamp).toLocaleString()}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Flag className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm mt-2">{comment.text}</p>
          <div className="flex items-center gap-4 mt-3">
            <Button variant="ghost" size="sm" onClick={handleLike} className={`flex items-center gap-1 h-8 ${userLiked ? "text-blue-600" : ""}`}>
              <ThumbsUp className="h-4 w-4" />
              <span>{likes}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowReplyForm(!showReplyForm)} className="flex items-center gap-1 h-8">
              <MessageSquare className="h-4 w-4" />
              <span>Reply</span>
            </Button>

            {replies.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1 h-8">
                {showReplies ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    <span>Hide Replies</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    <span>Show Replies ({replies.length})</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-3 space-y-3">
              <Textarea placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="min-h-[80px]" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowReplyForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAddReply} disabled={!replyText.trim()} className="flex items-center gap-1">
                  <Send className="h-4 w-4" />
                  <span>Reply</span>
                </Button>
              </div>
            </div>
          )}

          {showReplies && replies.length > 0 && (
            <div className="mt-4 space-y-3 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
              {replies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-3">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={reply.user.avatar || "/placeholder.svg"} alt={reply.user.name} />
                    <AvatarFallback>{reply.user.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">{reply.user.name}</h4>
                        <p className="text-xs text-muted-foreground">{new Date(reply.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-sm mt-1">{reply.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
