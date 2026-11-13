/**
 * template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the record list as an audit table — the toolbar is a GET form and every filter chip is a link, so the axes are server-side and in the URL; rows are `Table` rows and the per-row menu becomes a native disclosure)
 *
 * `/admin/audit` — the audit log, for an operator (#501b).
 *
 * **The template, and the axes it varies.** This is `components/my-quizzes/my-quizzes.tsx` in its
 * list shape, composed with `components/ui/table.tsx` and the registry's filter row
 * (`components/admin/instance-registry.tsx`):
 *
 *   my-quizzes                    this log
 *   ----------------------------  ------------------------------------------------
 *   tab row: Active/Draft/…       a chip row of the axes the *URL* carries; each chip is
 *                                 a link that drops its own axis and keeps the rest
 *   status select                 four form controls — actor, action, target table, and
 *                                 the date range — read by the server, not by state
 *   search field                  the actor field (an address or a user id, matched
 *                                 exactly: a log is searched by a fact, not by recall)
 *   grid/list toggle              dropped — a log is a table or it is nothing
 *   per-row dropdown actions      dropped, and replaced by the one per-row thing this
 *                                 screen has: a `<details>` disclosure of before/after
 *   grid of cards                 `Table`/`TableHeader`/`TableRow`/`TableCell`
 *   empty state                   two, because "nothing matches this filter" and
 *                                 "nothing has ever been written" are different facts
 *
 * **No `"use client"`, and that is a decision.** Every axis is in the query string, so the form is
 * a plain `GET` and the browser navigates; nothing here holds state, and the disclosure is the
 * browser's own `<details>`. The screen therefore ships no JavaScript, hydrates nothing, and reads
 * identically in the gate's parity render — where a client component would need a provider and a
 * request the harness does not have.
 *
 * **The browser's `<select>`, not `components/ui/select.tsx`.** The Radix select is a client
 * component that publishes no form value, so it cannot express a server-side filter without
 * JavaScript holding the state this screen deliberately does not have. A native `<select>` inside
 * a `GET` form submits `?action=role.change` on its own, which is the whole requirement.
 *
 * **A value is not rendered raw.** `before`/`after` arrive as fields from
 * `lib/admin/audit-log.ts::auditChangeOf()` — a key, a 48-character preview, and the text behind
 * the click. The card's rule is keys and truncation, not redaction, so a value shorter than the
 * budget is drawn in full: an operator has to be able to read `member → admin` without opening
 * anything, and a field long enough to hold a paragraph is what the click is for.
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_NOW_ISO, formatClockTime, formatDate, formatDateTimeLong } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import {
  ADMIN_AUDIT_PATH,
  AUDIT_ACTION_OPTIONS,
  AUDIT_PAGE_SIZE,
  AUDIT_TABLE_OPTIONS,
  type AdminActionRow,
  activeAuditAxes,
  auditActorIdentity,
  auditActorRole,
  auditChangeOf,
  type AuditChangeField,
  auditFilterHref,
  type AuditFilter,
  type AuditFilterKey,
  auditFilterWithout,
  auditTargetHref,
  auditTargetLabel,
  NO_AUDIT_FILTER,
} from "@/lib/admin/audit-log";
import { fillLabel, itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/**
 * The style `components/ui/input.tsx` gives a text field, for the two controls it cannot give it
 * to: a native `<select>` has no shadcn twin that submits a form (`select.tsx` is Radix and holds
 * its value in React state), so this mirrors the Input's own classes — height, ring, border — and
 * the control looks like the field beside it.
 */
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** One axis as a chip: the label the fixture templates, and a link that drops exactly this axis. */
function FilterChip({
  axis,
  filter,
  label,
  removeLabel,
}: {
  axis: AuditFilterKey;
  filter: AuditFilter;
  label: string;
  removeLabel: string;
}) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <Link href={auditFilterWithout(filter, axis)} title={removeLabel}>
        <span>{label}</span>
        <span aria-hidden="true">×</span>
        <span className="sr-only">{removeLabel}</span>
      </Link>
    </Button>
  );
}

/**
 * One side of a change: the key and the truncation, and the full value only after a click.
 *
 * `details`/`summary` rather than a stateful component: it is the browser's disclosure widget, it
 * works with no JavaScript, and it is what makes "until a click" true without shipping a bundle.
 */
function ChangeFields({
  label,
  fields,
  none,
}: {
  label: string;
  fields: readonly AuditChangeField[];
  none: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">{none}</p>
      ) : (
        <ul className="space-y-1">
          {fields.map((field) => (
            <li key={field.key} className="text-xs">
              <span className="font-mono text-muted-foreground">{field.key}</span>
              {": "}
              {field.truncated ? (
                <details>
                  <summary className="inline cursor-pointer">{field.preview}</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all rounded border bg-muted/40 p-2">
                    {field.full}
                  </pre>
                </details>
              ) : (
                <span>{field.preview}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminAuditLog({
  copy,
  rows,
  filter,
  unreadable,
}: {
  copy: PageCopy;
  /** The rows this view holds, newest first — already filtered by the database. */
  rows: readonly AdminActionRow[];
  /** What the URL asked for, parsed once by the page. */
  filter: AuditFilter;
  /** `DatabaseUnavailableError.reason` when the read failed; `null` on a normal visit. */
  unreadable: string | null;
}) {
  const columns = sectionOf(copy, "columns");
  const filtersCopy = sectionOf(copy, "filters");
  const changesCopy = sectionOf(copy, "changes");
  const actorCopy = sectionOf(copy, "actor");
  const reasonCopy = sectionOf(copy, "reason");
  const summaryCopy = sectionOf(copy, "summary");
  const listCopy = sectionOf(copy, "list");

  const axes = activeAuditAxes(filter);
  const capped = rows.length >= AUDIT_PAGE_SIZE;
  // One row is a row, not "1 rows": the fixture carries both sentences and the view picks.
  const summaryItem = capped ? "capped" : rows.length === 1 ? "count-one" : "count";
  const summary = fillLabel(itemLabel(summaryCopy, summaryItem), { shown: rows.length });
  const removeLabel = itemLabel(filtersCopy, "chip-remove");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="text-muted-foreground mt-1 max-w-3xl">{copy.subtitle}</p>
        )}
      </div>

      {unreadable === null ? null : (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{sectionOf(copy, "unreadable").heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(sectionOf(copy, "unreadable"))}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{unreadable}</p>
          </CardContent>
        </Card>
      )}

      {unreadable === null && (
        <>
          {/* The toolbar: a GET form, so every axis is in the URL and every view is linkable. */}
          <form
            action={ADMIN_AUDIT_PATH}
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-md border p-4"
          >
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label htmlFor="audit-actor">{itemLabel(filtersCopy, "actor-label")}</Label>
              <Input
                id="audit-actor"
                name="actor"
                defaultValue={filter.actor}
                placeholder={itemLabel(filtersCopy, "actor-placeholder")}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="audit-action">{itemLabel(filtersCopy, "action-label")}</Label>
              <select
                id="audit-action"
                name="action"
                defaultValue={filter.action}
                className={SELECT_CLASS}
              >
                <option value="">{itemLabel(filtersCopy, "action-all")}</option>
                {AUDIT_ACTION_OPTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="audit-table">{itemLabel(filtersCopy, "table-label")}</Label>
              <select
                id="audit-table"
                name="table"
                defaultValue={filter.table}
                className={SELECT_CLASS}
              >
                <option value="">{itemLabel(filtersCopy, "table-all")}</option>
                {AUDIT_TABLE_OPTIONS.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="audit-from">{itemLabel(filtersCopy, "from-label")}</Label>
              <Input
                id="audit-from"
                name="from"
                type="date"
                defaultValue={filter.from}
                className="w-[170px]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="audit-to">{itemLabel(filtersCopy, "to-label")}</Label>
              <Input
                id="audit-to"
                name="to"
                type="date"
                defaultValue={filter.to}
                className="w-[170px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">{itemLabel(filtersCopy, "apply")}</Button>
              <Button asChild variant="ghost">
                {/* A link, not a reset button: clearing is a view with no axes, and it has an address. */}
                <Link href={ADMIN_AUDIT_PATH}>{itemLabel(filtersCopy, "clear")}</Link>
              </Button>
            </div>

            {/* The one sentence the actor field needs sits under the row: inside the field's column
                it would push that input above the four controls beside it. */}
            <p className="w-full text-xs text-muted-foreground">
              {itemBody(filtersCopy, "actor-placeholder")}
            </p>
          </form>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {axes.map((axis) => (
                <FilterChip
                  key={axis}
                  axis={axis}
                  filter={filter}
                  removeLabel={removeLabel}
                  label={fillLabel(itemLabel(filtersCopy, `chip-${axis}`), {
                    value: filter[axis],
                  })}
                />
              ))}
            </div>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              {summary}
            </p>
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {sectionOf(copy, axes.length === 0 ? "empty-all" : "empty").heading ??
                    copy.heading}
                </CardTitle>
                <CardDescription>
                  {sectionBody(sectionOf(copy, axes.length === 0 ? "empty-all" : "empty"))}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {axes.length === 0 ? (
                  /**
                   * The empty log's instant, and it is the tree's fixture clock — never
                   * `new Date()`. A wall clock here is rendered once by the server and again at
                   * hydration (`#418`), and this sentence is only ever drawn when the log holds no
                   * row at all, so it is true whenever it appears.
                   */
                  <p className="text-sm text-muted-foreground">
                    {fillLabel(itemLabel(sectionOf(copy, "empty-all"), "as-of"), {
                      at: formatDateTimeLong(DEMO_NOW_ISO),
                    })}
                  </p>
                ) : (
                  <Button asChild variant="outline">
                    <Link href={auditFilterHref(NO_AUDIT_FILTER)}>
                      {itemLabel(sectionOf(copy, "empty"), "clear")}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              {/* A minimum width, so a narrow window scrolls the table rather than squeezing six
                  columns into 390 px: `Table` already wraps in `overflow-auto`, and without a floor
                  the reason and before/after cells wrap into a stack taller than the screen. The
                  hint above is the affordance a phone gets, because a scroll container draws no
                  scrollbar until it is touched. */}
              <p className="border-b px-3 py-2 text-xs text-muted-foreground md:hidden">
                {itemLabel(listCopy, "scroll-hint")}
              </p>
              <Table className="min-w-[56rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{itemLabel(columns, "when")}</TableHead>
                    <TableHead>{itemLabel(columns, "actor")}</TableHead>
                    <TableHead>{itemLabel(columns, "action")}</TableHead>
                    <TableHead>{itemLabel(columns, "target")}</TableHead>
                    <TableHead>{itemLabel(columns, "reason")}</TableHead>
                    <TableHead>{itemLabel(columns, "changes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const role = auditActorRole(row);
                    const href = auditTargetHref(row.targetTable, row.targetId);
                    const target = auditTargetLabel(row.targetTable, row.targetId);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          <span className="block">{formatDate(row.createdAt)}</span>
                          <span className="block">{formatClockTime(row.createdAt)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="block text-sm">{auditActorIdentity(row)}</span>
                          {row.actorEmail === null ? (
                            <span className="block text-xs text-muted-foreground">
                              {itemLabel(actorCopy, "account-gone")}
                            </span>
                          ) : null}
                          {role === null ? (
                            <span className="block text-xs text-muted-foreground">
                              {itemLabel(actorCopy, "role-not-recorded")}
                            </span>
                          ) : (
                            <Badge
                              variant="outline"
                              className="mt-1"
                              title={itemLabel(actorCopy, "role-label")}
                            >
                              {role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {row.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {href === null ? (
                            target
                          ) : (
                            <Link className="underline underline-offset-2" href={href}>
                              {target}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[24rem] text-sm">
                          {row.reason === null ? (
                            <span className="text-muted-foreground">
                              {itemLabel(reasonCopy, "not-stated")}
                            </span>
                          ) : (
                            row.reason
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-3">
                            <ChangeFields
                              label={itemLabel(changesCopy, "before")}
                              fields={auditChangeOf(row.before)}
                              none={itemLabel(changesCopy, "none")}
                            />
                            <ChangeFields
                              label={itemLabel(changesCopy, "after")}
                              fields={auditChangeOf(row.after)}
                              none={itemLabel(changesCopy, "none")}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{sectionBody(listCopy)}</p>
        </>
      )}
    </div>
  );
}
