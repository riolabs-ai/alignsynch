/**
 * `/dashboard` — the console's Overview (Console 2/5).
 *
 * The arrangement is `components/identity/account-home.tsx` (#164): a header that names the person
 * looking at the page, then cards. The card grid is `components/console/stat-card-grid.tsx`, which
 * is the shape `components/dashboard/dashboard-overview.tsx` had — four `<Card>`s, a title with an
 * icon, one figure, one line — with the authored metrics removed rather than replaced by different
 * authored metrics.
 *
 * **What varies from the two templates, and why.**
 *
 *   - *The numbers are per-viewer counts.* Every figure on this page is arithmetic over the rows
 *     `listMyInstances()` returned for the session's own `user_id` (`lib/flow/overview.ts`), or the
 *     length of the published-template read. Nothing here is authored, nothing is a percentage,
 *     and there is no string that could carry a formatted figure — `StatCard.value` is a `number`.
 *   - *The cards link to `/assessment/instances`, not to quiz routes.* A count is a question
 *     ("which ones?"), and the answer is the list, filtered by the same predicate that produced
 *     the number (`overviewFilterPath`). The templates card links to `/assessment`, where the
 *     templates it counted are the list.
 *   - *The empty state is a prompt, not a chart of nothing.* A person with no relationships is told
 *     so in a sentence and given the one action that changes it; the cards stay, because a zero
 *     that opens an empty list is true and checkable, and hiding it would be a second claim.
 *
 * **The blind rule, on the page most likely to leak it.** `MyInstance.state` is derived from the
 * viewer's own answered count (`myInstanceStateOf`), and `awaiting-other` is a sentence about the
 * other party's *absence of completion*, never their progress: no card here counts how many
 * Aspects somebody else answered, and the type it reads does not carry that number. `reports-open`
 * is the viewer's own `unlock_seen_at`, not a shared "read" flag. A dashboard is the easiest place
 * to leak a partial sheet, so the only three counts it has are the three the list already draws
 * per row.
 *
 * **Failure is a panel.** The counts are database rows, and a read that did not answer prints the
 * database layer's own sentence with a link that tries again — never Next's 500, never a zero that
 * reads like "nothing waiting on you". Same rule as `/assessment/instances` (#213).
 */
import { StatCardGrid, type StatCard } from "@/components/console/stat-card-grid";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy } from "@/content/pages";
import { type OverviewRow, overviewCountsOf, overviewFilterPath } from "@/lib/flow/overview";
import { ASSESSMENTS_PATH, OVERVIEW_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { ClipboardList, FileCheck2, LayoutTemplate, Users } from "lucide-react";
import Link from "next/link";

export function ConsoleOverview({
  copy,
  name,
  instances,
  templates,
  unreadable,
}: {
  copy: PageCopy;
  /** The session's display name — the fallback when no profile has been saved. */
  name: string;
  /** Every instance this account is a party to, from `listMyInstances(user.userId)`. */
  instances: readonly OverviewRow[];
  /** `listPublishedTemplates().length` — the templates the catalogue is showing today. */
  templates: number;
  /** The database layer's sentence when the reads did not answer; `null` when they did. */
  unreadable: string | null;
}) {
  const failure = sectionOf(copy, "unreadable");

  if (unreadable !== null) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div
          data-overview-unreadable="true"
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failure.heading}</h1>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{sectionBody(failure)}</p>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{unreadable}</p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <Link className="underline" href={OVERVIEW_PATH}>
              {itemLabel(failure, "reload")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const counts = sectionOf(copy, "counts");
  const empty = sectionOf(copy, "empty");
  const figures = overviewCountsOf(instances);

  const cards: readonly StatCard[] = [
    {
      id: "awaiting-other",
      label: itemLabel(counts, "awaiting-other"),
      value: figures["awaiting-other"],
      detail: itemLabel(counts, "awaiting-other-detail"),
      href: overviewFilterPath("awaiting-other"),
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "yours-to-answer",
      label: itemLabel(counts, "yours-to-answer"),
      value: figures["yours-to-answer"],
      detail: itemLabel(counts, "yours-to-answer-detail"),
      href: overviewFilterPath("yours-to-answer"),
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      id: "reports-open",
      label: itemLabel(counts, "reports-open"),
      value: figures["reports-open"],
      detail: itemLabel(counts, "reports-open-detail"),
      href: overviewFilterPath("reports-open"),
      icon: <FileCheck2 className="h-4 w-4" />,
    },
    {
      id: "templates",
      label: itemLabel(counts, "templates"),
      value: templates,
      detail: itemLabel(counts, "templates-detail"),
      href: ASSESSMENTS_PATH,
      icon: <LayoutTemplate className="h-4 w-4" />,
    },
  ];

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <GeneratedAvatar name={name} seed={name} size={72} />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{fillLabel(copy.heading, { name })}</h1>
          {copy.subtitle !== undefined && <p className="text-muted-foreground">{copy.subtitle}</p>}
        </div>
      </header>

      <section data-overview-counts="true" className="space-y-3">
        <h2 className="text-lg font-semibold">{counts.heading}</h2>
        <p className="text-sm text-muted-foreground">{sectionBody(counts)}</p>
        <StatCardGrid cards={cards} />
        {counts.cta !== undefined && (
          <p className="text-sm">
            <Link className="underline" href={counts.cta.href}>
              {counts.cta.label}
            </Link>
          </p>
        )}
      </section>

      {instances.length === 0 && (
        <section data-overview-empty="true">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{empty.heading}</CardTitle>
              <CardDescription>{sectionBody(empty)}</CardDescription>
            </CardHeader>
            {empty.cta !== undefined && (
              <CardContent>
                <Button asChild size="sm">
                  <Link href={empty.cta.href}>{empty.cta.label}</Link>
                </Button>
              </CardContent>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
