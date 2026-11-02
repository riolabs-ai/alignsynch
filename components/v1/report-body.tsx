// template-ancestor: components/assessment/assessment-report.tsx   (variation: four opinions per aspect with prediction-derived gaps)
"use client";

import {
  FLAG_SEVERITIES,
  FLAG_SEVERITY_LABELS,
  GAP_KIND_LABELS,
  GAP_KIND_SOURCES,
  GAP_KINDS,
  gapKindsIn,
  groupsIn,
  type GapGroup,
  type GapKind,
  type GapSource,
  type GapSourceSide,
  type UnmetGap,
} from "@/content/gaps";
import {
  OPINION_DEFINITIONS,
  OPINION_LABELS,
  SETTING_LABELS,
  opinionKindsFor,
  type OpinionKind,
} from "@/content/assessment";
import { MAX_GAP, type Gap } from "@/content/record";
import type { V1Relationship } from "@/data/v1/fixtures";
import {
  aspectGapsOf,
  flagCountsOfRelationship,
  gapSummary,
  progressOf,
  relationshipNameOf,
} from "@/lib/v1/derive";
import { FLAG_SEVERITY_FILLS, GapPill, SectionIntro, StageBadge } from "@/components/v1/v1-ui";
import Link from "next/link";

/**
 * The report's body — the one renderer a completed session's report and a template demo share.
 *
 * **Every Gap prints the two Opinions it subtracts.** A Gap is one subtraction
 * (`gapOf(left, right)`), and `content/gaps.ts::GAP_KIND_SOURCES` is the one table that says
 * which two Opinions each kind compares. This file reads that table instead of restating it, so
 * a row can never label one pair and print another: "Feel Gap — Noor Feel 1 vs Iris Feel 5 — 4"
 * is the whole fact, and a bare "4" is the defect this screen exists to avoid. The pairs are
 * resolved against the relationship's own answers, named by party, so the reader sees who said
 * what before they see the distance between them.
 *
 * Per Aspect the card reads top to bottom in the order a reader asks the questions:
 *
 *   1. what is asked, and the two named ends of the scale (`Rare (1) — Constant (5)`);
 *   2. the per-Aspect verdict under the Setting (°within it, or which Gaps exceed it);
 *   3. both parties' Opinions in one matrix (Feel and Wish on Basic, all four on Advanced);
 *   4. one table per glossary group the Aspect actually has (`groupsIn`) — the group heading is
 *      the old report's "Feelings and Wishes Differ" line, and its rows are the Gaps;
 *   5. the Aspect's own comment thread, when the parties left one.
 *
 * The matrix and the group tables are drawn from the same `aspectGapsOf` call the verdict is,
 * so nothing on the card can disagree with the number in its own header.
 *
 * **Blind before scoring.** The whole body — prompts, values, tables, comments — is rendered
 * only once `gapSummary(rel).verdict` exists, i.e. when both parties have **accepted**, not
 * merely submitted (`lib/v1/derive.ts`). An unscored relationship gets the gate: no values, no
 * empty table, and an answer count that says nothing about what anyone answered.
 *
 * It is pure presentation over one `V1Relationship`: it reads no store, so the live report
 * (`ReportView`) and the public demo (`/v1/templates/[type]/demo`) both pass it a relationship
 * and get the identical layout. The flag counts are `flagCountsOfRelationship`, i.e.
 * `content/gaps.ts::flagCountsOf` over the same Aspects the cards draw — never a stored total.
 * No clock is read here: comments print their author and body but no relative time, because the
 * demo server-renders this component and a wall-clock label would be the #418 hydration defect.
 */

/** The eight pairs by kind, so a group's kinds resolve to their two sides in one lookup. */
const SOURCE_BY_KIND = new Map<GapKind, GapSource>(
  GAP_KIND_SOURCES.map((source) => [source.kind, source]),
);

/** One side of a Gap, resolved against a relationship: who said it, which opinion, what value. */
interface GapSideView {
  readonly name: string;
  readonly opinion: OpinionKind;
  readonly value: number | undefined;
}

/** Resolve one `GapSourceSide` — its party, its opinion kind and that party's value. */
function sideOf(rel: V1Relationship, itemId: string, side: GapSourceSide): GapSideView {
  const isInitiator = side.party === "initiator";
  const answers = isInitiator ? rel.initiatorAnswers[itemId] : rel.counterpartyAnswers[itemId];
  return {
    name: isInitiator ? rel.initiatorName : (rel.counterpartyName ?? "Counterparty"),
    opinion: side.opinion,
    value: answers?.[side.opinion],
  };
}

/** One Opinion named and valued: "Noor Feel 1" — the party, the kind, the number. */
function SideScore({ side }: { side: GapSideView }) {
  if (side.value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-muted-foreground">
      <span className="font-medium text-foreground">{side.name}</span>{" "}
      <span>{OPINION_LABELS[side.opinion]}</span>{" "}
      <span className="font-semibold tabular-nums text-foreground">{side.value}</span>
    </span>
  );
}

/**
 * Both parties' Opinions on one Aspect, as a matrix: a row per party, a column per opinion the
 * Mode asks. This is the table the report lost — four columns on Advanced, two on Basic, and a
 * dash (never a 0) where a party left a kind unanswered.
 */
function OpinionMatrix({
  rel,
  itemId,
  prompt,
}: {
  rel: V1Relationship;
  itemId: string;
  prompt: string;
}) {
  const kinds = opinionKindsFor(rel.mode);
  const parties = [
    { role: "initiator", name: rel.initiatorName, answers: rel.initiatorAnswers },
    {
      role: "counterparty",
      name: rel.counterpartyName ?? "Counterparty",
      answers: rel.counterpartyAnswers,
    },
  ];

  return (
    <table className="mt-3 w-full border-collapse text-sm">
      <caption className="sr-only">{`${prompt} — both parties' opinions`}</caption>
      <thead>
        <tr className="border-b border-border">
          <th
            scope="col"
            className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Party
          </th>
          {kinds.map((kind) => (
            <th key={kind} scope="col" className="px-2 py-1 text-left align-top">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {OPINION_LABELS[kind]}
              </span>
              <span className="block font-normal text-[11px] text-muted-foreground">
                {OPINION_DEFINITIONS[kind]}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {parties.map((party) => (
          <tr key={party.role}>
            <th scope="row" className="py-1.5 pr-3 text-left font-medium text-foreground">
              {party.name}
            </th>
            {kinds.map((kind) => (
              <td key={kind} className="px-2 py-1.5 tabular-nums text-foreground">
                {party.answers[itemId]?.[kind] ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One glossary group's rows for one Aspect: the Gap's name, the two Opinions it compares (each
 * named by party and value), and the Gap itself. A kind whose pair is absent from the answers is
 * not drawn — never a row of dashes, and never a 0 about a question nobody asked.
 */
function GapTable({
  rel,
  itemId,
  prompt,
  gaps,
  group,
}: {
  rel: V1Relationship;
  itemId: string;
  prompt: string;
  gaps: ReturnType<typeof aspectGapsOf>;
  group: GapGroup;
}) {
  const entries = group.kinds.flatMap((kind) => {
    const source = SOURCE_BY_KIND.get(kind);
    const gap = gaps[kind];
    if (source === undefined || gap === undefined) return [];
    return [{ source, gap }];
  });
  if (entries.length === 0) return null;

  return (
    <div className="mt-4" data-gap-group={group.id}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {group.heading}
      </h3>
      <table className="mt-1 w-full border-collapse text-sm">
        <caption className="sr-only">{`${prompt} — ${group.heading}`}</caption>
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Gap
            </th>
            <th
              scope="col"
              className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              The two opinions it compares
            </th>
            <th
              scope="col"
              className="py-1 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Gap value (0–{MAX_GAP})
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map(({ source, gap }) => (
            <tr key={source.kind} data-gap-kind={source.kind} className="align-middle">
              <th scope="row" className="py-1.5 pr-3 text-left font-medium text-foreground">
                {GAP_KIND_LABELS[source.kind]}
              </th>
              <td className="py-1.5 pr-3">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SideScore side={sideOf(rel, itemId, source.left)} />
                  <span aria-hidden className="text-xs text-muted-foreground">
                    vs
                  </span>
                  <SideScore side={sideOf(rel, itemId, source.right)} />
                </span>
              </td>
              <td className="py-1.5 text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <span data-gap-number={gap}>
                    <GapPill gap={gap} />
                  </span>
                  {gap === 0 ? (
                    <span className="text-xs text-muted-foreground">In Synch</span>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The comments the parties left on one Aspect, attached to that Aspect's own card. */
function AspectComments({
  comments,
  nameOf,
}: {
  comments: readonly { id: string; author: "initiator" | "counterparty"; body: string }[];
  nameOf: (author: "initiator" | "counterparty") => string;
}) {
  if (comments.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Comments on this Aspect
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {comments.map((comment) => (
          <li key={comment.id} className="text-sm">
            <span className="font-medium text-foreground">{nameOf(comment.author)}</span>{" "}
            <span className="text-muted-foreground">{comment.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The per-Aspect verdict, in words: within the Setting, or how many of this Aspect's Gaps exceed
 * it — and which kinds when there are few enough to name. Derived from the same `verdict.unmet`
 * rows the report's header counts, so the two can never disagree.
 */
function aspectVerdictLine(unmet: readonly UnmetGap[], measured: number, setting: string): string {
  if (unmet.length === 0) {
    return `Within the ${setting} Setting — all ${measured} Gaps are tolerated.`;
  }
  const named = unmet.map((entry) => GAP_KIND_LABELS[entry.kind]);
  if (unmet.length === measured) {
    return `All ${measured} Gaps exceed the ${setting} Setting${named.length <= 3 ? ` — ${named.join(", ")}` : ""}.`;
  }
  return `${unmet.length} of ${measured} Gaps exceed the ${setting} Setting${named.length <= 3 ? ` — ${named.join(", ")}` : ""}.`;
}

/**
 * One Aspect: what is asked, the two named ends of the scale, where it lands under the Setting,
 * both parties' Opinions, one table per group it has, and its own comments.
 */
function AspectCard({
  rel,
  item,
  verdict,
}: {
  rel: V1Relationship;
  item: V1Relationship["items"][number];
  verdict: NonNullable<ReturnType<typeof gapSummary>["verdict"]>;
}) {
  const gaps = aspectGapsOf(rel, item.id);
  const kinds = gapKindsIn(gaps);
  const groups = groupsIn(gaps);
  const setting = SETTING_LABELS[rel.setting];
  const unmetHere = verdict.unmet.filter((entry) => entry.itemId === item.id);
  const widest: Gap | null =
    kinds.length === 0 ? null : (Math.max(...kinds.map((kind) => gaps[kind] ?? 0)) as Gap);
  const comments = rel.aspectComments[item.id] ?? [];

  // `data-<kind>-gap`, one attribute per Gap this Aspect actually has, in glossary order: the
  // acceptance check reads the numbers off the markup instead of parsing a sentence.
  const gapAttributes: Record<string, string> = Object.fromEntries(
    GAP_KINDS.flatMap((kind) => {
      const gap = gaps[kind];
      return gap === undefined ? [] : [[`data-${kind}-gap`, String(gap)]];
    }),
  );

  const verdictLine = aspectVerdictLine(unmetHere, kinds.length, setting);

  return (
    <section
      data-aspect={item.id}
      data-aspect-verdict={unmetHere.length === 0 ? "within" : "unmet"}
      {...gapAttributes}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{item.prompt}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span>{item.leftValue}</span>
            <span className="mx-1.5 text-muted-foreground" aria-hidden>
              —
            </span>
            <span>{item.rightValue}</span>
            <span className="ml-1.5 tabular-nums">
              (scale {item.scale.min}–{item.scale.max})
            </span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Widest gap</span>
          {widest === null ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <GapPill gap={widest} />
          )}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{verdictLine}</p>

      <OpinionMatrix rel={rel} itemId={item.id} prompt={item.prompt} />

      {groups.map((group) => (
        <GapTable
          key={group.id}
          rel={rel}
          itemId={item.id}
          prompt={item.prompt}
          gaps={gaps}
          group={group}
        />
      ))}

      <AspectComments
        comments={comments}
        nameOf={(author) =>
          author === "initiator" ? rel.initiatorName : (rel.counterpartyName ?? "Counterparty")
        }
      />
    </section>
  );
}

export function ReportBody({ rel, templateTitle }: { rel: V1Relationship; templateTitle: string }) {
  const summary = gapSummary(rel);
  // The per-severity counts, derived from the same opinion rows the pills are drawn from —
  // never a stored total. Null while the session is incomplete: the report is locked then, so
  // the sheet prints no counts at all rather than four zeroes about a sheet nobody finished.
  const flags = flagCountsOfRelationship(rel);

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <SectionIntro
        title={`Report — ${relationshipNameOf(rel, templateTitle)}`}
        subtitle={`${MODE_WORD[rel.mode]} · ${SETTING_LABELS[rel.setting]} setting`}
      />
      <StageBadge stage={summary.stage} />
    </div>
  );

  if (summary.verdict === null) {
    const progress = progressOf(rel);
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
        {header}
        <section className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Report locked</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The report unlocks only when both parties accept — not when the second one submits. The
            Initiator has answered {progress.initiatorAnswered}/{progress.aspectCount} and the
            Counterparty {progress.counterpartyAnswered}/{progress.aspectCount} Aspect
            {progress.aspectCount === 1 ? "" : "s"} — until both accept, each side&apos;s answers
            stay blind, so no value and no Gap is shown here.
          </p>
          <Link
            href={`/v1/relationships/${rel.id}`}
            className="mt-4 inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to the relationship
          </Link>
        </section>
      </div>
    );
  }

  const verdict = summary.verdict;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      {header}

      <section
        className={
          verdict.aligned
            ? "rounded-lg border border-green-200 bg-green-50 p-4"
            : "rounded-lg border border-amber-200 bg-amber-50 p-4"
        }
      >
        <p className="text-base font-semibold text-foreground">
          {verdict.aligned ? "Aligned" : "Not yet aligned"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.totalGaps} Gap{summary.totalGaps === 1 ? "" : "s"} measured across{" "}
          {rel.items.length} Aspect{rel.items.length === 1 ? "" : "s"} —{" "}
          {summary.unmetGaps === 0
            ? "every one meets the Setting"
            : `${summary.unmetGaps} exceed the Setting (${verdict.limit === 0 ? "no Gap tolerated" : "only a Gap of 1 tolerated"}).`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every Gap below prints the two answers it subtracts, named by party, so no number appears
          without its mechanism.
        </p>
        {flags !== null && (
          <div
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3"
            data-flag-counts={`${flags.yellow}/${flags.orange}/${flags.pink}/${flags.red}`}
          >
            <span className="text-xs font-semibold text-muted-foreground">Flags by severity</span>
            {FLAG_SEVERITIES.map((severity) => (
              <span key={severity} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 rounded-full border ${FLAG_SEVERITY_FILLS[severity]}`}
                />
                <span className="text-xs text-muted-foreground">
                  {FLAG_SEVERITY_LABELS[severity]} {flags[severity]}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="space-y-3">
        {rel.items.map((item) => (
          <AspectCard key={item.id} rel={rel} item={item} verdict={verdict} />
        ))}
      </div>
    </div>
  );
}

const MODE_WORD = { basic: "Basic Mode", advanced: "Advanced Mode" } as const;
