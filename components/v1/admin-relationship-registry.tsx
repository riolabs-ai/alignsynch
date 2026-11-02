// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the operator's registry — every relationship, live or archived, with derived stage, seat state and subscription, a filter chip per predicate and a restore action on archived rows)
"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import { STAGE_LABELS, type RelationshipStage } from "@/content/stages";
import type { SubscriptionStatus } from "@/data/v1/fixtures";
import { seedSessions } from "@/data/v1/fixtures";
import {
  ADMIN_ANSWER_LIMIT_SENTENCE,
  ADMIN_RELATIONSHIPS_PATH,
  type AdminRelationshipRow,
  type AdminRegistryQuery,
  type AdminSeat,
  adminRelationshipPath,
  adminRelationshipRows,
  adminRegistryHref,
  filterAdminRows,
} from "@/lib/v1/admin-console";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { ArchiveRestore, ChevronRight } from "lucide-react";
import Link from "next/link";

/** The subscription state's word, authored once for the registry's two layouts. */
const SUBSCRIPTION_LABEL: Record<AdminRelationshipRow["subscription"], string> = {
  active: "Active",
  past_due: "Past due",
  lapsed: "Lapsed",
  none: "None",
};

/** The subscription pill's tone — a status hue, deliberately outside the brand-class rule. */
const SUBSCRIPTION_TONE: Record<AdminRelationshipRow["subscription"], string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
  lapsed: "bg-red-50 text-red-700 border-red-200",
  none: "bg-slate-100 text-slate-700 border-slate-200",
};

/** The seat-state word — the same four states `adminSeatStateOf` derives. */
const SEAT_LABEL: Record<AdminSeat["state"], string> = {
  claimed: "claimed",
  invited: "invited",
  expired: "expired",
  "not-invited": "not invited",
};

/** One filter chip: its label, the query it links to, and whether it is the current view. */
interface RegistryChip {
  readonly id: string;
  readonly label: string;
  readonly query: AdminRegistryQuery;
}

const STAGE_CHIPS: readonly RelationshipStage[] = ["invited", "connected", "sharing", "aligned"];

function queryHref(query: AdminRegistryQuery): string {
  return adminRegistryHref(query);
}

/** Is this chip the query the page was opened with? Compared on the built href, not on prose. */
function isActiveChip(current: AdminRegistryQuery, query: AdminRegistryQuery): boolean {
  return queryHref(current) === queryHref(query);
}

/** A seat as a column renders it: the name (or "—") and what the seat is. */
function seatLabel(seat: AdminSeat): string {
  const name = seat.name ?? "—";
  return `${name} (${SEAT_LABEL[seat.state]})`;
}

/**
 * `/v1/admin/console/relationships` — the relationship registry.
 *
 * It varies the persona list (`components/v1/relationships-list.tsx` in turn a variation of
 * `components/my-quizzes/my-quizzes.tsx`): the same desktop table collapsing to cards below `md`,
 * and the same status-led columns — but the reader is an operator, so the row carries the facts an
 * operator acts on (both seats and whether they exist, the subscription, when it was last
 * modified) and **not one figure derived from an answer**. There is no Gap column and no flag
 * column here on purpose; `lib/v1/admin-console.ts` has no field that could feed one.
 *
 * The filter chips are links, not local state: every chip is `adminRegistryHref(query)`, which is
 * the same builder the overview's cards use, so "2 past due" opens a registry whose URL says
 * `subscription=past_due` and whose rows were filtered by that one predicate. A refresh, a shared
 * link and the back button all reproduce the list.
 */
export function AdminRelationshipRegistry({ query }: { query: AdminRegistryQuery }) {
  const { hydrated, relationships, templates, restoreRelationship } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={5} />
      </div>
    );
  }

  const rows = adminRelationshipRows(
    relationships,
    new Map(templates.map((template) => [template.id, template.title])),
    Date.now(),
    seedSessions,
  );
  const visible = filterAdminRows(rows, query);
  const live = rows.filter((row) => !row.archived).length;

  const chips: readonly RegistryChip[] = [
    { id: "all", label: "All live", query: {} },
    ...STAGE_CHIPS.map((stage) => ({
      id: `stage-${stage}`,
      label: STAGE_LABELS[stage],
      query: { stage },
    })),
    {
      id: "awaiting-answers",
      label: "Awaiting answers",
      query: { filter: "awaiting-answers" },
    },
    {
      id: "past-due",
      label: "Past due",
      query: { subscription: "past_due" as SubscriptionStatus },
    },
    { id: "archived", label: "Archived", query: { state: "archived" as const } },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <SectionIntro
        title="Relationships"
        subtitle={`${visible.length} of ${live} live relationships shown · ${rows.length - live} archived. Read-only for answers.`}
      />

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {ADMIN_ANSWER_LIMIT_SENTENCE}
      </p>

      <nav
        aria-label="Registry filters"
        className="flex flex-wrap gap-2"
        data-admin-registry-filters
      >
        {chips.map((chip) => {
          const active = isActiveChip(query, chip.query);
          return (
            <Link
              key={chip.id}
              href={queryHref(chip.query)}
              data-admin-chip={chip.id}
              data-active={active ? "true" : "false"}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-sm",
                active
                  ? "border-action bg-action text-action-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          title="No relationships match this filter"
          body="Clear the filter to see every relationship — nothing was deleted to produce this empty list."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={ADMIN_RELATIONSHIPS_PATH}>Show all live</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop: the registry table. */}
          <div className="hidden md:block" data-admin-registry="table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow
                    key={row.id}
                    data-admin-relationship-row={row.id}
                    data-admin-stage={row.stage}
                    data-admin-subscription={row.subscription}
                    data-admin-archived={row.archived ? "true" : "false"}
                  >
                    <TableCell>
                      <Link
                        href={adminRelationshipPath(row.id)}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {MODE_LABELS[row.mode]} · {SETTING_LABELS[row.setting]}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{row.templateTitle}</TableCell>
                    <TableCell>
                      <StageBadge stage={row.stage} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block whitespace-nowrap">{seatLabel(row.initiator)}</span>
                      <span className="block whitespace-nowrap text-muted-foreground">
                        {seatLabel(row.counterparty)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          SUBSCRIPTION_TONE[row.subscription],
                        )}
                      >
                        {SUBSCRIPTION_LABEL[row.subscription]}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {row.sessionsScored} scored · {row.sessionsOpen} open
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(row.lastActivity)}
                      {row.archived && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                          archived
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.archived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreRelationship(row.id)}
                            data-admin-restore={row.id}
                          >
                            <ArchiveRestore className="mr-1 h-4 w-4" aria-hidden="true" />
                            Restore
                          </Button>
                        )}
                        <Link
                          href={adminRelationshipPath(row.id)}
                          className="inline-flex items-center text-sm text-action hover:underline"
                        >
                          Sessions
                          <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Below md: one card per relationship, the same facts with the parties on two lines. */}
          <div className="space-y-3 md:hidden" data-admin-registry="cards">
            {visible.map((row) => (
              <Card
                key={row.id}
                data-admin-relationship-row={row.id}
                data-admin-stage={row.stage}
                data-admin-subscription={row.subscription}
                data-admin-archived={row.archived ? "true" : "false"}
              >
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={adminRelationshipPath(row.id)}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <StageBadge stage={row.stage} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.templateTitle} · {MODE_LABELS[row.mode]} · {SETTING_LABELS[row.setting]}
                  </p>
                  <p className="text-sm">
                    {row.initiator.name} ({SEAT_LABEL[row.initiator.state]}) →{" "}
                    {row.counterparty.name ?? "—"} ({SEAT_LABEL[row.counterparty.state]})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {SUBSCRIPTION_LABEL[row.subscription]} · {row.sessionsScored} scored ·{" "}
                    {row.sessionsOpen} open · {formatDate(row.lastActivity)}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={adminRelationshipPath(row.id)}
                      className="inline-flex items-center text-sm text-action hover:underline"
                    >
                      Sessions
                      <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
                    </Link>
                    {row.archived && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreRelationship(row.id)}
                        data-admin-restore={row.id}
                      >
                        <ArchiveRestore className="mr-1 h-4 w-4" aria-hidden="true" />
                        Restore
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
