// template-ancestor: components/v1/v1-ui.tsx   (variation: the StageBadge status pill, repurposed as the per-screen review control that deep-links to its own row on the review list)
"use client";

import { Badge } from "@/components/ui/badge";
import { matchReviewScreen, reviewScreenHref, type ReviewStatus } from "@/lib/v1/review";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The three statuses as one badge tone each — three status hues, no brand colour. */
const STATUS_VARIANT: Record<ReviewStatus, "outline" | "warning" | "success"> = {
  unreviewed: "outline",
  "changes requested": "warning",
  approved: "success",
};

/**
 * What the control will do, per status — stated, not implied.
 *
 * A bare `unreviewed` label looks decorative: it names a state and leaves the reviewer to guess
 * whether anything happens when they click. Each row here is a verb phrase, so the control reads
 * as the action it is, and the badge beside it keeps the state visible.
 */
const REVIEW_ACTION: Record<ReviewStatus, string> = {
  unreviewed: "Review this screen",
  "changes requested": "Open the requested changes",
  approved: "Approved — open the review",
};

/**
 * The per-screen review control: the current screen's approval status, and the action that
 * takes the reviewer to **this screen's row** on `/v1/review` — not the top of the list.
 *
 * It is one control in one place: the shell's footer (`ReviewFooter` below). It used to render
 * twice, in the persona bar and in the footer, so the page carried two pills in two places for
 * one fact — the owner's note on `/v1/relationships/rel-connected-blind/accept` asked for one
 * control at the foot of the page, so this deletes the header copy. It draws nothing on `/v1/review`
 * (the list is not a row it reviews) and nothing on a pathname with no row.
 *
 * The badge is never a new primitive: `unreviewed` is a neutral outline, `changes requested` the
 * warning fill, `approved` the success fill — the same rule `StageBadge` keeps.
 */
export function ReviewChip({ className }: { className?: string }) {
  const pathname = usePathname();
  const { reviews } = useV1Store();
  const screen = matchReviewScreen(pathname);
  if (screen === undefined) return null;

  const status: ReviewStatus = reviews[screen.route]?.status ?? "unreviewed";
  const action = REVIEW_ACTION[status];

  return (
    <Link
      href={reviewScreenHref(screen.route)}
      aria-label={`Review status: ${status}. ${action}.`}
      title={action}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2",
        className,
      )}
    >
      <Badge variant={STATUS_VARIANT[status]} className="normal-case">
        {status}
      </Badge>
      <span>{action}</span>
      <ArrowUpRight
        className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * The page footer's review bar — the one place the control lives.
 *
 * It names the route it reviews and puts the control beside it, so "which screen am I looking
 * at in the list" is answered before the click. It renders nothing at all (no empty strip) on a
 * screen with no review row.
 *
 * The bottom padding clears the answer sheet's `fixed` submit bar below `sm`
 * (`components/v1/answer-sheet.tsx`), which is pinned to the viewport bottom on a phone; without
 * it the control would sit behind that bar at the end of the page.
 */
export function ReviewFooter() {
  const pathname = usePathname();
  const screen = matchReviewScreen(pathname);
  if (screen === undefined) return null;

  return (
    <footer className="border-t border-border bg-muted/40 px-3 pb-[calc(5rem_+_env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Reviewing <code className="font-mono text-foreground">{screen.route}</code>
        </p>
        <ReviewChip />
      </div>
    </footer>
  );
}
