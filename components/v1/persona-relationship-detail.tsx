"use client";

// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: a relationship's detail — header, per-stage action, session timeline, Aspects editor, clone/save, comments)
// template-ancestors: components/v1/session-timeline.tsx (the timeline), components/v1/manage-tab.tsx (the manage view)

import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate, formatDateTimeLong } from "@/content/core";
import type { V1Relationship } from "@/data/v1/fixtures";
import {
  bothSubmittedOf,
  gapSummary,
  inviteStateOf,
  relationshipNameOf,
  sessionCompleteOf,
  unlockedAtOf,
} from "@/lib/v1/derive";
import { relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import {
  BackLink,
  ContextLine,
  EmptyState,
  LoadingState,
  NotFoundState,
  StageBadge,
} from "@/components/v1/v1-ui";
import { CommentThread } from "@/components/v1/comment-thread";
import { ManageTab } from "@/components/v1/manage-tab";
import { RelationshipAspectsEditor } from "@/components/v1/relationship-aspects-editor";
import { SubscriptionStatus } from "@/components/v1/subscription-status";
import {
  PrimaryActionButton,
  SessionTimeline,
  type PrimaryAction,
} from "@/components/v1/session-timeline";
import { useState } from "react";

type Tab = "timeline" | "aspects" | "manage";

const INVITE_STATE_WORD: Record<string, string> = {
  "not-sent": "Not sent",
  pending: "Pending",
  expired: "Expired",
  accepted: "Accepted",
};

/**
 * `N of M sessions`, straight from the store's two counters — the same wording the list uses,
 * so the header and the row cannot disagree.
 */
function sessionCountLabel(rel: V1Relationship): string {
  return rel.openedSessions === 0
    ? "No sessions yet"
    : `${rel.completedSessions} of ${rel.openedSessions} sessions`;
}

/**
 * `/v1/[persona]/relationships/[id]` — one relationship, seen by one persona.
 *
 * It varies `quiz-details.tsx` on the axis that matters here: the header names the two parties
 * and the stage, the primary action is derived **per stage** (answer → accept → next session),
 * and the tabs add an Aspects editor the initiator alone can touch. The blind rule is structural:
 * a coach and an admin render no answer or accept action, the Aspects editor is initiator-only,
 * the subscription card is initiator-only, and the comment threads open only after both parties
 * accept — so there is no path from one party's view to the other's answers.
 */
export function PersonaRelationshipDetail({
  persona,
  relationshipId,
}: {
  persona: DashboardPersona;
  relationshipId: string;
}) {
  const store = useV1Store();
  const { hydrated, relationships, templates } = store;
  const [comment, setComment] = useState("");
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timeline");
  const [cloneNotice, setCloneNotice] = useState<string | null>(null);

  const rel = relationships.find((candidate) => candidate.id === relationshipId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  // A persona who cannot see this relationship gets the same not-found a wrong id does —
  // visibility is the gate, not the renderer's discipline.
  const visible = relationshipsVisibleTo(persona, relationships);
  if (rel === undefined || !visible.some((candidate) => candidate.id === rel.id)) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No relationship with id "${relationshipId}" is visible to this persona.`}
          back={`/v1/${persona}/relationships`}
        />
      </div>
    );
  }

  const template = templates.find((t) => t.id === rel.templateId);
  const summary = gapSummary(rel);
  const name = relationshipNameOf(rel, template?.title ?? "");
  const complete = sessionCompleteOf(rel);
  const bothAnswered = bothSubmittedOf(rel);
  const unclaimed = rel.counterpartyName === null;

  const viewer =
    persona === "initiator" ? "initiator" : persona === "counterparty" ? "counterparty" : null;
  const isCoach = persona === "coach";
  const isInitiator = persona === "initiator";
  // A party who has already submitted has nothing to answer until a new session opens — the
  // same rule the answer sheet enforces, read here so the primary action cannot lead to a gate.
  const viewerSubmitted =
    viewer === "initiator"
      ? rel.initiatorSubmitted
      : viewer === "counterparty" && rel.counterpartySubmitted;

  const answerLink = `/v1/relationships/${rel.id}/answer`;
  const acceptLink = `/v1/relationships/${rel.id}/accept`;
  const reportLink = `/v1/relationships/${rel.id}/report`;

  const authorName = (author: "initiator" | "counterparty") =>
    author === "initiator" ? rel.initiatorName : (rel.counterpartyName ?? "Counterparty");

  const handleRequestNewSession = () => {
    const refusal = store.requestNewSession(rel.id);
    setSessionNotice(refusal ?? "A new session is open — both of you can answer again.");
  };

  const handleClone = () => {
    const clone = store.cloneRelationship(rel.id);
    setCloneNotice(
      `Cloned as “${relationshipNameOf(clone, template?.title ?? "")}” — same Aspects, no answers. No invite has been sent: open it and press Send invite when you are ready.`,
    );
  };

  const handleSaveToLibrary = () => {
    const entry = store.saveAspectSetToLibrary(rel.id);
    setCloneNotice(`Saved “${entry.title}” to the library — it is now a reusable set.`);
  };

  // The one primary action, derived per stage and persona.
  const primaryAction: PrimaryAction | null =
    viewer === null
      ? null
      : unclaimed
        ? null // the invite / claim section below owns this stage
        : complete
          ? viewer === "initiator"
            ? { label: "Request a new session", onClick: handleRequestNewSession }
            : { label: "View report", href: reportLink }
          : bothAnswered
            ? { label: "Review and accept this session", href: acceptLink }
            : viewerSubmitted
              ? null // waiting on the other party — the timeline says so, there is no form
              : {
                  label: rel.mode === "advanced" ? "Answer all four" : "Answer Feel & Wish",
                  href: answerLink,
                };

  const inviteState = inviteStateOf(rel, Date.now());
  const lastSessionLabel = complete
    ? `Last session ${formatDate(rel.lastSessionAt ?? rel.createdAt)}`
    : unclaimed
      ? "No sessions yet"
      : "Session in progress";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="space-y-2">
        <BackLink href={`/v1/${persona}/relationships`} label="Back to relationships" />
        <ContextLine
          crumbs={[
            { label: "Relationships", href: `/v1/${persona}/relationships` },
            { label: name },
          ]}
        />
      </div>

      {/* Header — parties, stage, last session, and the one primary action. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{name}</h1>
            <StageBadge stage={summary.stage} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {rel.initiatorName}
            {rel.counterpartyName !== null
              ? ` and ${rel.counterpartyName}`
              : " · counterparty not claimed"}{" "}
            · {MODE_LABELS[rel.mode]} · {SETTING_LABELS[rel.setting]} setting
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-last-session>
            {lastSessionLabel} · {sessionCountLabel(rel)}
          </p>
          {complete && (
            <p className="mt-1 text-xs text-muted-foreground">
              Accepted by {rel.initiatorName} at {formatDateTimeLong(rel.initiatorAcceptedAt ?? "")}{" "}
              · by {rel.counterpartyName} at {formatDateTimeLong(rel.counterpartyAcceptedAt ?? "")}{" "}
              — report unlocked at {formatDateTimeLong(unlockedAtOf(rel) ?? "")}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primaryAction !== null && <PrimaryActionButton action={primaryAction} />}
          {isInitiator && (
            <>
              <button
                type="button"
                onClick={handleClone}
                className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Clone
              </button>
              <button
                type="button"
                onClick={handleSaveToLibrary}
                className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Save to library
              </button>
            </>
          )}
        </div>
      </div>

      {cloneNotice !== null && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {cloneNotice}
        </p>
      )}

      {isInitiator && <SubscriptionStatus rel={rel} />}

      {sessionNotice !== null && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {sessionNotice}
        </p>
      )}

      {/* The invitation / claim card — the unclaimed stage's own action, per role. */}
      {unclaimed && isInitiator && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Invitation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rel.inviteToken === null ? (
              "No invite has been sent yet."
            ) : (
              <>
                The current invite is{" "}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    inviteState === "expired"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : inviteState === "pending"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-100 text-slate-700 border-slate-200",
                  )}
                >
                  {INVITE_STATE_WORD[inviteState]}
                </span>
                {rel.inviteExpiresAt !== null &&
                  ` — alignsynch.com/v1/claim/${rel.inviteToken}${inviteState === "expired" ? " (lapsed)" : ""}`}
              </>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => store.sendInvite(rel.id)}
              className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
            >
              {rel.inviteToken === null ? "Send invite" : "Re-invite"}
            </button>
            <button
              type="button"
              onClick={() => store.toggleShareWithCoach(rel.id)}
              className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              {rel.sharedWithCoach ? "Unshare with coach" : "Share with coach"}
            </button>
          </div>
          {rel.inviteToken !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Re-inviting rotates the token and resets the expiry — the old link dies.
            </p>
          )}
        </section>
      )}

      {unclaimed && viewer === "counterparty" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Claimable invitation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rel.initiatorName} invited you to answer {template?.title ?? "this template"}. Claim it
            to join, then answer the same Aspects from your side.
          </p>
          <div className="mt-3 flex gap-2">
            {rel.inviteToken === null ? (
              <p className="text-sm text-muted-foreground">No invite link is live yet.</p>
            ) : (
              <button
                type="button"
                onClick={() => store.claimInvite(rel.id)}
                className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
              >
                Claim invitation
              </button>
            )}
          </div>
        </section>
      )}

      {/* Tabs — the timeline, the initiator-only Aspects editor, and the manage view. */}
      <div className="flex gap-2 border-b border-border">
        {(
          [
            ["timeline", "Timeline"],
            ["aspects", "Aspects"],
            ["manage", "Manage"],
          ] as const
        )
          .filter(([value]) => value !== "aspects" || isInitiator)
          .map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "-mb-px inline-flex h-11 items-center border-b-2 px-4 text-sm font-medium",
                tab === value
                  ? "border-action text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
      </div>

      {tab === "aspects" && isInitiator ? (
        <RelationshipAspectsEditor rel={rel} />
      ) : tab === "manage" ? (
        <ManageTab rel={rel} template={template} />
      ) : (
        <>
          <SessionTimeline rel={rel} viewer={viewer} primaryAction={primaryAction} />

          {/* Comments — the relationship thread and one per Aspect, open only after scoring. */}
          {complete && (
            <div className="space-y-4">
              <CommentThread
                heading="Relationship"
                comments={rel.comments}
                authorName={authorName}
                canComment={viewer !== null}
                placeholder="Comment on this relationship…"
                onAdd={(body) => store.addComment(rel.id, viewer ?? "initiator", body)}
              />
              {rel.items.map((item) => (
                <CommentThread
                  key={item.id}
                  heading={item.prompt}
                  comments={rel.aspectComments[item.id] ?? []}
                  authorName={authorName}
                  canComment={viewer !== null}
                  placeholder={`Comment on "${item.prompt}"…`}
                  onAdd={(body) =>
                    store.addAspectComment(rel.id, item.id, viewer ?? "initiator", body)
                  }
                />
              ))}
            </div>
          )}

          {/* The advice thread — the coach's read-only surface. */}
          {(isCoach || rel.sharedWithCoach) && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Advice thread</h2>
              {rel.coachComments.length === 0 ? (
                <EmptyState
                  title="No advice yet"
                  body="The coach has not commented on this relationship."
                />
              ) : (
                <ul className="mt-2 space-y-2">
                  {rel.coachComments.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-md border border-border bg-muted/40 px-3 py-2"
                    >
                      <p className="text-xs font-medium text-foreground">Coach</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{entry.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {isCoach && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Leave advice (read-only — you cannot score or answer)"
                    className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (comment.trim() === "") return;
                      store.addCoachComment(rel.id, comment.trim());
                      setComment("");
                    }}
                    className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    Comment
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
