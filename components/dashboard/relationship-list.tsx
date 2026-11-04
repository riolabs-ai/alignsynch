// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the relationship list as a table — one row per relationship with its stored lifecycle state and its invitation's state side by side, no thumbnails, no grid/list toggle and no per-row menu; the only action is Open)

/**
 * `/dashboard/relationships` — the leader's list, one row per relationship (#533 phase 2).
 *
 * **A server component, and the reason is the rule it follows.** Nothing here is interactive: a row
 * links to its detail screen and the detail screen is the only place that writes. A `"use client"`
 * boundary would buy nothing and would put the row's derivation on the wrong side of the wire.
 *
 * **Two states on one row, and they are different facts.** `row.status` is the relationship's stored
 * lifecycle word (`draft`, `pending`, `published`, `active`, …) and `row.view` is what its
 * invitation is doing (`invite-live`, `invite-expired`, `invite-claimed`, …). Both are derived before
 * this file runs — `publishViewOf()` over the stored status, the invitation row and the instant the
 * page rendered — so the list cannot disagree with the detail screen about whether a link is live.
 *
 * **The counterparty's name is the invitation's.** Before publish there is no invitation and no
 * name, and the cell draws the fixture's dash rather than an empty string: "nobody yet" is a fact,
 * and a blank cell is indistinguishable from a failed read.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import Link from "next/link";

/** The badge's word for a status, from the fixture's `status` section. */
function statusLabel(status: PageCopySection, value: string): string {
  const known = (status.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

/** The badge's word for the invitation's derived state. */
function viewLabel(view: PageCopySection, value: string): string {
  const known = (view.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

/** `published`/`active` are the live ones; everything else reads as neutral. */
function toneOf(status: string): "default" | "secondary" | "outline" {
  if (status === "published") return "default";
  if (status === "active") return "default";
  if (status === "draft" || status === "pending") return "secondary";
  return "outline";
}

export function RelationshipList({
  copy,
  rows,
  unreadable,
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  unreadable: string | null;
}) {
  const list = sectionOf(copy, "list");
  const columns = sectionOf(copy, "columns");
  const statusCopy = sectionOf(copy, "status");
  const viewCopy = sectionOf(copy, "view");
  const empty = sectionOf(copy, "empty");
  const unreadableCopy = sectionOf(copy, "unreadable");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{list.heading}</CardTitle>
        <CardDescription>{sectionBody(list)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unreadable !== null ? (
          <div data-relationships-unreadable>
            <p className="text-sm font-medium">{unreadableCopy.heading}</p>
            <p className="text-sm text-muted-foreground">{unreadable}</p>
          </div>
        ) : rows.length === 0 ? (
          <div data-relationships-empty className="space-y-2">
            <p className="text-sm font-medium">{empty.heading}</p>
            <p className="text-sm text-muted-foreground">{sectionBody(empty)}</p>
            <Link className="text-sm underline underline-offset-4" href="/dashboard/templates">
              {pageItemOf(copy, "new-template").label}
            </Link>
          </div>
        ) : (
          <Table data-relationships-table>
            <TableHeader>
              <TableRow>
                <TableHead>{itemLabel(columns, "title")}</TableHead>
                <TableHead>{itemLabel(columns, "status")}</TableHead>
                <TableHead>{itemLabel(columns, "aspects")}</TableHead>
                <TableHead>{itemLabel(columns, "invited")}</TableHead>
                <TableHead>{itemLabel(columns, "created")}</TableHead>
                <TableHead>{itemLabel(columns, "open")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-relationship-row={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={toneOf(row.status)} data-relationship-status={row.status}>
                        {statusLabel(statusCopy, row.status)}
                      </Badge>
                      {/* #533 phase 3 — the derived membership, beside the stored status. A row
                          whose trial ran out reads `published` in the column until a write flips
                          it; the badge says the pair is read-only now, not a month ago. */}
                      {row.membership.state === "lapsed" ? (
                        <Badge variant="outline" data-membership-state="lapsed">
                          {statusLabel(statusCopy, "read-only")}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" data-relationship-view={row.view}>
                        {viewLabel(viewCopy, row.view)}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell>
                    {fillLabel(pageItemOf(copy, "aspects").label, {
                      count: String(row.aspectCount),
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.counterpartyName ?? pageItemOf(copy, "none").label}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      className="text-sm underline underline-offset-4"
                      href={`/dashboard/relationships/${row.id}`}
                    >
                      {pageItemOf(copy, "open").label}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
