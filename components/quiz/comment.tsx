"use client";

// template-ancestor: components/ui/card.tsx   (variation: one comment hand-written — avatar, body, vote and reply controls, collapsible replies, no card primitive)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeLong } from "@/content/core";
import type { QuizComment, QuizCommentThread } from "@/content/quiz-result";
import { ChevronDown, ChevronUp, Flag, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { useState } from "react";

/**
 * One comment and its one level of replies.
 *
 * The record comes from `data/quiz-comments.ts` through `selectCommentThreads`;
 * only the interactions (the like toggle, a reply typed in this session) are local
 * state. Before, this file declared its own `Comment`/`Reply` shapes and
 * `question-discussion.tsx` declared them a second time — two types for one row,
 * which is how the two screens drifted.
 */
export function Comment({ thread }: { thread: QuizCommentThread }) {
  const { comment } = thread;
  const [likes, setLikes] = useState(comment.likes);
  const [userLiked, setUserLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState<QuizComment[]>(thread.replies);

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

    // A reply typed here is a draft: it is not a fixture record, so it carries a
    // session id rather than pretending to be one of the authored comments.
    const newReply: QuizComment = {
      id: `local-reply-${replies.length + 1}`,
      quizId: comment.quizId,
      ...(comment.questionId !== undefined ? { questionId: comment.questionId } : {}),
      author: {
        id: "current-user",
        name: "You",
      },
      body: replyText,
      createdAt: new Date().toISOString(),
      likes: 0,
      parentId: comment.id,
    };

    setReplies([...replies, newReply]);
    setReplyText("");
    setShowReplyForm(false);
    setShowReplies(true);
  };

  return (
    <div className="border rounded-md p-4">
      <div className="flex items-start gap-3">
        <GeneratedAvatar
          name={comment.author.name}
          seed={comment.author.id ?? comment.author.name}
          size={40}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{comment.author.name}</h3>
              <p className="text-xs text-muted-foreground">
                {formatDateTimeLong(comment.createdAt)}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Flag className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm mt-2">{comment.body}</p>
          <div className="flex items-center gap-4 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`flex items-center gap-1 h-8 ${userLiked ? "text-blue-600" : ""}`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span>{likes}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1 h-8"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Reply</span>
            </Button>

            {replies.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 h-8"
              >
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
              <Textarea
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowReplyForm(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddReply}
                  disabled={!replyText.trim()}
                  className="flex items-center gap-1"
                >
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
                  <GeneratedAvatar
                    name={reply.author.name}
                    seed={reply.author.id ?? reply.author.name}
                    size={28}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">{reply.author.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTimeLong(reply.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm mt-1">{reply.body}</p>
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
