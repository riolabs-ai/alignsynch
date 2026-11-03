// template-ancestor: components/admin/instance-registry.tsx   (variation: the operator's users list — the two seats and the members in the registry's table shape, with role and seeded last sign-in and no address rendered at all)
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import { formatDate } from "@/content/core";
import { PERSONA_META, type V1Account } from "@/data/v1/fixtures";
import { type AdminUserRow, adminUserGroups } from "@/lib/v1/admin-console";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";

/** The account-state word — `trial` and `stuck` are the store's own states, not a new ladder. */
const ACCOUNT_STATE_LABEL: Record<V1Account["state"], string> = {
  active: "Active",
  trial: "Trial",
  stuck: "Stuck",
};

const ACCOUNT_STATE_TONE: Record<V1Account["state"], string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  trial: "bg-blue-50 text-blue-700 border-blue-200",
  stuck: "bg-amber-50 text-amber-700 border-amber-200",
};

/** One account row, in both layouts. */
function AccountRow({ row }: { row: AdminUserRow }) {
  return (
    <TableRow data-admin-user-row={row.id} data-admin-user-group={row.group}>
      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
      <TableCell className="text-sm">{PERSONA_META[row.persona].label}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {row.group === "seat" ? "Seat" : "Member"}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            ACCOUNT_STATE_TONE[row.state],
          )}
        >
          {ACCOUNT_STATE_LABEL[row.state]}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(row.lastSignInAt)}
      </TableCell>
    </TableRow>
  );
}

/** The table shell both groups share, so the two cannot drift into two column orders. */
function GroupTable({ rows }: { rows: readonly AdminUserRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Last sign-in</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <AccountRow key={row.id} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * `/admin/console/users` — the two seats and the members.
 *
 * The split is the console's own vocabulary, not a permission ladder: the **two seats** are the
 * initiator and the counterparty — the two roles every relationship is built from — and the
 * **members** are the coach, the admin and the service account. Each row carries the role, the
 * account's own state and the instant the store seeds as its last sign-in;
 * `adminUserGroups()` derives the split and never reads a clock.
 *
 * **No address is rendered, and the row type cannot carry one.** `AdminUserRow` has no `email`
 * field, so this screen could only show an address by widening the type first — which is the
 * point: the store's accounts are demo identities, and a console that printed
 * `jordan@example.com` would invite a reader to treat the prototype's fixtures as customers.
 *
 * There is also **no user-management form**. This page reads the store; adding, editing or
 * deleting an account would be a write to Neon's Managed Auth, which the prototype does not have
 * and must not appear to. That limit is stated on the page rather than implied by an absent button.
 */
export function AdminUsersList() {
  const { hydrated, accounts } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={3} />
      </div>
    );
  }

  const groups = adminUserGroups(accounts);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8" data-admin-users="true">
      <SectionIntro
        title="Users"
        subtitle={`${accounts.length} accounts: ${groups.seats.length} seats and ${groups.members.length} members. Roles and last sign-in come from the store — no addresses are rendered.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">The two seats</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupTable rows={groups.seats} />
          <p className="mt-3 text-sm text-muted-foreground">
            A seat is a role on a relationship. The initiator opens the relationship and holds its
            subscription; the counterparty claims the invitation and pays nothing.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupTable rows={groups.members} />
          <p className="mt-3 text-sm text-muted-foreground">
            Every other account the store knows about: the coach (read-only advice), the admin (this
            console) and the service queue.
          </p>
        </CardContent>
      </Card>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        These are demo identities. There is no add, edit or delete on this page, because an account
        is written by Neon&apos;s Managed Auth — a form here would pretend to write to it.
      </p>
    </div>
  );
}
