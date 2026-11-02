"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: relationship rows — a desktop table with computed flag counts, collapsing to status-led cards on mobile)
// template-ancestors: components/dashboard/my-quizzes-dashboard.tsx (per-persona rows),
//   components/assessment-flow/instance-view.tsx (stage badge)

import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import type { V1Relationship } from "@/data/v1/fixtures";
import {
  GAP_FLAG_COLUMNS,
  GAP_FLAG_LABELS,
  gapFlagCountsOf,
  inviteStateOf,
  relationshipNameOf,
  sessionCompleteOf,
  stageOfRelationship,
  type GapFlagColumn,
  type InviteState,
} from "@/lib/v1/derive";
import { relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, LoadingState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import { Send } from "lucide-react";
import Link from "next/link";

/** The flag colour per column — the number is coloured, never colour-only. */
const FLAG_TONE: Record<GapFlagColumn, string> = {
  yellow: "text-yellow-600",
  orange: "text-orange-600",
  pink: "text-pink-600",
  red: "text-red-600",
};

/** The stable invite-state word, authored once — no countdown, no ticking. */
const INVITE_STATE_LABEL: Record<InviteState, string> = {
  "not-sent": "Not sent",
  pending: "Pending",
  expired: "Expired",
  accepted: "Accepted",
};

const INVITE_STATE_TONE: Record<InviteState, string> = {
  "not-sent": "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  expired: "bg-red-50 text-red-700 border-red-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
};

/** The invite badge — one word, no countdown, the same wording on the list and the detail. */
function InviteBadge({ state }: { state: InviteState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        INVITE_STATE_TONE[state],
      )}
    >
      {INVITE_STATE_LABEL[state]}
    </span>
  );
}

/** The party the viewer is NOT, for the "Other party" column. */
function otherPartyLabel(persona: DashboardPersona, rel: V1Relationship): string {
  switch (persona) {
    case "initiator":
      return rel.counterpartyName ?? "Unclaimed";
    case "counterparty":
      return rel.initiatorName;
    default:
      // A coach or an admin is neither party, so the column names both — read initiator first,
      // with an arrow, so the direction survives a name that is already a pair ("Ruth & Sam").
      return `${rel.initiatorName} → ${rel.counterpartyName ?? "Unclaimed"}`;
  }
}

/** The next-session line, derived from the store — never a fabricated date. */
function nextSessionLabel(rel: V1Relationship): string {
  if (rel.counterpartyName === null) return "Invite a counterparty first";
  if (!sessionCompleteOf(rel)) return "In progress";
  return "Available — request a new session";
}

/** `N of M sessions`, straight from the store's two counters. */
function sessionCountLabel(rel: V1Relationship): string {
  return rel.openedSessions === 0
    ? "No sessions yet"
    : `${rel.completedSessions} of ${rel.openedSessions} sessions`;
}

/**
 * `/v1/[persona]/relationships` — the relationships list.
 *
 * Desktop is the reference mockup's table (`Name · Other party · Stage · Y/O/P/R · Mode ·
 * Setting · Last modified`), the four flag columns counting the relationship's Gaps at each
 * magnitude — derived on every render from the parties' answers, never stored. Below `md` it
 * collapses to one status-led card per relationship (name, type, stage, next session, session
 * count, and — initiator only — the subscription state and the invite action).
 */
export function RelationshipsList({ persona }: { persona: DashboardPersona }) {
  const { hydrated, relationships, templates, sendInvite } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const visible = relationshipsVisibleTo(persona, relationships);
  const now = Date.now();

  const titleFor = (rel: V1Relationship) =>
    templates.find((t) => t.id === rel.templateId)?.title ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Relationships"
        subtitle={`${visible.length} relationship${visible.length === 1 ? "" : "s"} you can see, counted from the store.`}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="No relationships yet"
          body="A relationship is a template copied and given two parties. Start one from a template."
        />
      ) : (
        <>
          {/* Desktop table — the reference mockup's primary shape. */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Other party</TableHead>
                  <TableHead>Stage</TableHead>
                  {GAP_FLAG_COLUMNS.map((column) => (
                    <TableHead key={column} className="text-center" title={GAP_FLAG_LABELS[column]}>
                      {column.slice(0, 1).toUpperCase()}
                    </TableHead>
                  ))}
                  <TableHead>Mode</TableHead>
                  <TableHead>Setting</TableHead>
                  <TableHead>Last modified</TableHead>
                  {persona === "initiator" && <TableHead className="text-right">Invite</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((rel) => {
                  const flags = gapFlagCountsOf(rel);
                  const stage = stageOfRelationship(rel);
                  const name = relationshipNameOf(rel, titleFor(rel));
                  const invite = inviteStateOf(rel, now);
                  const unclaimed = rel.counterpartyName === null;
                  return (
                    <TableRow key={rel.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/v1/${persona}/relationships/${rel.id}`}
                          className="text-foreground hover:text-action hover:underline"
                        >
                          {name}
                        </Link>
                        {persona === "initiator" && rel.subscription !== null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            · {rel.subscription.status.replace("_", " ")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {otherPartyLabel(persona, rel)}
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={stage} />
                      </TableCell>
                      {GAP_FLAG_COLUMNS.map((column) => {
                        const value = flags[column];
                        return (
                          <TableCell key={column} className="text-center">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                value === null ? "text-muted-foreground" : FLAG_TONE[column],
                              )}
                            >
                              {value === null ? "—" : value}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-muted-foreground">
                        {MODE_LABELS[rel.mode]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {SETTING_LABELS[rel.setting]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(rel.modifiedAt)}
                      </TableCell>
                      {persona === "initiator" && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <InviteBadge state={invite} />
                            {unclaimed && (
                              <button
                                type="button"
                                onClick={() => sendInvite(rel.id)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
                              >
                                <Send className="h-3.5 w-3.5" />
                                {rel.inviteToken === null ? "Invite" : "Re-invite"}
                              </button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Y / O / P / R — Gaps at 1 / 2 / 3 / 4 ({GAP_FLAG_LABELS.yellow} /{" "}
              {GAP_FLAG_LABELS.orange} / {GAP_FLAG_LABELS.pink} / {GAP_FLAG_LABELS.red}), counted
              from the completed report; &ldquo;—&rdquo; means no scored session yet.
            </p>
          </div>

          {/* Mobile cards — the fallback shape. */}
          <div className="space-y-3 md:hidden">
            {visible.map((rel) => {
              const stage = stageOfRelationship(rel);
              const name = relationshipNameOf(rel, titleFor(rel));
              const unclaimed = rel.counterpartyName === null;
              return (
                <article key={rel.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/v1/${persona}/relationships/${rel.id}`}
                      className="text-sm font-semibold text-foreground hover:text-action"
                    >
                      {name}
                    </Link>
                    <StageBadge stage={stage} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Type · {titleFor(rel) || "Relationship"}
                  </p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Next session</dt>
                      <dd className="text-foreground">{nextSessionLabel(rel)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Sessions</dt>
                      <dd className="text-foreground">{sessionCountLabel(rel)}</dd>
                    </div>
                  </dl>
                  {persona === "initiator" && rel.subscription !== null && (
                    <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                      Subscription ·{" "}
                      <span className="font-medium capitalize text-foreground">
                        {rel.subscription.status.replace("_", " ")}
                      </span>{" "}
                      · ends {formatDate(rel.subscription.periodEnd)}
                    </p>
                  )}
                  {persona === "initiator" && (
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
                      <InviteBadge state={inviteStateOf(rel, now)} />
                      <span className="text-xs text-muted-foreground">
                        {unclaimed ? "Counterparty invite" : "Counterparty joined"}
                      </span>
                      {unclaimed && (
                        <button
                          type="button"
                          onClick={() => sendInvite(rel.id)}
                          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-action px-3 text-sm font-medium text-action-foreground hover:bg-action/90"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {rel.inviteToken === null ? "Invite" : "Re-invite"}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
