/**
 * Start — what a member has to do next (#1129).
 *
 * The signed-in landing does not list everything; it names **one** conversation and up to two
 * small jobs. That is a derivation, not copy: the conversation is the widest Gap across every
 * relationship that is live, and the jobs are the stalled states — a paused relationship that a
 * card would resume, and a draft that has not been sent. This module is the whole of that
 * decision, so the page can stay a projection and a node test can drive every combination without
 * a database (`tests/start-next-steps.test.ts`).
 *
 * **The four card states are the owner's words, not the seven lifecycle values.** A relationship's
 * `relationship.status` is `draft | pending | published | active | complete | void | expired`
 * (`lib/relationship/status.ts`), and the v2 card draws one chip from exactly four words —
 * Stage 6 Live, Waiting on Invite, Draft, Paused. The two vocabularies are mapped here once, in
 * the open, rather than compared inline on a screen:
 *
 *   draft, pending          → Draft          (configured, nothing sent: stage 1–4)
 *   published               → Waiting on Invite
 *   active, complete        → Stage 6 Live   (both parties in; `complete` has both sheets)
 *   expired                 → Paused         (the trial lapsed; nothing is lost, nothing moves)
 *   active + a pause        → Paused
 *
 * **`void` is not on these screens.** An operator ended it, so there is nothing to do and nothing
 * to resume — #503 settled the same question for voided sessions ("a to-do row that can never be
 * answered is noise"). The record is preserved and the relationship's own screen still answers;
 * what stops is Start and My Relationships advertising it as work.
 */
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import type { AlignmentSummary, NextStep } from "@/lib/member/alignment-summary";

/** The four states a v2 card can be in. The owner's words live in the copy fixture. */
export const CARD_STATES = ["live", "waiting", "draft", "paused"] as const;

export type RelationshipCardState = (typeof CARD_STATES)[number];

/**
 * Which of the four words a row carries — `null` for a relationship that is closed (`void`) and
 * therefore drawn nowhere on these two screens.
 *
 * `pauseOf` is not read here: a paused relationship is one whose *trial* has lapsed (status
 * `expired`) or whose Stage 6 is read-only, and this module reads the row's status rather than a
 * second query — the card's own pause band is the detail screen's, not the list's.
 */
export function cardStateOf(row: MemberRelationshipRow): RelationshipCardState | null {
  switch (row.status) {
    case "draft":
    case "pending":
      return "draft";
    case "published":
      return "waiting";
    case "active":
    case "complete":
      return "live";
    case "expired":
      return "paused";
    case "void":
      return null;
  }
}

/** Rows that belong on Start or My Relationships, in the order the read returned them. */
export function visibleCards(rows: readonly MemberRelationshipRow[]): {
  row: MemberRelationshipRow;
  state: RelationshipCardState;
}[] {
  const cards: { row: MemberRelationshipRow; state: RelationshipCardState }[] = [];
  for (const row of rows) {
    const state = cardStateOf(row);
    if (state !== null) cards.push({ row, state });
  }
  return cards;
}

/**
 * The jobs Start leads with, in the order the bundle draws them.
 *
 *   next-step     the widest Gap across every live relationship — the one conversation to have.
 *                 Absent when nobody has both sheets in, which is the honest empty state rather
 *                 than a row pointing at an Align screen with no numbers on it.
 *   add-card      for a **paused** relationship the viewer is the Initiator of. The Counterparty
 *                 has no card to add and no price to see (locked rule 5), so the job never renders
 *                 for them.
 *   finish-draft  for a draft whose viewer is the Initiator — the invite is theirs to send.
 *
 * A job carries the relationship's id and the words the row already knows; the page resolves the
 * labels and the addresses, because `lib/flow/paths.ts` is the one place a path is written.
 */
export interface StartJob {
  readonly kind: "next-step" | "add-card" | "finish-draft";
  readonly relationshipId: string;
  /** The Aspect's own prompt, for `next-step`; `undefined` on the other two. */
  readonly prompt?: string;
}

/** The widest Gap across several live relationships — the widest wins, then Aspect order. */
export function widestAcross(
  entries: readonly { relationshipId: string; summary: AlignmentSummary | null }[],
): { relationshipId: string; step: NextStep } | null {
  let winner: { relationshipId: string; step: NextStep } | null = null;
  for (const entry of entries) {
    const step = entry.summary?.nextStep;
    if (step === undefined || step === null) continue;
    if (winner === null || step.gap > winner.step.gap) {
      winner = { relationshipId: entry.relationshipId, step };
    }
  }
  return winner;
}

/**
 * The ordered jobs for one member.
 *
 * `summaries` is keyed by **relationship id**, and a missing entry is "no answers yet" rather than
 * an error: a Cards screen reading a relationship whose session has no opinions draws the dashed
 * "results appear once you both answer" line, and Start omits the conversation.
 */
export function startJobsOf(
  rows: readonly MemberRelationshipRow[],
  summaries: Readonly<Record<string, AlignmentSummary | null>>,
): StartJob[] {
  const cards = visibleCards(rows);

  const widest = widestAcross(
    cards
      .filter((card) => card.state === "live")
      .map((card) => ({ relationshipId: card.row.id, summary: summaries[card.row.id] ?? null })),
  );

  const jobs: StartJob[] = [];
  if (widest !== null) {
    jobs.push({
      kind: "next-step",
      relationshipId: widest.relationshipId,
      prompt: widest.step.prompt,
    });
  }

  for (const card of cards) {
    if (jobs.filter((job) => job.kind === "add-card").length >= 1) break;
    if (card.state === "paused" && card.row.isInitiator) {
      jobs.push({ kind: "add-card", relationshipId: card.row.id });
    }
  }

  for (const card of cards) {
    if (jobs.filter((job) => job.kind === "finish-draft").length >= 1) break;
    if (card.state === "draft" && card.row.isInitiator) {
      jobs.push({ kind: "finish-draft", relationshipId: card.row.id });
    }
  }

  return jobs;
}

/**
 * Start's two cards: the relationships that are in play — live first, then waiting — and never a
 * draft, which is a job rather than a relationship yet.
 */
export function activeCardsOf(
  rows: readonly MemberRelationshipRow[],
  limit = 2,
): { row: MemberRelationshipRow; state: RelationshipCardState }[] {
  const order: Record<RelationshipCardState, number> = { live: 0, waiting: 1, paused: 2, draft: 3 };
  return visibleCards(rows)
    .filter((card) => card.state === "live" || card.state === "waiting")
    .sort((left, right) => order[left.state] - order[right.state])
    .slice(0, limit);
}
