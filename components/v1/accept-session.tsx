// template-ancestor: components/assessment-flow/instance-view.tsx   (variation: both parties accept before the blind rule lifts)
"use client";

import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import { gapSummary, relationshipNameOf, sessionCompleteOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { LoadingState, NotFoundState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";
import { useState } from "react";

/**
 * The acceptance step — after both parties have answered, each reviews what they are accepting
 * and records their acceptance. The summary shows no values: neither side's answers are visible
 * until both accept, so this screen names the Aspects, the Mode and the Setting, and nothing else.
 */
export function AcceptSession({ relationshipId }: { relationshipId: string }) {
  const { hydrated, persona, relationships, templates, acceptSession } = useV1Store();
  const [problem, setProblem] = useState<string | null>(null);

  const rel = relationships.find((candidate) => candidate.id === relationshipId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (rel === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <NotFoundState
          message={`No relationship with id "${relationshipId}" exists.`}
          back="/v1/initiator"
        />
      </div>
    );
  }

  const template = templates.find((t) => t.id === rel.templateId);
  const summary = gapSummary(rel);
  const viewer =
    persona === "initiator" ? "initiator" : persona === "counterparty" ? "counterparty" : null;

  if (viewer === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <SectionIntro title="Review and accept this session" subtitle="Only a party can accept." />
        <p className="text-sm text-muted-foreground">
          Switch to the Initiator or Counterparty persona to accept{" "}
          {template?.title ?? "this relationship"}.
        </p>
      </div>
    );
  }

  const alreadyAccepted = viewer === "initiator" ? rel.initiatorAccepted : rel.counterpartyAccepted;
  const otherAccepted = viewer === "initiator" ? rel.counterpartyAccepted : rel.initiatorAccepted;
  const otherName = viewer === "initiator" ? rel.counterpartyName : rel.initiatorName;

  const onAccept = () => {
    if (sessionCompleteOf(rel)) {
      setProblem("This session is already complete — both of you accepted.");
      return;
    }
    acceptSession(rel.id, viewer);
    window.location.assign(`/v1/relationships/${rel.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro
          title="Review and accept this session"
          subtitle={`${relationshipNameOf(rel, template?.title ?? "")} · ${MODE_LABELS[rel.mode]} · ${SETTING_LABELS[rel.setting]} setting`}
        />
        <StageBadge stage={summary.stage} />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">What you are accepting</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rel.items.length} Aspect{rel.items.length === 1 ? "" : "s"}, answered from both sides.
          The values stay hidden until both of you accept — accepting is what lifts the blind rule.
        </p>
        <ul className="mt-3 space-y-2">
          {rel.items.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="text-sm text-foreground">{item.prompt}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.leftValue} (1) → {item.rightValue} (5)
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Acceptance</p>
        <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>{rel.initiatorName}</dt>
            <dd className={rel.initiatorAccepted ? "text-green-700" : ""}>
              {rel.initiatorAccepted
                ? `accepted ${formatDate(rel.initiatorAcceptedAt ?? "")}`
                : "not accepted yet"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{rel.counterpartyName ?? "Counterparty"}</dt>
            <dd className={rel.counterpartyAccepted ? "text-green-700" : ""}>
              {rel.counterpartyAccepted
                ? `accepted ${formatDate(rel.counterpartyAcceptedAt ?? "")}`
                : "not accepted yet"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {otherAccepted
            ? `${otherName ?? "The other party"} has accepted — once you accept, the session is complete and the report unlocks.`
            : `You are accepting before ${otherName ?? "the other party"} — nothing is visible until both of you accept.`}
        </p>
      </section>

      {problem !== null && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {problem}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href={`/v1/relationships/${rel.id}`}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={onAccept}
          disabled={alreadyAccepted}
          className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90 disabled:opacity-50"
        >
          {alreadyAccepted ? "You accepted — awaiting the other party" : "Accept this session"}
        </button>
      </div>
    </div>
  );
}
