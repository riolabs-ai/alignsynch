// template-ancestor: components/assessment-flow/instance-view.tsx
"use client";

import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDateTimeLong } from "@/content/core";
import {
  bothSubmittedOf,
  gapSummary,
  progressOf,
  relationshipNameOf,
  sessionCompleteOf,
  unlockedAtOf,
} from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, NotFoundState, StageBadge } from "@/components/v1/v1-ui";
import { CommentThread } from "@/components/v1/comment-thread";
import { ManageTab } from "@/components/v1/manage-tab";
import { SubscriptionStatus } from "@/components/v1/subscription-status";
import Link from "next/link";
import { useState } from "react";

type Tab = "sessions" | "manage";

/** The one screen every role opens a relationship from, with role-appropriate actions. */
export function RelationshipDetail({ relationshipId }: { relationshipId: string }) {
  const store = useV1Store();
  const { hydrated, persona, relationships, templates } = store;
  const [comment, setComment] = useState("");
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sessions");

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
  const progress = progressOf(rel);
  const complete = sessionCompleteOf(rel);
  const bothAnswered = bothSubmittedOf(rel);
  const unclaimed = rel.counterpartyName === null;

  const viewer =
    persona === "initiator" ? "initiator" : persona === "counterparty" ? "counterparty" : null;
  const isAdmin = persona === "admin";
  const isCoach = persona === "coach";
  const canSeeInitiator = complete || viewer === "initiator" || isAdmin;
  const canSeeCounterparty = complete || viewer === "counterparty" || isAdmin;

  const answerLink = `/v1/relationships/${rel.id}/answer`;
  const acceptLink = `/v1/relationships/${rel.id}/accept`;

  const authorName = (author: "initiator" | "counterparty") =>
    author === "initiator" ? rel.initiatorName : (rel.counterpartyName ?? "Counterparty");

  const opinionKinds =
    rel.mode === "advanced" ? ["feel", "wish", "think", "guess"] : ["feel", "wish"];

  const scoreCell = (
    answers: Record<string, { feel: number; wish: number; think?: number; guess?: number }>,
    itemId: string,
    kind: string,
  ) => {
    const entry = answers[itemId];
    if (entry === undefined) return "—";
    const value = entry[kind as "feel"];
    return value === undefined ? "—" : String(value);
  };

  const handleRequestNewSession = () => {
    const refusal = store.requestNewSession(rel.id);
    setSessionNotice(refusal ?? "A new session is open — both of you can answer again.");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
              {relationshipNameOf(rel, template?.title ?? "")}
            </h1>
            <StageBadge stage={summary.stage} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {rel.initiatorName}
            {rel.counterpartyName !== null
              ? ` and ${rel.counterpartyName}`
              : " · counterparty not claimed"}{" "}
            · {MODE_LABELS[rel.mode]} · {SETTING_LABELS[rel.setting]} setting
          </p>
        </div>
        <Link
          href="/v1/initiator"
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back
        </Link>
      </div>

      <SubscriptionStatus rel={rel} />

      <div className="flex gap-2 border-b border-border">
        {(
          [
            ["sessions", "Sessions"],
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

          {/* Progress and next action. */}
          {!unclaimed && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {complete
                      ? "Report unlocked"
                      : bothAnswered
                        ? "Both parties answered — review and accept"
                        : "Report locked until both parties accept"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Initiator answered {progress.initiatorAnswered}/{progress.aspectCount} ·
                    Counterparty {progress.counterpartyAnswered}/{progress.aspectCount}
                  </p>
                  {complete && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Accepted by {rel.initiatorName} at{" "}
                      {formatDateTimeLong(rel.initiatorAcceptedAt ?? "")} · by{" "}
                      {rel.counterpartyName} at{" "}
                      {formatDateTimeLong(rel.counterpartyAcceptedAt ?? "")} — report unlocked at{" "}
                      {formatDateTimeLong(unlockedAtOf(rel) ?? "")}.
                    </p>
                  )}
                </div>
                {viewer !== null && !complete && !bothAnswered && (
                  <Link
                    href={answerLink}
                    className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    {rel.mode === "advanced" ? "Answer all four" : "Answer Feel & Wish"}
                  </Link>
                )}
                {viewer !== null && !complete && bothAnswered && (
                  <Link
                    href={acceptLink}
                    className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    Review and accept this session
                  </Link>
                )}
                {complete && (
                  <Link
                    href={`/v1/relationships/${rel.id}/report`}
                    className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Read the report
                  </Link>
                )}
                {viewer !== null && complete && (
                  <button
                    type="button"
                    onClick={handleRequestNewSession}
                    className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    Request a new session
                  </button>
                )}
                {(viewer === "initiator" || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => store.toggleShareWithCoach(rel.id)}
                    className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {rel.sharedWithCoach ? "Unshare with coach" : "Share with coach"}
                  </button>
                )}
              </div>
              {sessionNotice !== null && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {sessionNotice}
                </p>
              )}
            </section>
          )}

          {/* The answers, respecting the blind rule until both accept. */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Answers</h2>
              <p className="text-xs text-muted-foreground">
                {complete
                  ? "Both sides are open."
                  : "Each party sees only their own answers until both accept."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Aspect</th>
                    {opinionKinds.map((kind) => (
                      <th key={kind} className="px-3 py-2 font-medium capitalize">
                        {rel.initiatorName} {kind}
                      </th>
                    ))}
                    {opinionKinds.map((kind) => (
                      <th key={`c-${kind}`} className="px-3 py-2 font-medium capitalize">
                        {rel.counterpartyName ?? "Counterparty"} {kind}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rel.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <p className="text-foreground">{item.prompt}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.leftValue} → {item.rightValue}
                        </p>
                      </td>
                      {opinionKinds.map((kind) => (
                        <td key={kind} className="px-3 py-2 text-center text-muted-foreground">
                          {canSeeInitiator ? scoreCell(rel.initiatorAnswers, item.id, kind) : "—"}
                        </td>
                      ))}
                      {opinionKinds.map((kind) => (
                        <td
                          key={`c-${kind}`}
                          className="px-3 py-2 text-center text-muted-foreground"
                        >
                          {canSeeCounterparty
                            ? scoreCell(rel.counterpartyAnswers, item.id, kind)
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
