"use client";

// template-ancestor: components/tour/first-run-tour.tsx   (variation: the replay control — the same fixture words and the same mark module, a button that clears the mark and returns to the console instead of a driver.js stage driven over the page)

import { Button } from "@/components/ui/button";
import type { PageCopy } from "@/content/pages";
import { pageItemOf } from "@/lib/page-copy";
import { sendTourMark } from "@/lib/tour/mark";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Where a replay returns to: the page that mounts the tour, so it opens on arrival. */
const TOUR_HOME = "/dashboard";

/**
 * The tour's replay control (#458, mounted by `/dashboard/help` in #542).
 *
 * **Replay is a cleared mark, not a forced open.** `/dashboard` reads `tour_seen_at` on every
 * request (`lib/db/tour.ts`); the tour opens when it is NULL. So this control writes
 * `{ seen: false }` through `lib/tour/mark.ts` — the one `fetch` to `POST /api/tour` — and then
 * navigates to the console, where the page's own read starts the tour. Nothing here can open a
 * tour over a page that does not carry the anchors, which is why it does not try.
 *
 * **It does not lie about what happened.** The route answers 401 (no session) and 503 (no
 * database) as plain refusals, and `sendTourMark` folds both into `false`: a cleared mark that did
 * not clear shows the fixture's failure sentence instead of a navigation that would land on a
 * console with no tour. Success is the navigation itself.
 *
 * **No words here.** The action, its note and the pending label are `data/pages/tour.ts` through
 * `pageItemOf` — E23 holds `components/tour/**` at 0 literals, which is what stops the next
 * sentence being typed into this file.
 */
export function ReplayTour({ copy }: { copy: PageCopy }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function replay() {
    setPending(true);
    setFailed(false);
    const cleared = await sendTourMark(false);
    if (!cleared) {
      setFailed(true);
      setPending(false);
      return;
    }
    router.push(TOUR_HOME);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="action" onClick={replay} disabled={pending}>
        {pending ? pageItemOf(copy, "replay-pending").label : pageItemOf(copy, "replay").label}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {failed ? pageItemOf(copy, "replay-failed").label : pageItemOf(copy, "replay-note").label}
      </p>
    </div>
  );
}
