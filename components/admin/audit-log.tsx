/**
 * template-ancestor: components/admin/instance-registry.tsx   (variation: the registry table with both filter rows and the row link removed, one row per audited write instead of per relationship, and the two sides of the change as columns — a log reads newest-first and is never filtered)
 *
 * `/admin/audit` — the operator's log of every write the console has made (#503, epic #500).
 *
 * **A server component, because a log has no controls.** The registry it varies is `"use client"`
 * for its filters and its tabs; this screen has neither — the read is bounded by a limit and
 * ordered newest-first, and a row has nothing to click. So there is no `useState`, no handler and
 * no client boundary, which is also what keeps a page of audit rows out of the browser bundle.
 *
 * **What it draws is what the writer stored.** `before` and `after` arrive already rendered by
 * `lib/db/admin-audit.ts` as pretty-printed JSON, or `null` for the side of a change that has no
 * row (a create has no before, a delete has no after). This component prints them; it does not
 * parse them into a second schema of its own, and it does not decide which keys matter — the five
 * repairs keep their own bounded shapes (`lib/admin/relationship-ops.ts`), and a screen that
 * understood them would need an update every time one of them gained a field.
 *
 * **An unattributable row is not hidden.** `actorName` is `null` when the actor's account has no
 * profile row yet, and the cell says so and prints the id — a log that dropped the entry for want
 * of a display name would be a log with a hole in it.
 *
 * Literal-free (E23): every word is `data/pages/admin-audit.ts`, and the instants go through
 * `formatDate` like every other screen's.
 */
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
import type { AdminAuditEntry } from "@/lib/db/admin-audit";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** One side of a change: the recorded JSON, or a dash when there was nothing there. */
function Side({ value, none }: { value: string | null; none: string }) {
  if (value === null) return <span className="text-muted-foreground">{none}</span>;
  return (
    <pre className="max-w-[22rem] overflow-x-auto text-xs whitespace-pre-wrap break-words">
      {value}
    </pre>
  );
}

/** One audited write. */
function LogRow({
  entry,
  sides,
  actorCopy,
}: {
  entry: AdminAuditEntry;
  sides: PageCopySection;
  actorCopy: PageCopySection;
}) {
  const none = itemLabel(sides, "none");
  return (
    <TableRow data-action={entry.action}>
      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
        {formatDate(entry.at)}
      </TableCell>
      <TableCell className="text-sm">
        {entry.actorName === null ? (
          <>
            <span className="block text-muted-foreground">{itemLabel(actorCopy, "unknown")}</span>
            <span className="block font-mono text-xs">{entry.actorUserId}</span>
          </>
        ) : (
          <span className="font-medium">{entry.actorName}</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap">{entry.action}</TableCell>
      <TableCell className="font-mono text-xs">
        <span className="block">{entry.targetTable}</span>
        <span className="block text-muted-foreground">{entry.targetId}</span>
      </TableCell>
      <TableCell className="max-w-[18rem] text-sm">{entry.reason}</TableCell>
      <TableCell>
        <Side value={entry.before} none={none} />
      </TableCell>
      <TableCell>
        <Side value={entry.after} none={none} />
      </TableCell>
    </TableRow>
  );
}

export function AdminAuditLog({
  copy,
  entries,
  unreadable,
}: {
  copy: PageCopy;
  /** The newest rows the read returned. Already ordered; this component sorts nothing. */
  entries: readonly AdminAuditEntry[];
  /** `DatabaseUnavailableError.message` when the read failed; `null` on a normal visit. */
  unreadable: string | null;
}) {
  const columns = sectionOf(copy, "columns");
  const sides = sectionOf(copy, "side");
  const actorCopy = sectionOf(copy, "actor");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="mt-1 max-w-3xl text-muted-foreground">{copy.subtitle}</p>
        )}
      </div>

      {unreadable === null ? null : (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{sectionOf(copy, "unreadable").heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(sectionOf(copy, "unreadable"))}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm">{unreadable}</p>
          </CardContent>
        </Card>
      )}

      {unreadable === null &&
        (entries.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{sectionOf(copy, "empty").heading ?? copy.heading}</CardTitle>
              <CardDescription>{sectionBody(sectionOf(copy, "empty"))}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{itemLabel(columns, "when")}</TableHead>
                    <TableHead>{itemLabel(columns, "actor")}</TableHead>
                    <TableHead>{itemLabel(columns, "action")}</TableHead>
                    <TableHead>{itemLabel(columns, "target")}</TableHead>
                    <TableHead>{itemLabel(columns, "reason")}</TableHead>
                    <TableHead>{itemLabel(columns, "before")}</TableHead>
                    <TableHead>{itemLabel(columns, "after")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <LogRow key={entry.id} entry={entry} sides={sides} actorCopy={actorCopy} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">{sectionBody(sectionOf(copy, "list"))}</p>
          </>
        ))}
    </div>
  );
}
