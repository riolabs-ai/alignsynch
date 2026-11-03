// template-ancestor: components/ui/badge.tsx   (variation: one chip rather than an alert panel — the demo account's standing, stated in place)

import { Badge } from "@/components/ui/badge";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * The label a **fixture person's** profile carries (issue #164).
 *
 * `/profile/<handle>` now has two kinds of person behind it: a member (a `user_profile` row) and
 * one of the ten in `data/players.ts`. The second kind has a level, a score and a follower count
 * and no account at all — so the card's `MUST NOT` ("no fabricated user data in the seeded demo —
 * demo people are labelled as demo accounts") is a property of the page, not a note in a doc.
 *
 * It renders above the existing fixture view rather than inside it: that view
 * (`components/profile/**`) is one of the surfaces still holding its own copy, and adding a string
 * to it would be a copy literal in a file this card's budget cannot afford. A wrapper is also the
 * honest shape — the badge is about the *record*, not about the header it sits above.
 */
export function DemoAccountNotice({ copy }: { copy: PageCopy }) {
  const demo = sectionOf(copy, "demo");

  return (
    <div className="container mx-auto max-w-6xl pt-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <Badge variant="outline">{itemLabel(demo, "demo-badge")}</Badge>
        {demo.body !== undefined && <span>{demo.body}</span>}
        <span className="text-muted-foreground">{itemLabel(demo, "demo-note")}</span>
      </div>
    </div>
  );
}
