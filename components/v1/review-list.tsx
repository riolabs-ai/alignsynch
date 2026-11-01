// template-ancestor: none — prototype screen, approved for /v1
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REVIEW_SCREENS, type ReviewScreen, type ReviewStatus } from "@/lib/v1/review";
import { useV1Store } from "@/lib/v1/store";
import Link from "next/link";
import { useState } from "react";

/** The three statuses as one badge tone each — no brand colour, the `StageBadge` rule. */
const STATUS_VARIANT: Record<ReviewStatus, "outline" | "warning" | "success"> = {
  unreviewed: "outline",
  "changes requested": "warning",
  approved: "success",
};

type Filter = "all" | ReviewStatus;

/** The status pill — a badge, never a hand-rolled span. */
function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="normal-case">
      {status}
    </Badge>
  );
}

/**
 * One row of the checklist: the route (a link), its one-line description, its status and its
 * note, and the three actions — Open, Approve, Request changes (which reveals a note field).
 */
function ReviewRow({ screen }: { screen: ReviewScreen }) {
  const { reviews, setReview } = useV1Store();
  const entry: ReviewEntryForRow = reviews[screen.route] ?? { status: "unreviewed", note: "" };
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(entry.note);

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={screen.href}
              className="font-mono text-sm font-medium text-foreground hover:text-action"
            >
              {screen.route}
            </Link>
            <StatusBadge status={entry.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{screen.description}</p>
          {entry.status === "changes requested" && entry.note !== "" && (
            <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
              {entry.note}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={screen.href}>Open</Link>
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => setReview(screen.route, { status: "approved", note: "" })}
          >
            Approve
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setNoteOpen((open) => !open)}>
            Request changes
          </Button>
        </div>
      </div>
      {noteOpen && (
        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What needs to change?"
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              setReview(screen.route, { status: "changes requested", note: note.trim() });
              setNoteOpen(false);
            }}
          >
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}

/** The row's read shape, for the fallback literal's contextual typing. */
type ReviewEntryForRow = { status: ReviewStatus; note: string };

/** `/v1/review` — the checklist. Approval is a persisted state, not a conversation. */
export function ReviewList() {
  const { hydrated, reviews } = useV1Store();
  const [filter, setFilter] = useState<Filter>("all");

  const statusOf = (screen: ReviewScreen): ReviewStatus =>
    reviews[screen.route]?.status ?? "unreviewed";

  const approved = REVIEW_SCREENS.filter((screen) => statusOf(screen) === "approved").length;
  const changes = REVIEW_SCREENS.filter(
    (screen) => statusOf(screen) === "changes requested",
  ).length;
  const unreviewed = REVIEW_SCREENS.length - approved - changes;

  const visible = REVIEW_SCREENS.filter(
    (screen) => filter === "all" || statusOf(screen) === filter,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every prototype screen, so approval is a state rather than a conversation. Marking a
          screen here survives a reload.
        </p>
      </div>

      <p className="text-sm font-medium text-foreground">
        {REVIEW_SCREENS.length} screens · {approved} approved · {changes} changes requested ·{" "}
        {unreviewed} unreviewed
      </p>

      <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filter by status">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="unreviewed">unreviewed</SelectItem>
          <SelectItem value="changes requested">changes requested</SelectItem>
          <SelectItem value="approved">approved</SelectItem>
        </SelectContent>
      </Select>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {visible.map((screen) => (
            <ReviewRow key={screen.route} screen={screen} />
          ))}
          {visible.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No screens with that status.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
