// template-ancestor: components/assessment/assessment-report.tsx
"use client";

import {
  OPINION_DEFINITIONS,
  OPINION_LABELS,
  SETTING_LABELS,
  opinionKindsFor,
  type OpinionKind,
  type Opinions,
} from "@/content/assessment";
import {
  GAP_KIND_LABELS,
  GAP_KIND_SOURCES,
  GAP_KINDS,
  groupsIn,
  type GapKind,
  type GapSourceSide,
} from "@/content/gaps";
import { STAGE_DEFINITIONS } from "@/content/stages";
import type { V1Relationship } from "@/data/v1/fixtures";
import { aspectGapsOf, gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import { LoadingState, NotFoundState, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/** The eight pairs by kind, so a group's kinds resolve to their two sides in one lookup. */
const SOURCE_BY_KIND = new Map<GapKind, GapSourceSide[]>(
  GAP_KIND_SOURCES.map((source) => [source.kind, [source.left, source.right]]),
);

/** One side of a Gap: who gave it, which opinion it is, and the score they gave. */
interface GapSideView {
  readonly name: string;
  readonly opinion: OpinionKind;
  readonly value: number | undefined;
}

/** Resolve one `GapSourceSide` against a relationship's answers: name, opinion, score. */
function sideOf(rel: V1Relationship, itemId: string, side: GapSourceSide): GapSideView {
  const isInitiator = side.party === "initiator";
  const answers = isInitiator ? rel.initiatorAnswers[itemId] : rel.counterpartyAnswers[itemId];
  return {
    name: isInitiator ? rel.initiatorName : (rel.counterpartyName ?? "Counterparty"),
    opinion: side.opinion,
    value: answers?.[side.opinion],
  };
}

/** One party's score, named: "Noor Think 3" — the party, the opinion, the number. */
function SideScore({ side }: { side: GapSideView }) {
  if (side.value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="text-muted-foreground">
      <span className="font-medium text-foreground">{side.name}</span>{" "}
      <span>{OPINION_LABELS[side.opinion]}</span> <span className="tabular-nums">{side.value}</span>
    </span>
  );
}

/** One opinion value in the table, or a dash when the party has not answered that kind. */
function opinionValue(
  answers: Readonly<Record<string, Opinions>>,
  itemId: string,
  kind: OpinionKind,
): string {
  const value = answers[itemId]?.[kind];
  return value === undefined ? "—" : String(value);
}

/**
 * The report — for every Aspect, both parties' four opinions in one table, then the eight
 * Gap kinds grouped under the glossary's own headings, with the Setting's verdict on top.
 */
export function ReportView({ relationshipId }: { relationshipId: string }) {
  const { hydrated, relationships, templates } = useV1Store();

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
          message={`No relationship with id "${relationshipId}" exists.`}
          back="/v1/initiator"
        />
      </div>
    );
  }

  const template = templates.find((t) => t.id === rel.templateId);
  const summary = gapSummary(rel);
  const kinds = opinionKindsFor(rel.mode);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro
          title={`Report — ${relationshipNameOf(rel, template?.title ?? "")}`}
          subtitle={`${MODE_WORD[rel.mode]} · ${SETTING_LABELS[rel.setting]} setting`}
        />
        <StageBadge stage={summary.stage} />
      </div>

      {summary.verdict === null ? (
        <section className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Report locked</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {STAGE_DEFINITIONS[summary.stage]}
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

          <div className="space-y-4">
            {rel.items.map((item) => {
              const gaps = aspectGapsOf(rel, item.id);
              const groups = groupsIn(gaps);
              const gapAttributes: Record<string, string> = Object.fromEntries(
                GAP_KINDS.flatMap((kind) => {
                  const gap = gaps[kind];
                  return gap === undefined ? [] : [[`data-${kind}-gap`, String(gap)]];
                }),
              );
              return (
                <section
                  key={item.id}
                  data-aspect={item.id}
                  {...gapAttributes}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <h2 className="text-base font-semibold text-foreground">{item.prompt}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.leftValue} (1) → {item.rightValue} (5)
                  </p>

                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th scope="col" className="py-1 pr-3" />
                        {kinds.map((kind) => (
                          <th
                            key={kind}
                            scope="col"
                            className="px-2 py-1 text-left font-semibold text-foreground"
                          >
                            <span className="block">{OPINION_LABELS[kind]}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {OPINION_DEFINITIONS[kind]}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">
                          {rel.initiatorName}
                        </th>
                        {kinds.map((kind) => (
                          <td
                            key={kind}
                            className="px-2 py-2 text-left tabular-nums text-foreground"
                          >
                            {opinionValue(rel.initiatorAnswers, item.id, kind)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">
                          {rel.counterpartyName}
                        </th>
                        {kinds.map((kind) => (
                          <td
                            key={kind}
                            className="px-2 py-2 text-left tabular-nums text-foreground"
                          >
                            {opinionValue(rel.counterpartyAnswers, item.id, kind)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>

                  {groups.map((group) => (
                    <div key={group.id} className="mt-3 first:mt-0" data-gap-group={group.id}>
                      <h3 className="text-sm font-semibold text-foreground">{group.heading}</h3>
                      <table className="mt-1 w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th
                              scope="col"
                              className="py-1 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              Gap
                            </th>
                            <th
                              scope="col"
                              className="py-1 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              The two Opinions
                            </th>
                            <th
                              scope="col"
                              className="py-1 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {group.kinds.flatMap((kind) => {
                            const sides = SOURCE_BY_KIND.get(kind);
                            const gap = gaps[kind];
                            if (sides === undefined || gap === undefined) return [];
                            const left = sideOf(rel, item.id, sides[0]);
                            const right = sideOf(rel, item.id, sides[1]);
                            return [
                              <tr key={kind} data-gap-kind={kind} className="align-middle">
                                <th
                                  scope="row"
                                  className="py-1.5 pr-3 text-left text-sm font-medium text-foreground"
                                >
                                  {GAP_KIND_LABELS[kind]}
                                </th>
                                <td className="py-1.5 pr-3">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <SideScore side={left} />
                                    <span aria-hidden className="text-xs text-muted-foreground">
                                      vs
                                    </span>
                                    <SideScore side={right} />
                                  </span>
                                </td>
                                <td className="py-1.5 text-right">
                                  <span
                                    data-gap-number={gap}
                                    className="text-sm font-semibold tabular-nums text-foreground"
                                  >
                                    {gap}
                                  </span>
                                  {gap === 0 ? (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      In Synch
                                    </span>
                                  ) : null}
                                </td>
                              </tr>,
                            ];
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const MODE_WORD = { basic: "Basic Mode", advanced: "Advanced Mode" } as const;
