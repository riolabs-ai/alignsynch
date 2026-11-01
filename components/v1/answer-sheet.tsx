// template-ancestor: components/assessment-flow/answer-form.tsx   (variation: four opinions per aspect in two passes, no correctness feedback)
"use client";

import type { OpinionKind, Opinions } from "@/content/assessment";
import { useV1Store } from "@/lib/v1/store";
import { gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import {
  BackLink,
  ContextLine,
  LoadingState,
  NotFoundState,
  SectionIntro,
  StageBadge,
} from "@/components/v1/v1-ui";
import Link from "next/link";
import { useState } from "react";

const SCORES = [1, 2, 3, 4, 5] as const;

type Draft = Record<string, Partial<Record<OpinionKind, number>>>;

/** The answer sheet — one party answers every Aspect, Feel and Wish (or all four). */
export function AnswerSheet({ relationshipId }: { relationshipId: string }) {
  const { hydrated, persona, relationships, templates, submitAnswers } = useV1Store();
  const [draft, setDraft] = useState<Draft>({});
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

  const role =
    persona === "initiator" ? "initiator" : persona === "counterparty" ? "counterparty" : null;
  const template = templates.find((t) => t.id === rel.templateId);
  const summary = gapSummary(rel);
  const name = relationshipNameOf(rel, template?.title ?? "");

  if (role === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <SectionIntro title="Answer the sheet" subtitle="Only a party can answer." />
        <p className="text-sm text-muted-foreground">
          Switch to the Initiator or Counterparty persona to answer{" "}
          {template?.title ?? "this relationship"}.
        </p>
      </div>
    );
  }

  const existing = role === "initiator" ? rel.initiatorAnswers : rel.counterpartyAnswers;
  const kinds: OpinionKind[] =
    rel.mode === "advanced" ? ["feel", "wish", "think", "guess"] : ["feel", "wish"];

  const seed = (itemId: string, kind: OpinionKind): number => {
    const explicit = draft[itemId]?.[kind];
    if (explicit !== undefined) return explicit;
    const prior = existing[itemId]?.[kind];
    return prior ?? 0;
  };

  const choose = (itemId: string, kind: OpinionKind, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [kind]: value },
    }));
  };

  const onSubmit = () => {
    const next: Record<string, Opinions> = {};
    for (const item of rel.items) {
      const values: Record<string, number> = {};
      for (const kind of kinds) {
        const value = seed(item.id, kind);
        if (value < 1 || value > 5) {
          setProblem(
            `Answer every ${rel.mode === "advanced" ? "of the four opinions" : "Feel and Wish"} on every Aspect before submitting.`,
          );
          return;
        }
        values[kind] = value;
      }
      next[item.id] =
        rel.mode === "advanced"
          ? { feel: values.feel, wish: values.wish, think: values.think, guess: values.guess }
          : { feel: values.feel, wish: values.wish };
    }
    setProblem(null);
    submitAnswers(rel.id, role, next);
    window.location.assign(`/v1/relationships/${rel.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="space-y-2">
        <BackLink href={`/v1/relationships/${rel.id}`} label="Back to the relationship" />
        <ContextLine
          crumbs={[
            { label: "Relationships", href: "/v1/initiator/relationships" },
            { label: name, href: `/v1/relationships/${rel.id}` },
            { label: "Answer sheet" },
          ]}
        />
      </div>

      <div className="flex items-center gap-2">
        <SectionIntro
          title={template?.title ?? "Answer the sheet"}
          subtitle={`Answering as ${role} — ${rel.mode === "advanced" ? "Feel, Wish, Think and Guess" : "Feel and Wish"} on every Aspect.`}
        />
        <StageBadge stage={summary.stage} />
      </div>

      <div className="space-y-4">
        {rel.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">{item.prompt}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.leftValue} (1) → {item.rightValue} (5)
            </p>
            <div className="mt-3 space-y-3">
              {kinds.map((kind) => (
                <div key={kind}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {kind}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {SCORES.map((score) => {
                      const selected = seed(item.id, kind) === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => choose(item.id, kind, score)}
                          className={
                            selected
                              ? "flex h-11 items-center justify-center rounded-md bg-action text-sm font-semibold text-action-foreground"
                              : "flex h-11 items-center justify-center rounded-md border border-border bg-card text-sm text-foreground hover:bg-muted"
                          }
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {problem !== null && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {problem}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href={`/v1/relationships/${rel.id}`}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
        >
          Submit answers
        </button>
      </div>
    </div>
  );
}
