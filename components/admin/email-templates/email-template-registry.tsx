"use client";

/**
 * template-ancestor: components/admin/template-registry.tsx   (variation: the same record list as a table, with the state a column and the row link an editor — and no create band, because an email template is code and this screen overrides one rather than authoring a new row)
 *
 * `/admin/email-templates` — the register, and what production is sending (#1138).
 *
 * **What varies from the ancestor.** `components/admin/template-registry.tsx` lists assessment
 * templates out of Postgres and opens with a create form; here every row already exists in
 * `lib/email/templates/index.ts`, so there is nothing to create and the band would be an empty
 * promise. The columns are the issue's own set — template, class, recipient, status, last edited —
 * because #1138 says which facts the list carries, and a filter row is not among them (the register
 * is a dozen rows; an operator reads it, they do not search it).
 *
 * **Two badges, not one.** A template can be `published` *and* carry a pending `draft`; drawing only
 * the newest row's state would say "draft" while production was sending the older published words.
 * So the state badge is what the send path reads and a second, quieter badge marks the draft beside
 * it. That is #1138 requirement 5 made visible, and it is the one thing on this screen an operator
 * must not misread.
 *
 * **A read that did not answer is a panel.** `DatabaseUnavailableError` arrives as `unreadable` and
 * the table is replaced by the reason: the register half of every row is code, so the list would
 * otherwise look finished while every status on it was a guess.
 */
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { adminEmailTemplatePath } from "@/lib/admin/paths";
import type { EmailTemplateListRow, EmailTemplateState } from "@/lib/admin/email-templates";
import { itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/** The table's columns, in the order the fixture names them. */
const COLUMNS = ["template", "class", "recipient", "status", "edited", "open"] as const;

/** The badge tone a state gets: the default is the product's own words, so it is the quietest. */
const STATE_VARIANT: Record<EmailTemplateState, "secondary" | "success" | "outline"> = {
  default: "outline",
  draft: "secondary",
  published: "success",
};

/** The refusal sentence for a code, or the generic failure — one lookup, never a composed string. */
export function refusalLabel(refusals: PageCopySection, code: string): string {
  const known = (refusals.items ?? []).find((item) => item.id === code);
  return known?.label ?? itemLabel(refusals, "failed");
}

export function EmailTemplateRegistry({
  copy,
  rows,
  unreadable,
}: {
  copy: PageCopy;
  rows: readonly EmailTemplateListRow[];
  unreadable: string | null;
}) {
  const list = sectionOf(copy, "list");
  const columns = sectionOf(copy, "columns");
  const status = sectionOf(copy, "status");
  const classSection = sectionOf(copy, "class");
  const recipient = sectionOf(copy, "recipient");
  const empty = sectionOf(copy, "empty");
  const failure = sectionOf(copy, "unreadable");

  if (unreadable !== null) {
    return (
      <Card data-email-templates-unreadable={unreadable}>
        <CardHeader>
          <CardTitle>{failure.heading}</CardTitle>
          <CardDescription>{sectionBody(failure)}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{list.heading}</CardTitle>
        <CardDescription>{sectionBody(list)}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div
            data-email-templates-empty
            className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground"
          >
            <p className="font-medium text-foreground">{empty.heading}</p>
            <p className="mt-1">{sectionBody(empty)}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((id) => (
                  <TableHead key={id}>{itemLabel(columns, id)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-email-template-row={row.id}>
                  <TableCell className="font-medium">
                    <span className="font-mono text-xs">{row.id}</span>
                  </TableCell>
                  <TableCell>{itemLabel(classSection, row.emailClass)}</TableCell>
                  <TableCell>{itemLabel(recipient, row.recipient)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATE_VARIANT[row.state]}>
                        {itemLabel(status, row.state)}
                      </Badge>
                      {row.pendingDraft && row.state === "published" ? (
                        <Badge variant="secondary">{itemLabel(status, "draft")}</Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.lastEditedAt === null ? null : formatDate(row.lastEditedAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={adminEmailTemplatePath(row.id)}
                      className="text-sm text-action underline-offset-4 hover:underline"
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
