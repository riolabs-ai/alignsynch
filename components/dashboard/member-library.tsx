// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the member's library — the same card-per-record list with a status badge and a row of counts, where the record is a template rather than a quiz and the action is "open the editor" or "open the catalogue entry" instead of play)

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import type { LibraryRow } from "@/lib/member/library";
import { ArrowRight, Library as LibraryIcon, Layers } from "lucide-react";
import Link from "next/link";

interface MemberLibraryProps {
  /** `data/pages/dashboard-library.ts`. */
  copy: PageCopy;
  /** The member's own rows, already filtered by the session's id in `lib/member/library.ts`. */
  rows: readonly LibraryRow[];
  /** `DatabaseUnavailableError`'s reason, or `null` when the read answered. */
  unreadable: string | null;
}

/**
 * `/dashboard/library`, drawn (#542 phase 1).
 *
 * **One card per template, and the badge answers "why is this row mine".** A template is in the
 * library because the member owns it or because a relationship of theirs was built from it; the
 * card says which (`owned` / `adopted`), how many Aspects it carries, and how many of their
 * relationships use it — three facts the read returns, none of them inferred here.
 *
 * **The empty state is an action, not a pitch.** A new account has no row to draw, and the honest
 * screen names the two moves that put one there — write a template, or start from the catalogue.
 * Both are links to real routes (`/dashboard/templates`, `/assessment/templates`), and the second
 * one is inside the app, so neither is a departure (#542: no marketing copy in the dashboard).
 *
 * **The two opening paths differ, and both are existing pages.** A row the member owns opens the
 * editor at `/dashboard/templates/[id]`; a row they adopted opens the catalogue entry at
 * `/assessment/templates/[id]`, because editing somebody else's public template is not a thing this
 * build offers. The label says which verb the link carries.
 *
 * **No words here.** Every heading, badge and count resolves from the fixture through
 * `sectionOf` / `itemLabel` / `fillLabel`, which is what holds this file at 0 copy literals.
 */
export function MemberLibrary({ copy, rows, unreadable }: MemberLibraryProps) {
  const rowCopy = sectionOf(copy, "rows");
  const empty = sectionOf(copy, "empty");
  const unreadableCopy = sectionOf(copy, "unreadable");
  const myTemplates = sectionOf(copy, "my-templates");
  const myRelationships = sectionOf(copy, "my-relationships");

  if (unreadable !== null) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">{unreadableCopy.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-library-unreadable className="text-sm text-muted-foreground">
            {fillLabel(sectionBody(unreadableCopy), { reason: unreadable })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {rows.length === 0 ? <EmptyLibrary copy={empty} /> : <Rows rows={rows} copy={rowCopy} />}

      <section className="grid gap-4 md:grid-cols-2">
        <ElsewhereCard section={myTemplates} />
        <ElsewhereCard section={myRelationships} />
      </section>
    </div>
  );
}

/** One "somewhere else in the console" card: a heading, a sentence and the link that goes there. */
function ElsewhereCard({ section }: { section: PageCopySection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{section.heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{sectionBody(section)}</p>
        {section.cta === undefined ? null : (
          <Button asChild variant="outline" size="sm">
            <Link href={section.cta.href}>{section.cta.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** One card per template: the title, the summary, the three counts and the one action. */
function Rows({ rows, copy }: { rows: readonly LibraryRow[]; copy: PageCopySection }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Card className="flex h-full flex-col">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{row.title}</CardTitle>
                <Badge variant="outline">{itemLabel(copy, row.owned ? "owned" : "adopted")}</Badge>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Layers className="size-3.5" aria-hidden="true" />
                  {fillLabel(itemLabel(copy, "aspects"), { count: row.aspectCount })}
                </span>
                <span>
                  {row.relationshipCount === 0
                    ? itemLabel(copy, "unused")
                    : fillLabel(
                        itemLabel(
                          copy,
                          row.relationshipCount === 1 ? "relationship-one" : "relationships",
                        ),
                        { count: row.relationshipCount },
                      )}
                </span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link
                  href={
                    row.owned ? `/dashboard/templates/${row.id}` : `/assessment/templates/${row.id}`
                  }
                >
                  {itemLabel(copy, row.owned ? "open-owned" : "open")}
                  <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Nothing saved yet: the two moves that put a template in this list. */
function EmptyLibrary({ copy }: { copy: PageCopySection }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-3 py-10">
        <LibraryIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{copy.heading}</h2>
        <p className="max-w-xl text-sm text-muted-foreground">{sectionBody(copy)}</p>
        <div className="flex flex-wrap gap-2">
          {copy.cta === undefined ? null : (
            <Button asChild variant="action" size="sm">
              <Link href={copy.cta.href}>{copy.cta.label}</Link>
            </Button>
          )}
          {copy.secondaryCta === undefined ? null : (
            <Button asChild variant="outline" size="sm">
              <Link href={copy.secondaryCta.href}>{copy.secondaryCta.label}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
