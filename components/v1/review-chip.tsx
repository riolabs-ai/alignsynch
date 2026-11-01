// template-ancestor: none — prototype screen, approved for /v1
"use client";

import { Badge } from "@/components/ui/badge";
import { matchReviewScreen, type ReviewStatus } from "@/lib/v1/review";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The per-screen review chip — the current screen's approval status, linking back to `/v1/review`.
 *
 * It is a badge, never a new primitive: `unreviewed` is a neutral outline, `changes requested`
 * the warning fill, `approved` the success fill — three status hues, no brand colour, the same
 * rule `StageBadge` keeps. The chip draws nothing on `/v1/review` (the list is not a row it
 * reviews) and nothing on a pathname with no row.
 *
 * Placement is the caller's: `v1-shell.tsx` floats it bottom-right on `sm` and up, and the persona
 * bar renders it inline on mobile so it is always reachable without covering the answer sheet's
 * sticky action bar.
 */
export function ReviewChip({ className }: { className?: string }) {
  const pathname = usePathname();
  const { reviews } = useV1Store();
  const screen = matchReviewScreen(pathname);
  if (screen === undefined) return null;

  const status: ReviewStatus = reviews[screen.route]?.status ?? "unreviewed";
  const STATUS_VARIANT: Record<ReviewStatus, "outline" | "warning" | "success"> = {
    unreviewed: "outline",
    "changes requested": "warning",
    approved: "success",
  };
  const variant = STATUS_VARIANT[status];

  return (
    <Link
      href="/v1/review"
      aria-label={`Review status: ${status}. Open the /v1 review list.`}
      className={cn("inline-flex items-center", className)}
    >
      <Badge variant={variant} className="normal-case">
        {status}
      </Badge>
    </Link>
  );
}
