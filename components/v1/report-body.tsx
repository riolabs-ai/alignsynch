// template-ancestor: components/assessment/assessment-report.tsx
"use client";

import { GAP_KIND_LABELS, gapKindsIn, groupsIn } from "@/content/gaps";
import { OPINION_LABELS, SETTING_LABELS, opinionKindsFor } from "@/content/assessment";
import type { Gap } from "@/content/record";
import { aspectGapsOf, gapSummary, progressOf, relationshipNameOf } from "@/lib/v1/derive";
import type { V1Relationship } from "@/data/v1/fixtures";
import { Reveal } from "@/components/v1/reveal";
import { GapPill, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/**
 * The report's body — the one renderer a completed session's report and a template demo share.
 *
 * It is pure presentation over one `V1Relationship`: it reads no store, so the live report
 * (`ReportView`) and the public demo (`/v1/templates/[type]/demo`) both pass it a relationship
 * and get the identical layout — the header with the stage, the Setting's verdict, and one card
 * per Aspect with its eight gap kinds grouped under the glossary's headings. The demo is the
 * proof of the value; this shared body is what keeps the demo from being a marketing mock.
 */
export function ReportBody({ rel, templateTitle }: { rel: V1Relationship; templateTitle: string }) {
  const summary = gapSummary(rel);
  const progress = progressOf(rel);
  const opinionKinds = opinionKindsFor(rel.mode);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro
          title={`Report — ${relationshipNameOf(rel, templateTitle)}`}
          subtitle={`${MODE_WORD[rel.mode]} · ${SETTING_LABELS[rel.setting]} setting`}
        />
        <StageBadge stage={summary.stage} />
      </div>

      {summary.verdict === null ? (
        <section className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Report locked</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The report unlocks only when both parties accept — not when the second one submits. The
            Initiator has answered {progress.initiatorAnswered}/{progress.aspectCount} and the
            Counterparty {progress.counterpartyAnswered}/{progress.aspectCount} Aspect
            {progress.aspectCount === 1 ? "" : "s"} — until both accept, each side&apos;s answers
            stay blind.
          </p>
          <Link
            href={`/v1/relationships/${rel.id}`}
            className="mt-4 inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to the relationship
          </Link>
        </section>
      ) : (
        <>
          <section
            className={
              summary.verdict.aligned
                ? "rounded-lg border border-green-200 bg-green-50 p-4"
                : "rounded-lg border border-amber-200 bg-amber-50 p-4"
            }
          >
            <p className="text-sm font-semibold text-foreground">
              {summary.verdict.aligned ? "Aligned" : "Not yet aligned"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.totalGaps} Gap{summary.totalGaps === 1 ? "" : "s"} measured across{" "}
              {rel.items.length} Aspect{rel.items.length === 1 ? "" : "s"} —{" "}
              {summary.unmetGaps === 0
                ? "every one meets the Setting"
                : `${summary.unmetGaps} exceed the Setting (${summary.verdict.limit === 0 ? "no Gap tolerated" : "only a Gap of 1 tolerated"}).`}
            </p>
          </section>

          <div className="space-y-2">
            {rel.items.map((item) => {
              const gaps = aspectGapsOf(rel, item.id);
              const kinds = gapKindsIn(gaps);
              const groups = groupsIn(gaps);
              const widestGap: Gap | null =
                kinds.length === 0
                  ? null
                  : (Math.max(...kinds.map((kind) => gaps[kind] ?? 0)) as Gap);

              return (
                <div key={item.id} className="rounded-lg border border-border bg-card px-4">
                  <Reveal
                    variant="expand"
                    summary={
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {item.prompt}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.leftValue} (1) → {item.rightValue} (5)
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Widest gap</span>
                          {widestGap === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <GapPill gap={widestGap} />
                          )}
                        </span>
                      </span>
                    }
                    detail={
                      <div className="space-y-3 pb-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            { party: rel.initiatorName, answers: rel.initiatorAnswers },
                            {
                              party: rel.counterpartyName ?? "Counterparty",
                              answers: rel.counterpartyAnswers,
                            },
                          ].map((party) => (
                            <div
                              key={party.party}
                              className="rounded-md border border-border bg-muted/30 px-3 py-2"
                            >
                              <p className="text-xs font-semibold text-muted-foreground">
                                {party.party}
                              </p>
                              <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
                                {opinionKinds.map((kind) => (
                                  <div key={kind}>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                      {OPINION_LABELS[kind]}
                                    </p>
                                    <p className="text-sm font-medium text-foreground">
                                      {party.answers[item.id]?.[kind] ?? "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3">
                          {groups.map((group) => (
                            <div key={group.id}>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {group.heading}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {group.kinds.map((kind) => {
                                  const gap = gaps[kind];
                                  if (gap === undefined) return null;
                                  const unmet = summary.verdict?.unmet.some(
                                    (u) => u.itemId === item.id && u.kind === kind,
                                  );
                                  return (
                                    <span
                                      key={kind}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1"
                                    >
                                      <span className="text-xs text-muted-foreground">
                                        {GAP_KIND_LABELS[kind]}
                                      </span>
                                      <GapPill gap={gap} />
                                      {unmet && (
                                        <span className="text-[10px] font-semibold uppercase text-amber-600">
                                          unmet
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    }
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const MODE_WORD = { basic: "Basic Mode", advanced: "Advanced Mode" } as const;
