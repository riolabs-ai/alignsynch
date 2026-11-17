/**
 * Chat v2's derivations — the thread's state, the tags on a message, and what is unread (#1131).
 *
 * The bundle (`docs/specs/v2-bundles/07-spec-design-page-chat-v2/`) draws three thread states —
 * **live**, **waiting to join** and **paused** — and a message that may carry an Aspect chip beside
 * that Aspect's Align status. Every one of those is a *function of facts the product already has*,
 * never a column and never a query-string switch (the bundle is explicit that the prototype's
 * `?state=` and `?role=` are review tools and must not be ported). This module is where each
 * function lives, so a screen draws an answer and no component re-decides one.
 *
 * ## The three states, and the order they are asked in
 *
 *   1. **Not connected → waiting.** `connectionOf()` (`lib/relationship/membership.ts`) says the
 *      pair is not both in — the Counterparty has not joined, or there is no session yet. Chat has
 *      nothing to say to one person, so the thread says when it opens and carries no composer.
 *   2. **Lapsed for the trial's reason → paused.** `pauseOf()` (`lib/relationship/pause.ts`) is the
 *      one owner of that verdict (#1121): Stage 6 read-only, nothing lost, and the Initiator has one
 *      action.
 *   3. **Otherwise live.** The composer is the thread's.
 *
 * `waiting` is asked first on purpose, and the pairing it hides is unreachable rather than
 * arbitrary: a trial starts when the Counterparty **accepts** (#1115 task 4, #1121 rule 10), so a
 * relationship that has not been joined has no trial to lapse and `pauseOf()` cannot answer
 * `paused` for it. If both facts ever arrive together the reader is shown the one with an action —
 * send the invitation — rather than a read-only band over a conversation nobody can have.
 *
 * ## The Aspect's status, and the blind rule
 *
 * A tag's status is `alignmentStatusOf()` over the Aspect's **widest present cross-party Gap** —
 * the two rows Align draws, Feel and Wish (#1122). It is not an average (a composite score is what
 * `docs/specs/ux-report.md` forbids) and not a stored value (the Gap is a function of the two
 * opinion rows, and a stored status could only drift from them).
 *
 * **The status is `null` whenever the report is.** `FlowScreen.report` is present only once both
 * parties have accepted — the blind rule — so a tag drawn before then carries the Aspect's name and
 * nothing else. A screen that filled the chip in would be showing one party's answers through a
 * tag, which is the first thing the issue's *must not* list forbids, and the reason this is a
 * function of `report` rather than of the relationship.
 *
 * Pure: no React, no Next, no clock, no `lib/db/**`. `lib/assessment-report.ts` and `content/gaps.ts`
 * are both pure, so a `"use client"` component may import this module without dragging `pg` into the
 * browser graph (`data:check` E34).
 */
import type { AlignmentSetting } from "@/content/assessment";
import { type AlignmentStatus, alignmentStatusOf, gapKindsIn } from "@/content/gaps";
import type { ChatMessage, ChatSender, ChatThread } from "@/content/chat";
import type { AspectReportRow, AssessmentReport } from "@/lib/assessment-report";

/* ------------------------------------------------------------------ *
 * The state a thread is in
 * ------------------------------------------------------------------ */

/**
 * The three states the bundle draws. A **closed** relationship is deliberately not a fourth: chat's
 * pause is "read-only, nothing lost", and a relationship that is `complete` or `void` is a decision
 * rather than a pause (#1121, `isClosedRelationshipStatus`). The list leaves those rows out and the
 * page says so, instead of drawing a finished relationship as paused.
 */
export const CHAT_THREAD_STATES = ["live", "waiting", "paused"] as const;

export type ChatThreadState = (typeof CHAT_THREAD_STATES)[number];

/** The two facts a state is a function of — both derived elsewhere, neither re-decided here. */
export interface ChatThreadFacts {
  /** `Connection.connected` — both seats bound to an account and a session exists. */
  readonly connected: boolean;
  /** `Pause.paused` — the membership lapsed for the trial's reason (#1121). */
  readonly paused: boolean;
}

export function chatThreadStateOf(facts: ChatThreadFacts): ChatThreadState {
  if (!facts.connected) return "waiting";
  return facts.paused ? "paused" : "live";
}

/**
 * Does this state accept a message? Only `live` does: `waiting` has no conversation yet and
 * `paused` is read-only. The composer is drawn from this one predicate, never from a comparison
 * against a state name in the component.
 */
export function chatThreadWritable(state: ChatThreadState): boolean {
  return state === "live";
}

/* ------------------------------------------------------------------ *
 * Aspect tags
 * ------------------------------------------------------------------ */

/**
 * The two Gap kinds a tag's status is read from: the cross-party comparisons Align draws (#1122).
 *
 * The own-side kinds (`initiator`, `counterparty` — Feel against one's own Wish) describe one
 * person's desired change rather than where the pair stands, and the four prediction kinds are
 * #1128's Advanced scope. Neither belongs in a single chip about "us, on this Aspect".
 */
const CROSS_PARTY_KINDS = ["feel", "wish"] as const;

/**
 * The widest cross-party Gap an Aspect has, or `null` when it has none to measure.
 *
 * `null` is the absence, never a zero: an Aspect nobody has answered yet has no Gap at all, and
 * reporting `0` would be the glossary's *In Synch* about a question nobody asked — the same rule
 * `gapKindsOf()` follows by omitting a kind.
 */
export function aspectGapOf(row: AspectReportRow): number | null {
  let widest: number | null = null;
  for (const kind of gapKindsIn(row.gaps)) {
    if (!(CROSS_PARTY_KINDS as readonly string[]).includes(kind)) continue;
    const gap = row.gaps[kind];
    if (gap === undefined) continue;
    if (widest === null || gap > widest) widest = gap;
  }
  return widest;
}

/**
 * One Aspect's status, read through the session's Alignment Tolerance, or `null` when there is
 * nothing measured. `alignmentStatusOf` owns the 1-step row — this module never compares a Gap to 1,
 * so a re-score can never disagree with the Align surface about the same numbers.
 */
export function aspectStatusOf(
  row: AspectReportRow,
  setting: AlignmentSetting,
): AlignmentStatus | null {
  const gap = aspectGapOf(row);
  if (gap === null) return null;
  // `gapOf()` returns whole numbers 0..4; the parse keeps the type honest without a cast.
  const whole = Math.round(gap);
  if (whole < 0 || whole > 4) return null;
  return alignmentStatusOf(whole as 0 | 1 | 2 | 3 | 4, setting);
}

/** One Aspect as a message may name it: the id the tag carries and the words the chip prints. */
export interface ChatAspectSource {
  readonly itemId: string;
  readonly prompt: string;
}

/** An Aspect as a thread draws it: the chip's label, and its status when one may be shown. */
export interface ChatAspectTag extends ChatAspectSource {
  /** `null` under the blind rule (no report yet) and for an Aspect with no measured Gap. */
  readonly status: AlignmentStatus | null;
}

/**
 * Every Aspect of the relationship, ready to be tagged — in the relationship's own order.
 *
 * `report` is `null` until both parties have accepted, and then every tag's status is `null` too.
 * The tags still exist, because the chip's *name* is not an answer: `Aligned 3 of 5` is what the
 * blind rule hides, not the words "How much time do you spend together".
 */
export function chatAspectTagsOf(input: {
  readonly report: AssessmentReport | null;
  readonly aspects: readonly ChatAspectSource[];
}): readonly ChatAspectTag[] {
  const rows = new Map<string, AspectReportRow>();
  for (const row of input.report?.rows ?? []) rows.set(row.itemId, row);
  const setting = input.report?.setting;
  return input.aspects.map((aspect) => {
    const row = rows.get(aspect.itemId);
    return {
      itemId: aspect.itemId,
      prompt: aspect.prompt,
      status: row === undefined || setting === undefined ? null : aspectStatusOf(row, setting),
    };
  });
}

/** The tag a message names, or `undefined` when the Aspect is not this relationship's. */
export function chatTagOf(
  tags: readonly ChatAspectTag[],
  aspectId: string | undefined,
): ChatAspectTag | undefined {
  if (aspectId === undefined) return undefined;
  return tags.find((tag) => tag.itemId === aspectId);
}

/* ------------------------------------------------------------------ *
 * The thread's own little facts
 * ------------------------------------------------------------------ */

/** Is this message the reader's own? The one place "You" is decided. */
export function chatMessageIsMine(message: ChatMessage, viewerRole: ChatSender): boolean {
  return message.sender === viewerRole;
}

/**
 * How many of the other party's messages this reader has not opened.
 *
 * A message the reader wrote is never unread to them, whatever the fixture says — a count that
 * included your own words would be a defect the reader can see. The list's badge and the thread's
 * content are therefore read from one function, so the two cannot disagree.
 */
export function unreadCountOf(thread: ChatThread, viewerRole: ChatSender): number {
  return thread.messages.filter(
    (message) => message.unread === true && message.sender !== viewerRole,
  ).length;
}

/**
 * The thread's messages in send order — the order the schema already enforces, applied once more so
 * a caller that assembled a list from two sources cannot render a conversation backwards.
 */
export function chatMessagesOf(thread: ChatThread): readonly ChatMessage[] {
  return [...thread.messages].sort((left, right) =>
    left.at === right.at ? left.id.localeCompare(right.id) : left.at < right.at ? -1 : 1,
  );
}
