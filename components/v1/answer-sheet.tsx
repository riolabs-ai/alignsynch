// template-ancestor: components/assessment-flow/answer-form.tsx   (variation: four opinions per aspect in two passes, no correctness feedback)
"use client";

import {
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  opinionKindsFor,
  type OpinionKind,
  type Opinions,
} from "@/content/assessment";
import { useV1Store } from "@/lib/v1/store";
import { gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { answerGateFor, answerGateMessage } from "@/lib/v1/blind";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BackLink,
  ContextLine,
  LoadingState,
  NotFoundState,
  SectionIntro,
  StageBadge,
} from "@/components/v1/v1-ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SCORES = [1, 2, 3, 4, 5] as const;

/** The opinion-kind names, capitalised the way the subtitle and the report spell them. */
const KIND_LABEL: Record<OpinionKind, string> = {
  feel: "Feel",
  wish: "Wish",
  think: "Think",
  guess: "Guess",
};

type Draft = Record<string, Partial<Record<OpinionKind, number>>>;

/** One unanswered (Aspect, kind) — the unit an inline error names and the summary counts. */
interface MissingField {
  readonly itemId: string;
  readonly kind: OpinionKind;
}

/**
 * The answer sheet — one party answers every Aspect, Feel and Wish (or all four in Advanced Mode).
 *
 * The kinds asked are `opinionKindsFor(rel.mode)`, the model's own list, so the sheet cannot ask
 * a shape the Mode does not define. A **Setting changes no question**: it is a tolerance over the
 * Gaps (`content/assessment.ts::SETTING_GAP_LIMITS`), so a Soft sheet and a Full sheet of the
 * same Mode ask exactly the same thing. The Setting is printed — word and glossary definition —
 * because it is the bar these answers will be judged against, and the report is where it moves
 * the verdict. A field that changed the questions per Setting would be a schema change, not a
 * sheet change.
 *
 * Validation is unchanged: a kind is unanswered when its score is outside 1..5 (the draft or the
 * prior answer resolves to `0`). What changed is how the failure is shown — instead of one banner
 * under the form, every unanswered control group marks itself with an inline sentence, and one
 * summary sits above the first field naming the count and linking to each unanswered Aspect. The
 * summary carries `role="alert"` and takes focus on a failed submit, so a screen reader is told
 * what is missing and a keyboard can navigate straight to it.
 *
 * The submit bar is `fixed` to the viewport bottom below `sm` (576px), not `sticky`: the app
 * shell's `main` carries `overflow: auto` while the *body* scrolls, which makes an in-`main`
 * `position: sticky` never stick. `fixed` is the same pinned-bottom result, so the form carries
 * bottom padding equal to the bar height and the bar pays `env(safe-area-inset-bottom)` on the
 * home-indicator edge. Above `sm` it is static, in the form footer as before.
 */
export function AnswerSheet({ relationshipId }: { relationshipId: string }) {
  const { hydrated, persona, relationships, templates, submitAnswers } = useV1Store();
  const [draft, setDraft] = useState<Draft>({});
  const [attempted, setAttempted] = useState(false);
  const [submitNonce, setSubmitNonce] = useState(0);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // Focus the summary once it is in the DOM after a failed submit. A nonce (not a boolean) so a
  // second failed submit re-focuses it too, after the alert is committed.
  useEffect(() => {
    if (submitNonce === 0) return;
    summaryRef.current?.focus();
  }, [submitNonce]);

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

  // The same gate the server page applies from the cookie, re-read from the live store: a party
  // who already submitted has no form to open until the next session.
  const gate = answerGateFor(rel, persona);
  if (gate !== null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <SectionIntro title="Answer the sheet" subtitle="Already submitted." />
        <p className="text-sm text-muted-foreground">{answerGateMessage(gate, rel)}</p>
        <Link
          href={`/v1/relationships/${rel.id}`}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back to the relationship
        </Link>
      </div>
    );
  }

  const existing = role === "initiator" ? rel.initiatorAnswers : rel.counterpartyAnswers;
  const kinds: readonly OpinionKind[] = opinionKindsFor(rel.mode);

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

  // The same rule the submit payload enforces, enumerated once: an unanswered kind is a score
  // outside 1..5. The summary, the inline errors and the submit guard all read this one list, so
  // the message can never name a field the payload would accept.
  const missing: MissingField[] = [];
  for (const item of rel.items) {
    for (const kind of kinds) {
      const value = seed(item.id, kind);
      if (value < 1 || value > 5) missing.push({ itemId: item.id, kind });
    }
  }
  const unansweredAspects = rel.items.filter((item) =>
    missing.some((entry) => entry.itemId === item.id),
  );
  const showErrors = attempted && missing.length > 0;
  // Inline errors and the summary appear only after a submit attempt, but the list is computed
  // from the live draft, so an answer the person gives clears its own error immediately.
  const visibleMissing = attempted ? missing : [];

  const onSubmit = () => {
    if (missing.length > 0) {
      setAttempted(true);
      setSubmitNonce((nonce) => nonce + 1);
      return;
    }
    const next: Record<string, Opinions> = {};
    for (const item of rel.items) {
      const values: Record<string, number> = {};
      for (const kind of kinds) {
        values[kind] = seed(item.id, kind);
      }
      next[item.id] =
        rel.mode === "advanced"
          ? { feel: values.feel, wish: values.wish, think: values.think, guess: values.guess }
          : { feel: values.feel, wish: values.wish };
    }
    setAttempted(false);
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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SectionIntro
            title={template?.title ?? "Answer the sheet"}
            subtitle={`Answering as ${role} — ${rel.mode === "advanced" ? "Feel, Wish, Think and Guess" : "Feel and Wish"} on every Aspect.`}
          />
          <StageBadge stage={summary.stage} />
        </div>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {SETTING_LABELS[rel.setting]} setting — {SETTING_DEFINITIONS[rel.setting]}
        </p>
      </div>

      {showErrors && (
        <Alert
          variant="destructive"
          ref={summaryRef}
          tabIndex={-1}
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <AlertTitle>
            {missing.length} {missing.length === 1 ? "answer" : "answers"} still needed
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {unansweredAspects.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#answer-${item.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {item.prompt}
                  </a>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 pb-[calc(4.25rem_+_env(safe-area-inset-bottom))] sm:pb-0">
        {rel.items.map((item) => {
          const itemMissing = new Set(
            visibleMissing.filter((entry) => entry.itemId === item.id).map((entry) => entry.kind),
          );
          return (
            <div
              key={item.id}
              id={`answer-${item.id}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-sm font-medium text-foreground">{item.prompt}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.leftValue} (1) → {item.rightValue} (5)
              </p>
              <div className="mt-3 space-y-3">
                {kinds.map((kind) => {
                  const isMissing = itemMissing.has(kind);
                  const errorId = `${item.id}-${kind}-error`;
                  return (
                    <fieldset
                      key={kind}
                      aria-invalid={isMissing ? true : undefined}
                      aria-describedby={isMissing ? errorId : undefined}
                      className="m-0 min-w-0 border-0 p-0"
                    >
                      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {KIND_LABEL[kind]}
                      </legend>
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
                      {isMissing && (
                        <p id={errorId} className="mt-1 text-sm font-medium text-red-600">
                          {KIND_LABEL[kind]} needs an answer
                        </p>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-end gap-2 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0">
        <Button asChild variant="outline" size="lg">
          <Link href={`/v1/relationships/${rel.id}`}>Cancel</Link>
        </Button>
        <Button type="button" size="lg" onClick={onSubmit}>
          Submit answers
        </Button>
      </div>
    </div>
  );
}
