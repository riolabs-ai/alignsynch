// template-ancestor: components/assessment-flow/instance-view.tsx
// The relationship page is a session timeline, not a record: header (parties, stage, last
// session, one action) → open session (blind) → one computed trend line → completed
// sessions newest-first. See components/v1/session-timeline.tsx.
"use client";

import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate, formatDateTimeLong } from "@/content/core";
import {
  bothSubmittedOf,
  gapSummary,
  relationshipNameOf,
  sessionCompleteOf,
  unlockedAtOf,
} from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
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
import { SubscriptionStatus } from "@/components/v1/subscription-status";
import {
  PrimaryActionButton,
  SessionTimeline,
  type PrimaryAction,
} from "@/components/v1/session-timeline";
import Link from "next/link";
import { useState } from "react";

type Tab = "timeline" | "manage";

/** The one screen every role opens a relationship from, now a timeline of sessions. */
export function RelationshipDetail({ relationshipId }: { relationshipId: string }) {
  const store = useV1Store();
  const { hydrated, persona, relationships, templates } = store;
  const [comment, setComment] = useState("");
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timeline");

  const rel = relationships.find((candidate) => candidate.id === relationshipId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (rel === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No relationship with id "${relationshipId}" exists in this prototype's store.`}
          back="/v1/initiator"
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

  const answerLink = `/v1/relationships/${rel.id}/answer`;
  const acceptLink = `/v1/relationships/${rel.id}/accept`;

  const authorName = (author: "initiator" | "counterparty") =>
    author === "initiator" ? rel.initiatorName : (rel.counterpartyName ?? "Counterparty");

  const handleRequestNewSession = () => {
    const refusal = store.requestNewSession(rel.id);
    setSessionNotice(refusal ?? "A new session is open — both of you can answer again.");
  };

  // The one primary action. An unclaimed relationship's action is the invitation / claim
  // card below — you cannot answer a session the other party has not joined yet. Once both
  // parties have answered, the action becomes acceptance; once accepted, it becomes the
  // next session (gated by the subscription's standing).
  const primaryAction: PrimaryAction | null =
    !unclaimed && viewer !== null
      ? complete
        ? { label: "Request a new session", onClick: handleRequestNewSession }
        : bothAnswered
          ? { label: "Review and accept this session", href: acceptLink }
          : {
              label: rel.mode === "advanced" ? "Answer all four" : "Answer Feel & Wish",
              href: answerLink,
            }
      : null;

  const lastSessionLabel = complete
    ? `Last session ${formatDate(rel.lastSessionAt ?? rel.createdAt)}`
    : unclaimed
      ? "No sessions yet"
      : "Session in progress";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="space-y-2">
        <BackLink href="/v1/initiator/relationships" label="Back to relationships" />
        <ContextLine
          crumbs={[
            { label: "Relationships", href: "/v1/initiator/relationships" },
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
            {lastSessionLabel}
          </p>
          {complete && (
            <p className="mt-1 text-xs text-muted-foreground">
              Accepted by {rel.initiatorName} at {formatDateTimeLong(rel.initiatorAcceptedAt ?? "")}{" "}
              · by {rel.counterpartyName} at {formatDateTimeLong(rel.counterpartyAcceptedAt ?? "")}{" "}
              — report unlocked at {formatDateTimeLong(unlockedAtOf(rel) ?? "")}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {primaryAction !== null && <PrimaryActionButton action={primaryAction} />}
          <Link
            href="/v1/initiator"
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back
          </Link>
        </div>
      </div>

      <SubscriptionStatus rel={rel} />

      {sessionNotice !== null && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {sessionNotice}
        </p>
      )}

      <div className="flex gap-2 border-b border-border">
        {(
          [
            ["timeline", "Timeline"],
            ["manage", "Manage"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "-mb-px inline-flex h-11 items-center border-b-2 border-action px-4 text-sm font-medium text-foreground"
                : "-mb-px inline-flex h-11 items-center border-b-2 border-transparent px-4 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "manage" ? (
        <ManageTab rel={rel} template={template} />
      ) : (
        <>
          {/* The invitation card — initiator's view of an unclaimed relationship. */}
          {unclaimed && viewer === "initiator" && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Invitation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {rel.inviteToken === null
                  ? "No invite has been sent yet."
                  : `The current invite is live: alignsynch.com/v1/claim/${rel.inviteToken}`}
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
                  Re-inviting rotates the token — the old link dies, the new one appears.
                </p>
              )}
            </section>
          )}

          {/* The claim card — counterparty's view of a claimable invitation. */}
          {unclaimed && viewer === "counterparty" && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Claimable invitation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {rel.initiatorName} invited you to answer {template?.title ?? "this template"}.
                Claim it to join, then answer the same Aspects from your side.
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

          <SessionTimeline rel={rel} viewer={viewer} primaryAction={primaryAction} />

          {/* Comments — the relationship thread and one per Aspect, only after the session is
              complete. A coach reads them read-only; an admin reads them read-only too. */}
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
