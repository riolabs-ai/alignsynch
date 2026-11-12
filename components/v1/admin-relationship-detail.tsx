// template-ancestor: components/assessment-flow/instance-view.tsx   (variation: the operator's relationship page — seats, subscription and a session list that says scored or open and nothing a party answered, with the archive action behind a confirmation and a restore that is one click)
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLimitsPanel } from "@/components/v1/admin-limits";
import { RelationshipMetadata } from "@/components/v1/relationship-metadata";
import {
  EmptyState,
  LoadingState,
  NotFoundState,
  SectionIntro,
  StageBadge,
} from "@/components/v1/v1-ui";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import { seedSessions, type V1Relationship } from "@/data/v1/fixtures";
import {
  ADMIN_ANSWER_LIMIT_SENTENCE,
  ADMIN_RELATIONSHIPS_PATH,
  type AdminSessionRow,
  type AdminSessionState,
  adminRelationshipRow,
  adminSessionRows,
} from "@/lib/v1/admin-console";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { Archive, ArchiveRestore } from "lucide-react";
import Link from "next/link";

/** The session state's word — the only thing this page is allowed to know about a sheet. */
const SESSION_STATE_LABEL: Record<AdminSessionState, string> = {
  "open-answers": "Open — awaiting answers",
  "open-acceptance": "Open — awaiting acceptance",
  scored: "Scored",
};

const SESSION_STATE_TONE: Record<AdminSessionState, string> = {
  "open-answers": "bg-blue-50 text-blue-700 border-blue-200",
  "open-acceptance": "bg-amber-50 text-amber-700 border-amber-200",
  scored: "bg-green-50 text-green-700 border-green-200",
};

const SUBSCRIPTION_TONE = {
  active: "bg-green-50 text-green-700 border-green-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
  lapsed: "bg-red-50 text-red-700 border-red-200",
  none: "bg-slate-100 text-slate-700 border-slate-200",
} as const;

const SUBSCRIPTION_LABEL = {
  active: "Active",
  past_due: "Past due",
  lapsed: "Lapsed",
  none: "None",
} as const;

/** One fact row in the header card — a label and a value, never a figure derived from answers. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * `/admin/console/relationships/[id]` — one relationship, as an operator sees it.
 *
 * The page is the console's answer to "open one to see its sessions". It draws the seats, the
 * subscription and the session list, and it draws **no answer**: `adminSessionRows()` returns
 * `state`, `scored`, `completedAt` and an Aspect *count*, and the row type it builds is the only
 * thing this component can read. The blind sentence at the top of the page is not a disclaimer
 * added to a screen that could leak — it is a description of the type the screen is rendered from.
 *
 * Two writes, both reversible: **Archive** (behind an `AlertDialog`, because it changes which list
 * the row appears in) and **Restore** (one click, because it undoes exactly that). Neither removes
 * a party, an Aspect, a session or an answer — the store keeps them and `archivedAt` is the only
 * field either action touches.
 */
export function AdminRelationshipDetail({ relationshipId }: { relationshipId: string }) {
  const { hydrated, relationships, templates, archiveRelationship, restoreRelationship } =
    useV1Store();

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <LoadingState rows={4} />
      </div>
    );
  }

  const rel: V1Relationship | undefined = relationships.find((row) => row.id === relationshipId);
  if (rel === undefined) {
    return (
      <NotFoundState
        message={`No relationship "${relationshipId}" exists in the store.`}
        back={ADMIN_RELATIONSHIPS_PATH}
      />
    );
  }

  const sessionFixtures = seedSessions.filter((session) => session.relationshipId === rel.id);
  const row = adminRelationshipRow(
    rel,
    templates.find((template) => template.id === rel.templateId)?.title ?? rel.templateId,
    Date.now(),
    sessionFixtures,
  );
  const sessions: readonly AdminSessionRow[] = adminSessionRows(rel, sessionFixtures);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={ADMIN_RELATIONSHIPS_PATH}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Relationships
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionIntro
          title={row.name}
          subtitle={`${row.templateTitle} · ${MODE_LABELS[row.mode]} · ${SETTING_LABELS[row.setting]}`}
        />
        <div className="flex items-center gap-2">
          <StageBadge stage={row.stage} />
          {row.archived && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              archived
            </span>
          )}
        </div>
      </div>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {ADMIN_ANSWER_LIMIT_SENTENCE}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">The relationship</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Fact label="Stage" value={row.stage} />
              <Fact label="Created" value={formatDate(row.createdAt)} />
              <Fact label="Last activity" value={formatDate(row.lastActivity)} />
              <Fact label="Sessions listed" value={String(sessions.length)} />
              <Fact label="Sessions scored" value={String(row.sessionsScored)} />
              <Fact
                label="Steps recorded"
                value={
                  row.stepsRecorded === 0 ? "—" : `${row.stepsDone} of ${row.stepsRecorded} done`
                }
              />
              <Fact
                label="Archived"
                value={row.archivedAt === null ? "No" : formatDate(row.archivedAt)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Parties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Initiator · </span>
              {row.initiator.name}{" "}
              <span className="text-muted-foreground">({row.initiator.state})</span>
            </p>
            <p>
              <span className="text-muted-foreground">Counterparty · </span>
              {row.counterparty.name ?? "—"}{" "}
              <span className="text-muted-foreground">({row.counterparty.state})</span>
            </p>
            <p className="pt-2 text-muted-foreground">
              A seat&apos;s state is derived from the relationship&apos;s own fields: a claimed
              counterparty is a name, and an unclaimed one is the invite&apos;s own state.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* The metadata writes the matrix grants an operator (#404 §7): the name, and the Setting
          between sessions. The Mode is read-only even here — a change would invalidate answers
          already given, so the honest move is a new relationship. */}
      <RelationshipMetadata rel={rel} viewer="admin" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              SUBSCRIPTION_TONE[row.subscription],
            )}
            data-admin-subscription={row.subscription}
          >
            {SUBSCRIPTION_LABEL[row.subscription]}
          </span>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {row.subscriptionPlan === null
            ? "This relationship has no subscription — the shop's checkout is the path that gives it one."
            : `Plan: ${row.subscriptionPlan}. The per-relationship subscription is the initiator's; the counterparty pays nothing.`}
        </CardContent>
      </Card>

      <section aria-labelledby="console-sessions" className="space-y-2" data-admin-sessions="true">
        <h2 id="console-sessions" className="text-base font-semibold text-foreground">
          Sessions
        </h2>
        <p className="text-sm text-muted-foreground">
          What the console knows about a session is whether it is scored. It has no field that could
          hold an answer, so none is rendered.
        </p>
        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            body="This relationship has not opened a session — there is nothing scored to list."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                data-admin-session-row={session.id}
                data-admin-session-scored={session.scored ? "true" : "false"}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {session.scored
                      ? `Scored ${session.completedAt === null ? "" : formatDate(session.completedAt)}`
                      : SESSION_STATE_LABEL[session.state]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.aspectCount} Aspects in the sheet
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    SESSION_STATE_TONE[session.state],
                  )}
                >
                  {session.scored ? "Scored" : "Not scored"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The Steps are **not** rendered here, deliberately. Their words embed the Aspect prompt and
          the measured Gap ("… of 3") — a figure derived from two answer values, which is exactly
          what this page's limit sentence promises an operator does not see. The count above
          ("Steps recorded: 2 of 9 done") is the whole fact the console carries: that a plan exists
          and how much of it the parties have ticked, never a word of it. `lib/v1/admin-console.ts`
          states the same boundary on `stepsRecorded`/`stepsDone`. */}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Archive</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {row.archived ? (
            <>
              <p>
                Archived {row.archivedAt === null ? "" : formatDate(row.archivedAt)}. Every party,
                Aspect and session is still here; restoring puts the row back in the live registry.
              </p>
              <Button
                variant="outline"
                onClick={() => restoreRelationship(rel.id)}
                data-admin-restore={rel.id}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" aria-hidden="true" />
                Restore relationship
              </Button>
            </>
          ) : (
            <>
              <p>
                Archiving hides the row from the live registry. It deletes nothing — one field is
                stamped, and Restore clears it.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-admin-archive-trigger={rel.id}>
                    <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                    Archive relationship
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive {row.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The relationship leaves the live registry. Its parties, Aspects, sessions and{" "}
                      {row.sessionsScored} scored session
                      {row.sessionsScored === 1 ? "" : "s"} stay exactly as they are, and Restore
                      puts it back.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => archiveRelationship(rel.id)}
                      data-admin-archive-confirm={rel.id}
                    >
                      Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>

      <AdminLimitsPanel />
    </div>
  );
}
