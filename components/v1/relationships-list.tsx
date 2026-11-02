"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the relationship list — the same title row with the primary action at the right, the same search field in a filter row, the same stage Tabs and the same Card grid; the card's cover block becomes a stage band and its metric row translates Players → sessions `N of M`, Completion → session completion, Average Score → average alignment and `N Questions` → `N Aspects`, with what was paid on the Initiator's card only)
// template-ancestors: components/v1/manage-tab.tsx (the metric row this card reuses: session completion, average alignment, what was paid), components/v1/v1-ui.tsx (StageBadge)

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { DEMO_NOW_ISO, formatDate, formatRelative } from "@/content/core";
import { STAGE_LABELS, type RelationshipStage } from "@/content/stages";
import type { V1Relationship } from "@/data/v1/fixtures";
import {
  GAP_FLAG_COLUMNS,
  GAP_FLAG_LABELS,
  cardMetricsOf,
  gapFlagCountsOf,
  inviteStateOf,
  relationshipNameOf,
  stageOfRelationship,
  type GapFlagColumn,
  type InviteState,
} from "@/lib/v1/derive";
import { moneyVisibleTo, relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";
import { LoadingState, StageBadge } from "@/components/v1/v1-ui";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { Eye, Plus, Search, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * `/v1/[persona]/relationships` — the persona's relationships as the My Quizzes surface,
 * translated.
 *
 * The ancestor is `components/my-quizzes/my-quizzes.tsx`, and the header stack is copied from it
 * in order: the title row with the primary action at the right, the filter row with a search
 * field, then the stage `Tabs` — the same `Button`, `Input`, `Tabs` and `Card` primitives, over
 * relationship stages instead of quiz statuses. The grid is three-up on large screens and one-up
 * on a phone (never the ancestor's `xl:grid-cols-4`): a relationship card carries a stage and a
 * metric row rather than a cover image, so it needs the width.
 *
 * The metric row is the part that has to be honest. My Quizzes prints Players, Completion, Average
 * Score and Revenue; a relationship prints the same four ideas as **sessions completed of opened**,
 * **session completion %**, **average alignment** (the mean Gap, `—` until the session is scored)
 * and **Aspects**. What was paid is the fifth: the plan and its period, on the Initiator's card
 * only — a counterparty, a coach and an admin have no money field at all, and no card ever sums
 * across periods, because there is one subscription per relationship and a total would be a
 * number nobody was charged.
 *
 * The four Gap-flag counts the desktop table carried survive as the compact `Y / O / P / R` row:
 * counts derived per render, `—` per column until a session is scored. Nothing on this card is a
 * counterparty's answer.
 */

/** The flag colour per column — the number is coloured, and the letter names it, never colour-only. */
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

/** The tabs speak the stages `content/stages.ts` derives; `all` is the unfiltered list. */
const STAGE_FILTERS: readonly {
  readonly value: "all" | RelationshipStage;
  readonly label: string;
}[] = [
  { value: "all", label: "All relationships" },
  { value: "invited", label: STAGE_LABELS.invited },
  { value: "connected", label: STAGE_LABELS.connected },
  { value: "sharing", label: STAGE_LABELS.sharing },
  { value: "aligned", label: STAGE_LABELS.aligned },
];

/** The party the viewer is NOT — the card's second line. */
function otherPartyLabel(persona: DashboardPersona, rel: V1Relationship): string {
  switch (persona) {
    case "initiator":
      return rel.counterpartyName ?? "No counterparty yet";
    case "counterparty":
      return rel.initiatorName;
    default:
      // A coach or an admin is neither party, so the line names both — read initiator first, with
      // an arrow, so the direction survives a name that is already a pair ("Ruth & Sam").
      return `${rel.initiatorName} → ${rel.counterpartyName ?? "Unclaimed"}`;
  }
}

/**
 * `lastSessionAt` as a relative label against the **fixture clock** (`DEMO_NOW_ISO`), never
 * `new Date()` at render. A fixture dated after that clock is not "in 1 day" — it prints the date
 * rather than a relative label that reads as a prediction.
 */
const FIXTURE_CLOCK_MS = Date.parse(DEMO_NOW_ISO);

function lastSessionLabel(iso: string | null): string {
  if (iso === null) return "No session yet";
  return Date.parse(iso) > FIXTURE_CLOCK_MS ? formatDate(iso) : formatRelative(iso);
}

/** One tile of the ancestor's stats grid: a label above a figure. */
function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-medium">{value}</p>
      {hint !== undefined && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * One relationship, in the ancestor's grid card. The cover block becomes a stage band (a
 * relationship has no thumbnail), and the metric row is the translation the card's spec asks for.
 * `canSeeMoney` is the Initiator only; every other persona renders no money element whatsoever.
 */
function RelationshipCard({
  rel,
  persona,
  templateTitle,
  now,
  onInvite,
}: {
  rel: V1Relationship;
  persona: DashboardPersona;
  templateTitle: string;
  now: number;
  onInvite: (id: string) => void;
}) {
  const stage = stageOfRelationship(rel);
  const metrics = cardMetricsOf(rel);
  const flags = gapFlagCountsOf(rel);
  const name = relationshipNameOf(rel, templateTitle);
  const canSeeMoney = moneyVisibleTo(persona);
  const canInvite = persona === "initiator" && rel.counterpartyName === null;
  const invite = inviteStateOf(rel, now);

  // Absent is `—`, never `0`: an unopened session has no completion rate and an unscored
  // relationship has no alignment figure. A scorable 0% would print 0%, and does.
  const sessions =
    metrics.openedSessions === 0
      ? "—"
      : `${metrics.completedSessions} of ${metrics.openedSessions}`;
  const completion = metrics.completionPercent === null ? "—" : `${metrics.completionPercent}%`;
  const alignment = metrics.averageAlignment === null ? "—" : metrics.averageAlignment.toFixed(1);

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600",
        stage === "invited" && "border-dashed",
      )}
    >
      {/* The ancestor's cover-and-overlay block, without the image: a relationship carries a
          stage and a type, not a thumbnail. */}
      <div className="flex flex-col gap-2 border-b border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="bg-card">
            {templateTitle || "Relationship"}
          </Badge>
          <StageBadge stage={stage} />
        </div>
        <Link
          href={`/v1/${persona}/relationships/${rel.id}`}
          className="line-clamp-2 text-lg font-semibold text-foreground hover:text-action hover:underline"
        >
          {name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {persona === "counterparty" ? "With" : "Counterparty"} · {otherPartyLabel(persona, rel)}
        </p>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Stats — the ancestor's four ideas, translated. */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <MetricTile
            label="Sessions"
            value={sessions}
            hint={metrics.openedSessions === 0 ? "none opened" : "completed of opened"}
          />
          <MetricTile label="Completion" value={completion} />
          <MetricTile label="Avg alignment" value={alignment} hint="mean Gap" />
          <MetricTile
            label="Aspects"
            value={String(metrics.aspectCount)}
            hint={metrics.aspectCount === 1 ? "aspect" : "aspects"}
          />
        </div>

        {/* The desktop table's four flag counts, kept as one compact row. */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Gap flags</span>
          <div className="flex items-center gap-3">
            {GAP_FLAG_COLUMNS.map((column) => {
              const value = flags[column];
              return (
                <span
                  key={column}
                  className={cn(
                    "font-semibold",
                    value === null ? "text-muted-foreground" : FLAG_TONE[column],
                  )}
                  title={`${GAP_FLAG_LABELS[column]} — Gaps at ${GAP_FLAG_COLUMNS.indexOf(column) + 1}`}
                >
                  {column.slice(0, 1).toUpperCase()} {value === null ? "—" : value}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-card text-xs">
            {MODE_LABELS[rel.mode]}
          </Badge>
          <Badge variant="outline" className="bg-card text-xs">
            {SETTING_LABELS[rel.setting]} setting
          </Badge>
        </div>

        {/* What was paid — the Initiator's card only. Plan and period, never a sum. */}
        {canSeeMoney && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Paid</p>
            {rel.subscription === null ? (
              <p className="font-medium text-muted-foreground">No plan yet</p>
            ) : (
              <p className="font-medium text-foreground">
                <span className="capitalize">{rel.subscription.plan}</span> · ends{" "}
                {formatDate(rel.subscription.periodEnd)}
                {rel.subscription.status !== "active" && (
                  <span className="ml-1 capitalize text-muted-foreground">
                    · {rel.subscription.status.replace("_", " ")}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {canInvite && (
          <div className="flex items-center gap-2">
            <InviteBadge state={invite} />
            <button
              type="button"
              onClick={() => onInvite(rel.id)}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Send className="h-3.5 w-3.5" />
              {rel.inviteToken === null ? "Invite" : "Re-invite"}
            </button>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-2 px-4 pb-4 pt-0">
        <span className="text-xs text-muted-foreground" title={rel.lastSessionAt ?? undefined}>
          Last session {lastSessionLabel(rel.lastSessionAt)}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/v1/${persona}/relationships/${rel.id}`} className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span>View</span>
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function RelationshipsList({ persona }: { persona: DashboardPersona }) {
  const { hydrated, relationships, templates, sendInvite } = useV1Store();
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
        <LoadingState rows={3} />
      </div>
    );
  }

  const visible = relationshipsVisibleTo(persona, relationships);
  const now = Date.now();

  const titleFor = (rel: V1Relationship) =>
    templates.find((template) => template.id === rel.templateId)?.title ?? "";

  // The same two filters the ancestor applies: the tab narrows by stage, the search narrows by the
  // name, the type and the other party — every word of it from the store, none of it authored here.
  const filtered = visible
    .filter((rel) => stageFilter === "all" || stageOfRelationship(rel) === stageFilter)
    .filter((rel) => {
      if (searchQuery === "") return true;
      const query = searchQuery.toLowerCase();
      return (
        relationshipNameOf(rel, titleFor(rel)).toLowerCase().includes(query) ||
        titleFor(rel).toLowerCase().includes(query) ||
        otherPartyLabel(persona, rel).toLowerCase().includes(query)
      );
    });

  const stageCount = (value: "all" | RelationshipStage) =>
    value === "all"
      ? visible.length
      : visible.filter((rel) => stageOfRelationship(rel) === value).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      {/* Title row, then the action — the ancestor's L122 stacking. Only the Initiator starts a
          relationship, so only their surface carries the CTA. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relationships</h1>
          <p className="text-muted-foreground mt-1">
            {visible.length} relationship{visible.length === 1 ? "" : "s"} you can see, counted from
            the store
          </p>
        </div>
        {persona === "initiator" && (
          <Button asChild>
            <Link href="/v1/initiator/templates" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Start a relationship</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Search row — the ancestor's L136 filter row, with the count in place of its selects. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your relationships..."
            className="pl-10"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {visible.length}
        </p>
      </div>

      {/* Tabs — the ancestor's L202 block, over the stages instead of the publication statuses. */}
      <Tabs value={stageFilter} onValueChange={setStageFilter}>
        <TabsList className="flex-wrap h-auto">
          {STAGE_FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label} ({stageCount(filter.value)})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No relationships found</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? `No relationships match your search "${searchQuery}". Try a different search term.`
              : "You don't have any relationships with the selected stage. Try a different tab."}
          </p>
          {persona === "initiator" && (
            <Button asChild>
              <Link href="/v1/initiator/templates" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Start a relationship</span>
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rel) => (
            <RelationshipCard
              key={rel.id}
              rel={rel}
              persona={persona}
              templateTitle={titleFor(rel)}
              now={now}
              onInvite={sendInvite}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Y / O / P / R — Gaps at 1 / 2 / 3 / 4 ({GAP_FLAG_LABELS.yellow} / {GAP_FLAG_LABELS.orange} /{" "}
        {GAP_FLAG_LABELS.pink} / {GAP_FLAG_LABELS.red}), counted from the completed report;
        &ldquo;—&rdquo; means no scored session yet. Average alignment is the mean Gap — lower is
        tighter.
      </p>
    </div>
  );
}
