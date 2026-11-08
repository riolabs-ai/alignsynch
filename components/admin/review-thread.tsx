"use client";

/**
 * template-ancestor: components/admin/support-thread.tsx   (variation: one review issue's thread — the inbox's audited-write form pattern (a server callback handed down, a pending state, a refusal drawn as a sentence) over a GitHub-shaped issue: the report, the replies, a reply composer and one control that closes or reopens the issue)
 *
 * `/admin/review`, the open issue (`?issue=`) (#665 follow-up).
 *
 * **Two writes, both the store's.** `onComment` is `commentOnReviewIssueAction` and
 * `onSetState` is `setReviewIssueStateAction`, passed down from the page — a client component never
 * imports a `"use server"` module's action itself. The reason each write carries is the screen's own
 * copy (`reply to issue #3`), because `act()` needs eight characters and a reviewer typing a
 * sentence to close a ticket is the friction the store's `reviewTodoReasonOf` already declined.
 *
 * **Optimistic for one round trip, then the server's answer.** Commenting draws the reply at once,
 * greyed with the fixture's "not committed yet" line, and `router.refresh()` replaces it with the
 * row the store wrote; closing flips the badge at once and reverts if the store refuses. Nothing
 * local survives the re-read: the state override is dropped whenever the record arrives, so a
 * refused close cannot leave a badge lying about a row that is still open.
 *
 * **The flash is 1.5 s and it is decoration.** `border-action bg-action/5` sits on the row or the
 * badge that just changed — the inbox's highlight, here — and nothing reads it.
 *
 * Literal-free (E23): every word is `data/pages/admin-review.ts`; the report, the replies, the
 * labels and the instants are rows.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { ReviewIssue, ReviewIssueComment, ReviewIssueState } from "@/content/review";
import type {
  ReviewActionOutcome,
  ReviewCommentInput,
  ReviewIssueStateInput,
} from "@/lib/admin/review-inputs";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { reviewArtifactPath } from "@/lib/review/paths";
import { cn } from "@/lib/utils";

import { refusalSentence } from "./review-refusal";

/** How long a row or a badge stays highlighted after its write landed. Decoration, not state. */
const FLASH_MS = 1500;

/** Open is the alarm; closed is quiet. Same two variants the feedback list uses. */
const ISSUE_VARIANT: Record<ReviewIssueState, "warning" | "muted"> = {
  open: "warning",
  closed: "muted",
};

/** What the last write answered, or nothing yet. */
type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "refused"; readonly code: string }
  | { readonly kind: "failed" };

export function ReviewIssueThread({
  copy,
  thread,
  onComment,
  onSetState,
}: {
  copy: PageCopy;
  thread: { readonly issue: ReviewIssue; readonly comments: readonly ReviewIssueComment[] };
  onComment: (input: ReviewCommentInput) => Promise<ReviewActionOutcome>;
  onSetState: (input: ReviewIssueStateInput) => Promise<ReviewActionOutcome>;
}) {
  const router = useRouter();
  const issueCopy = sectionOf(copy, "issue");
  const feedbackCopy = sectionOf(copy, "feedback");
  const refusals = sectionOf(copy, "refusals");

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<"comment" | "state" | null>(null);
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [stateOverride, setStateOverride] = useState<ReviewIssueState | null>(null);
  const [flash, setFlash] = useState<"comment" | "state" | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const issue = thread.issue;
  const state = stateOverride ?? issue.state;

  // The record wins: a fresh render drops the optimistic state, so a refused close cannot leave a
  // badge saying `closed` over a row the store left `open`. Same render-time adjustment as the
  // checklist, for the same reason.
  const [seenThread, setSeenThread] = useState(thread);
  if (seenThread !== thread) {
    setSeenThread(thread);
    setStateOverride(null);
  }
  useEffect(() => {
    if (flash === null) return;
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const submitComment = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy !== null) return;
    const text = body.trim();
    if (text === "") {
      setPhase({ kind: "refused", code: "empty-body" });
      return;
    }
    setBusy("comment");
    setPhase({ kind: "idle" });
    setPendingBody(text);
    void onComment({
      issueId: issue.id,
      body: text,
      reason: fillLabel(itemLabel(issueCopy, "reason-comment"), { number: issue.number }),
    })
      .then((outcome) => {
        if (!outcome.ok) {
          setPhase({ kind: "refused", code: outcome.code });
          return;
        }
        setBody("");
        router.refresh();
        setFlash("comment");
      })
      .catch(() => setPhase({ kind: "failed" }))
      .finally(() => {
        setPendingBody(null);
        setBusy(null);
      });
  };

  const move = (next: ReviewIssueState): void => {
    if (busy !== null) return;
    setBusy("state");
    setPhase({ kind: "idle" });
    setStateOverride(next);
    void onSetState({
      issueId: issue.id,
      state: next,
      reason: fillLabel(
        itemLabel(issueCopy, next === "closed" ? "reason-close" : "reason-reopen"),
        {
          number: issue.number,
        },
      ),
    })
      .then((outcome) => {
        if (!outcome.ok) {
          setStateOverride(null);
          setPhase({ kind: "refused", code: outcome.code });
          return;
        }
        router.refresh();
        setFlash("state");
      })
      .catch(() => {
        setStateOverride(null);
        setPhase({ kind: "failed" });
      })
      .finally(() => setBusy(null));
  };

  const lastCommentId = thread.comments[thread.comments.length - 1]?.id ?? null;

  return (
    <Card data-issue-thread={issue.number}>
      <CardHeader className="space-y-3">
        <Link
          href={reviewArtifactPath(issue.artifactId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {itemLabel(issueCopy, "back")}
        </Link>
        <div className="space-y-2">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>{issue.title}</span>
            <Badge
              variant={ISSUE_VARIANT[state]}
              data-issue-state={state}
              className={cn(flash === "state" && "border-action bg-action/5")}
            >
              {itemLabel(feedbackCopy, `state-${state}`)}
            </Badge>
            <span className="text-sm font-normal text-muted-foreground">
              {fillLabel(itemLabel(feedbackCopy, "number"), { number: issue.number })}
            </span>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            {issue.labels.map((label) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label}
              </Badge>
            ))}
            <span>
              {fillLabel(itemLabel(feedbackCopy, "opened-by"), {
                author: issue.authorUserId,
                date: formatDate(issue.openedAt),
              })}
            </span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
            {itemLabel(issueCopy, "body-heading")}
          </h3>
          <p className="text-sm">{issue.body}</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
            {itemLabel(issueCopy, "thread-heading")}
          </h3>
          {thread.comments.length === 0 && pendingBody === null ? (
            <p className="text-sm text-muted-foreground">{itemLabel(issueCopy, "no-replies")}</p>
          ) : null}
          <ul className="space-y-3">
            {thread.comments.map((comment) => (
              <li
                key={comment.id}
                data-comment={comment.id}
                className={cn(
                  "rounded-md border p-3 transition-colors",
                  flash === "comment" && comment.id === lastCommentId
                    ? "border-action bg-action/5"
                    : "border-gray-200",
                )}
              >
                <p className="text-xs text-muted-foreground">
                  {fillLabel(itemLabel(feedbackCopy, "opened-by"), {
                    author: comment.authorUserId,
                    date: formatDate(comment.createdAt),
                  })}
                </p>
                <p className="mt-1 text-sm">{comment.body}</p>
              </li>
            ))}
            {pendingBody === null ? null : (
              <li
                data-comment="pending"
                className="rounded-md border border-action bg-action/5 p-3 transition-colors"
              >
                <p className="text-xs text-muted-foreground">{itemLabel(issueCopy, "posting")}</p>
                <p className="mt-1 text-sm">{pendingBody}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {itemLabel(issueCopy, "pending-row")}
                </p>
              </li>
            )}
          </ul>
        </section>

        <form className="space-y-3" onSubmit={submitComment}>
          <label
            htmlFor="review-issue-reply"
            className="block text-xs uppercase tracking-wide text-muted-foreground"
          >
            {itemLabel(issueCopy, "reply-label")}
          </label>
          <textarea
            id="review-issue-reply"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={busy !== null}
            className="border-input bg-background w-full rounded-md border p-2 text-sm disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={busy !== null}>
              {busy === "comment"
                ? itemLabel(issueCopy, "posting")
                : itemLabel(issueCopy, "comment")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-issue-action={state === "open" ? "close" : "reopen"}
              disabled={busy !== null}
              onClick={() => move(state === "open" ? "closed" : "open")}
            >
              {busy === "state"
                ? itemLabel(issueCopy, "saving")
                : itemLabel(issueCopy, state === "open" ? "close" : "reopen")}
            </Button>
            <Refusal phase={phase} refusals={refusals} />
          </div>
          {state === "closed" ? (
            <p className="text-xs text-muted-foreground">{itemLabel(issueCopy, "closed-note")}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

/** The sentence beside the controls, when the last write was refused or did not commit. */
function Refusal({ phase, refusals }: { phase: Phase; refusals: PageCopySection }) {
  if (phase.kind === "idle") return null;
  const code = phase.kind === "refused" ? phase.code : "failed";
  return (
    <p data-refusal={code} role="status" className="text-sm font-medium text-amber-700">
      {refusalSentence(refusals, code)}
    </p>
  );
}
