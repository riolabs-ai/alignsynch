// template-ancestor: components/quiz/quiz-comments.tsx
"use client";

import type { V1Comment } from "@/data/v1/fixtures";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Relative time for a comment, measured against the wall clock. Comments render only after the
 * store hydrates (a client-only effect), so there is no server render of this value to mismatch
 * against — the same post-hydration guarantee `manage-tab.tsx` relies on for its own `relativeDay`.
 */
function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * One comment thread — a relationship thread or a per-Aspect thread. Author, relative time and
 * body, and nothing else: no reactions, no likes, no edit history, per the corrected model.
 * The composer appears only when the viewer is a party and the session is complete.
 */
export function CommentThread({
  heading,
  comments,
  authorName,
  canComment,
  placeholder,
  onAdd,
}: {
  heading: string;
  comments: readonly V1Comment[];
  authorName: (author: "initiator" | "counterparty") => string;
  canComment: boolean;
  placeholder: string;
  onAdd: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (draft.trim() === "") return;
    onAdd(draft.trim());
    setDraft("");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        <span className="text-xs text-muted-foreground">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </span>
      </div>

      {comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {comments.map((entry) => (
            <li key={entry.id} className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {authorName(entry.author)}
                </span>
                <span className="text-[11px] text-muted-foreground">{relativeTime(entry.at)}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{entry.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder={placeholder}
            className={cn(
              "h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm text-foreground",
            )}
          />
          <button
            type="button"
            onClick={submit}
            disabled={draft.trim() === ""}
            className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      )}
    </section>
  );
}
