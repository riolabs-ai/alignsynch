"use client";

/**
 * template-ancestor: components/my-quizzes/quiz-statistics.tsx   (variation: the quiz's metric strip becomes the plan counts, and its per-question table becomes one row per relationship — the plan, its period, the provider state and the live/test badge — with one audited grant band below where the chart tabs were)
 *
 * `/admin/billing` — the operator's billing control screen (#505).
 *
 * **The table it copies, and the axes it varies** (the template doctrine's three questions):
 *
 *   quiz-statistics                    this screen
 *   ---------------------------------  --------------------------------------------
 *   metric cards above the table       the same strip: six counts, from the rows
 *   a table of per-question rows       a table of per-relationship rows
 *   charts and tab groups              dropped — billing has no series to plot
 *   a filter row (period, cohort)      dropped — one list, newest first
 *   its actions live in a menu         one band below the table: comp or extend
 *
 * **The mode is not fine print.** Every row carries a `Live` / `Test` badge and the banner above the
 * table states how many rows were bought on test keys. The card's first acceptance is that a
 * reader can tell the two apart on one list, so the distinction is in the badge, the banner and the
 * stat strip — three places, none of them a tooltip.
 *
 * **`support` never renders this.** The page's `requireAdmin()` answers a `support` session with the
 * 404 an unknown URL gets, so a component that checked the role would be checking it twice and the
 * second check would be the one to rot. What the component *does* do with the role is say it out
 * loud: the comp band draws the actor's rung and whether `plan.comp`'s `owner` floor lets them
 * through — and then posts anyway, because the refusal is the server's (`act()` re-reads the rung
 * inside the transaction).
 *
 * **Literal-free (E23).** Every word is `data/pages/admin-billing.ts`; the plan names come from
 * `data/billing-plans.ts` and the instants from `content/core.ts`, which are the two exceptions the
 * repo already makes. A sentence typed into this file is a red build.
 */
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { formatDate } from "@/content/core";
import type { UserRole } from "@/content/identity";
import type { AdminBillingCounts, AdminBillingRow } from "@/lib/db/admin-billing";
import type { GrantFormInput, GrantFormResult } from "@/lib/admin/grant-input";
import { ADMIN_AUDIT_PATH } from "@/lib/admin/paths";
import { fillLabel, itemBody, itemLabel, itemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/** One plan as the limits card prints it: the fixture's own name and the gate's own number. */
export interface BillingPlanLimit {
  readonly id: string;
  readonly name: string;
  readonly limit: number | null;
}

/** One grantable tier: what a comp may give. */
export interface BillingGrantablePlan {
  readonly id: string;
  readonly name: string;
}

/** The screen is doing nothing, or it has one grant's result to draw. */
type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "done"; readonly result: GrantFormResult };

/** The badge tone a mode gets: live is a fact about money, test is a fact about this build. */
const MODE_VARIANT: Record<"live" | "test" | "none", "success" | "secondary" | "outline"> = {
  live: "success",
  test: "secondary",
  none: "outline",
};

/**
 * The provider's status word → the copy id that names it.
 *
 * The column's vocabulary is `SUBSCRIPTION_STATUSES` (`active`, `trialing`, `past_due`, …) and a
 * page-copy id may not carry an underscore, so the join is written out once. Typed over the five
 * values plus `none`, so a sixth status is a compile error until it has words — a `replace("_", "-")`
 * would have passed an unknown status through as a missing id.
 */
const STATUS_COPY_ID: Record<string, string> = {
  active: "active",
  trialing: "trialing",
  past_due: "past-due",
  canceled: "canceled",
  incomplete: "incomplete",
  none: "none",
};

/** A fill for an item that carries placeholders, so the view never writes a sentence. */
function say(
  section: PageCopySection,
  id: string,
  values: Record<string, string | number>,
): string {
  return fillLabel(itemLabel(section, id), values);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** One row's mode, as a badge and as the words the fixture gives it. */
function ModeBadge({ row, copy }: { row: AdminBillingRow; copy: PageCopySection }) {
  if (row.subscription === null) {
    return (
      <Badge variant={MODE_VARIANT.none} data-mode="none">
        {itemLabel(copy, "none")}
      </Badge>
    );
  }
  return row.subscription.livemode ? (
    <Badge variant={MODE_VARIANT.live} data-mode="live">
      {itemLabel(copy, "live")}
    </Badge>
  ) : (
    <Badge variant={MODE_VARIANT.test} data-mode="test">
      {itemLabel(copy, "test")}
    </Badge>
  );
}

export function BillingControl({
  copy,
  rows,
  counts,
  limits,
  grantable,
  role,
  unreadable,
  action,
  reasonMin,
}: {
  copy: PageCopy;
  rows: readonly AdminBillingRow[];
  counts: AdminBillingCounts;
  limits: readonly BillingPlanLimit[];
  grantable: readonly BillingGrantablePlan[];
  /** The rung `requireAdmin()` used. Shown, never enforced here. */
  role: UserRole;
  /** `DatabaseUnavailableError.reason` when the read failed; `null` on a normal visit. */
  unreadable: string | null;
  /** The server action. Passed in rather than imported so this module never reaches `app/`. */
  action: (input: GrantFormInput) => Promise<GrantFormResult>;
  /** `REASON_MIN_LENGTH`, handed down: importing it here would pull `pg` into the bundle (E34). */
  reasonMin: number;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [relationshipId, setRelationshipId] = useState(rows[0]?.relationshipId ?? "");
  const [planId, setPlanId] = useState(grantable[0]?.id ?? "");
  const [kind, setKind] = useState("comp");
  const [interval, setInterval] = useState("month");
  const [periodStart, setPeriodStart] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const statsCopy = sectionOf(copy, "stats");
  const columns = sectionOf(copy, "columns");
  const modeBadge = sectionOf(copy, "mode-badge");
  const statusCopy = sectionOf(copy, "status");
  const sourceCopy = sectionOf(copy, "plan-source");
  const grantCell = sectionOf(copy, "grant-cell");
  const limitsCopy = sectionOf(copy, "limits");
  const formCopy = sectionOf(copy, "form");
  const floorCopy = sectionOf(copy, "floor");
  const refusalsCopy = sectionOf(copy, "refusals");
  const doneCopy = sectionOf(copy, "done");
  const modeCopy = sectionOf(copy, "mode");

  const billed = counts.live + counts.test;
  const bannerId =
    counts.test > 0 ? "banner-test" : counts.live > 0 ? "banner-live" : "banner-none";
  const banner = itemOf(modeCopy, bannerId);
  const bannerSentence = fillLabel(banner.label, { test: counts.test, billed });
  const bannerBody = itemBody(modeCopy, bannerId);
  const accounts = new Set(rows.map((row) => row.initiatorUserId ?? "")).size;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    void action({ relationshipId, planId, kind, interval, periodStart, reason })
      .then((result) => {
        setPhase({ kind: "done", result });
        if (result.ok) setReason("");
      })
      .finally(() => setBusy(false));
  };

  const result = phase.kind === "done" ? phase.result : null;
  const mayComp = role === "owner";

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
            <p className="font-mono text-sm">{unreadable}</p>
          </CardContent>
        </Card>
      )}

      {unreadable === null && (
        <>
          {/* The card's first acceptance, in one band: how much of this list is play money. */}
          <Card
            data-banner={bannerId}
            className={
              counts.test > 0 && counts.live > 0
                ? "border-amber-400"
                : counts.test > 0
                  ? "border-amber-300"
                  : counts.live > 0
                    ? "border-emerald-300"
                    : undefined
            }
          >
            <CardHeader>
              <CardTitle>{bannerSentence}</CardTitle>
              <CardDescription>{bannerBody}</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label={itemLabel(statsCopy, "relationships")} value={counts.relationships} />
            <Stat label={itemLabel(statsCopy, "paid")} value={counts.paid} />
            <Stat label={itemLabel(statsCopy, "live")} value={counts.live} />
            <Stat label={itemLabel(statsCopy, "test")} value={counts.test} />
            <Stat label={itemLabel(statsCopy, "granted")} value={counts.granted} />
            <Stat label={itemLabel(statsCopy, "blocked")} value={counts.blocked} />
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{sectionOf(copy, "empty").heading ?? copy.heading}</CardTitle>
                <CardDescription>{sectionBody(sectionOf(copy, "empty"))}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{itemLabel(columns, "relationship")}</TableHead>
                    <TableHead>{itemLabel(columns, "template")}</TableHead>
                    <TableHead>{itemLabel(columns, "account")}</TableHead>
                    <TableHead>{itemLabel(columns, "plan")}</TableHead>
                    <TableHead>{itemLabel(columns, "period-end")}</TableHead>
                    <TableHead>{itemLabel(columns, "provider")}</TableHead>
                    <TableHead>{itemLabel(columns, "state")}</TableHead>
                    <TableHead>{itemLabel(columns, "mode")}</TableHead>
                    <TableHead>{itemLabel(columns, "grant")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.relationshipId} data-relationship={row.relationshipId}>
                      <TableCell className="font-mono text-xs">{row.relationshipId}</TableCell>
                      <TableCell className="font-medium">{row.templateTitle}</TableCell>
                      <TableCell className="text-sm">
                        {row.initiatorName ?? itemLabel(sourceCopy, "none")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="block font-medium">{row.planId}</span>
                        <span className="block text-xs text-muted-foreground">
                          {itemLabel(sourceCopy, row.planSource)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.subscription === null
                          ? itemLabel(statusCopy, "none")
                          : formatDate(row.subscription.currentPeriodEnd)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.subscription === null
                          ? itemLabel(statusCopy, "none")
                          : row.subscription.provider}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge
                          variant={row.subscription?.status === "active" ? "success" : "outline"}
                        >
                          {row.subscription === null
                            ? itemLabel(statusCopy, "none")
                            : itemLabel(
                                statusCopy,
                                STATUS_COPY_ID[row.subscription.status] ?? "none",
                              )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ModeBadge row={row} copy={modeBadge} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.grant === null ? (
                          itemLabel(grantCell, "none")
                        ) : (
                          <span className="flex flex-col gap-1">
                            <span>{itemLabel(grantCell, row.grant.kind)}</span>
                            <span className="text-xs text-muted-foreground">
                              {say(grantCell, "period", {
                                from: formatDate(row.grant.periodStart),
                                to: formatDate(row.grant.periodEnd),
                              })}
                            </span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{sectionOf(copy, "limits").heading ?? copy.heading}</CardTitle>
              <CardDescription>{sectionBody(limitsCopy)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ul className="space-y-1">
                {limits.map((plan) => (
                  <li key={plan.id} data-plan-limit={plan.id}>
                    {say(limitsCopy, "plan-limit", {
                      plan: plan.name,
                      limit:
                        plan.limit === null
                          ? itemLabel(limitsCopy, "unlimited")
                          : say(limitsCopy, plan.limit === 1 ? "limit-singular" : "limit-plural", {
                              limit: plan.limit,
                            }),
                    })}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                {say(limitsCopy, "blocked-count", { blocked: counts.blocked, accounts })}
              </p>
            </CardContent>
          </Card>

          <Separator />

          <Card data-floor={role}>
            <CardHeader>
              <CardTitle>{sectionOf(copy, "floor").heading ?? copy.heading}</CardTitle>
              <CardDescription>{sectionBody(floorCopy)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p data-role={role}>{say(floorCopy, "your-role", { role })}</p>
              <p>{itemLabel(floorCopy, mayComp ? "may-comp" : "may-not-comp")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{sectionOf(copy, "form").heading ?? copy.heading}</CardTitle>
              <CardDescription>{sectionBody(formCopy)}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submit}>
                <div className="space-y-1">
                  <Label htmlFor="comp-relationship">{itemLabel(formCopy, "relationship")}</Label>
                  <select
                    id="comp-relationship"
                    name="relationshipId"
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={relationshipId}
                    onChange={(event) => setRelationshipId(event.target.value)}
                  >
                    {rows.map((row) => (
                      <option key={row.relationshipId} value={row.relationshipId}>
                        {row.templateTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="comp-plan">{itemLabel(formCopy, "plan")}</Label>
                    <select
                      id="comp-plan"
                      name="planId"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={planId}
                      onChange={(event) => setPlanId(event.target.value)}
                    >
                      {grantable.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="comp-kind">{itemLabel(formCopy, "kind")}</Label>
                    <select
                      id="comp-kind"
                      name="kind"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="comp">{itemLabel(formCopy, "kind-comp")}</option>
                      <option value="extend">{itemLabel(formCopy, "kind-extend")}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="comp-interval">{itemLabel(formCopy, "interval")}</Label>
                    <select
                      id="comp-interval"
                      name="interval"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={interval}
                      onChange={(event) => setInterval(event.target.value)}
                    >
                      <option value="month">{itemLabel(formCopy, "interval-month")}</option>
                      <option value="year">{itemLabel(formCopy, "interval-year")}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="comp-start">{itemLabel(formCopy, "start")}</Label>
                    <Input
                      id="comp-start"
                      name="periodStart"
                      type="date"
                      required
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="comp-reason">{itemLabel(formCopy, "reason")}</Label>
                  <Input
                    id="comp-reason"
                    name="reason"
                    required
                    minLength={reasonMin}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    {say(formCopy, "reason-short", { min: reasonMin })}
                  </p>
                </div>

                <Button type="submit" disabled={busy || rows.length === 0} variant="outline">
                  {busy ? itemLabel(formCopy, "submitting") : itemLabel(formCopy, "submit")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {result === null ? null : (
            <Card
              data-outcome={result.ok ? "ok" : result.code}
              className={result.ok ? "border-emerald-300" : "border-destructive/50"}
            >
              <CardHeader>
                <CardTitle>
                  {result.ok
                    ? (sectionOf(copy, "done").heading ?? copy.heading)
                    : result.code === "reason-too-short"
                      ? say(refusalsCopy, "reason-too-short", { min: reasonMin })
                      : itemLabel(refusalsCopy, result.code)}
                </CardTitle>
                {result.ok ? <CardDescription>{sectionBody(doneCopy)}</CardDescription> : null}
              </CardHeader>
              {result.ok ? (
                <CardContent className="space-y-2 text-sm">
                  <p>{say(doneCopy, "logged", { action: result.action })}</p>
                  <p>
                    {say(doneCopy, "period", {
                      from: formatDate(result.periodStart),
                      to: formatDate(result.periodEnd),
                    })}
                  </p>
                  <p>
                    <Link
                      href={ADMIN_AUDIT_PATH}
                      className="text-action font-medium hover:underline"
                      data-audit-link="true"
                    >
                      {itemLabel(doneCopy, "audit")}
                    </Link>
                  </p>
                </CardContent>
              ) : result.detail === undefined ? null : (
                <CardContent>
                  <p className="font-mono text-xs text-muted-foreground">{result.detail}</p>
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
