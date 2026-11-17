/**
 * Start's derivation, driven without a database (#1129).
 *
 * `lib/member/start.ts` decides three things the landing cannot get wrong:
 *
 *   1. **which word a card carries** — the four the owner named, mapped once from the seven
 *      lifecycle values, with `void` drawn nowhere;
 *   2. **which conversation is "the next step"** — the widest Gap across every *live*
 *      relationship, so the row names the biggest thing and not the first row the read returned;
 *   3. **which jobs exist at all** — a paused relationship only for its Initiator, a draft only for
 *      the person whose invite it is.
 *
 * The cases below are the negative ones as much as the positive ones: a Counterparty who is handed
 * "Add a Card", or a landing that prints a conversation for a relationship with one sheet in, is the
 * failure this file exists to catch.
 */
import { describe, expect, it } from "vitest";
import type { AlignmentSummary } from "@/lib/member/alignment-summary";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import {
  activeCardsOf,
  cardStateOf,
  CARD_STATES,
  startJobsOf,
  visibleCards,
  widestAcross,
} from "@/lib/member/start";
import type { RelationshipStatus } from "@/lib/relationship/status";

/** Only the fields the derivation reads; the rest of the row is the read's business. */
function row(
  id: string,
  status: RelationshipStatus,
  seats: { isInitiator?: boolean; sessionRecordId?: string | null } = {},
): MemberRelationshipRow {
  return {
    id,
    status,
    isInitiator: seats.isInitiator ?? true,
    viewerRole: seats.isInitiator === false ? "counterparty" : "initiator",
    sessionRecordId: seats.sessionRecordId === undefined ? `s-${id}` : seats.sessionRecordId,
    title: `Template ${id}`,
    templateSlug: `template-${id}`,
  } as unknown as MemberRelationshipRow;
}

/** A summary whose only interesting field is the Next Step the tie-break produced. */
function summaryWith(prompt: string, gap: number, aligned = 0, total = 5): AlignmentSummary {
  return {
    aspects: [],
    tally: { inSynch: aligned, smallGap: 0, gap: 0 },
    aligned,
    total,
    nextStep: { itemId: `item-${prompt}`, prompt, kind: "wish", gap },
  } as unknown as AlignmentSummary;
}

/** A summary with both sheets in and nothing above zero: no conversation to have. */
function settled(): AlignmentSummary {
  return {
    aspects: [],
    tally: { inSynch: 5, smallGap: 0, gap: 0 },
    aligned: 5,
    total: 5,
    nextStep: null,
  } as unknown as AlignmentSummary;
}

describe("the four card words (#1129)", () => {
  it("maps the seven lifecycle values onto exactly four words, and draws nothing for void", () => {
    expect(cardStateOf(row("a", "draft"))).toBe("draft");
    expect(cardStateOf(row("b", "pending"))).toBe("draft");
    expect(cardStateOf(row("c", "published"))).toBe("waiting");
    expect(cardStateOf(row("d", "active"))).toBe("live");
    expect(cardStateOf(row("e", "complete"))).toBe("live");
    expect(cardStateOf(row("f", "expired"))).toBe("paused");
    // An operator ended it: there is nothing to do and nothing to resume.
    expect(cardStateOf(row("g", "void"))).toBe(null);
  });

  it("draws nothing at all for a voided row, on either screen", () => {
    const rows = [row("a", "active"), row("b", "void"), row("c", "expired")];
    expect(visibleCards(rows).map((card) => card.row.id)).toEqual(["a", "c"]);
    expect(activeCardsOf(rows).map((card) => card.row.id)).toEqual(["a"]);
    // The void row is never the one a job points at.
    expect(startJobsOf(rows, {}).map((job) => job.relationshipId)).not.toContain("b");
  });

  it("keeps the word list to the four the owner named", () => {
    expect(CARD_STATES).toEqual(["live", "waiting", "draft", "paused"]);
  });
});

describe("the one conversation (#1129)", () => {
  it("names the widest Gap across live relationships, not the first row read", () => {
    const rows = [row("a", "active"), row("b", "active")];
    const jobs = startJobsOf(rows, {
      a: summaryWith("Parent Decisions", 1),
      b: summaryWith("Money Habits", 4),
    });
    expect(jobs[0]).toEqual({ kind: "next-step", relationshipId: "b", prompt: "Money Habits" });
  });

  it("ignores a relationship whose sheets are not both in — there is no conversation to name", () => {
    const rows = [row("a", "active"), row("b", "active")];
    const jobs = startJobsOf(rows, { a: settled(), b: null });
    expect(jobs).toEqual([]);
  });

  it("ignores a waiting or paused relationship's numbers: the conversation needs both people", () => {
    const rows = [row("a", "published"), row("b", "expired")];
    const jobs = startJobsOf(rows, {
      a: summaryWith("Parent Decisions", 5),
      b: summaryWith("Money Habits", 5),
    });
    // Only the paused row's card job survives — neither row names a conversation.
    expect(jobs.map((job) => job.kind)).toEqual(["add-card"]);
  });

  it("breaks a tie on the widest Gap by leaving the earlier Aspect standing", () => {
    const winner = widestAcross([
      { relationshipId: "a", summary: summaryWith("First", 3) },
      { relationshipId: "b", summary: summaryWith("Second", 3) },
    ]);
    expect(winner?.relationshipId).toBe("a");
  });
});

describe("the two small jobs (#1129)", () => {
  it("offers Add a Card to the Initiator of a paused relationship and never to its Counterparty", () => {
    const initiator = startJobsOf([row("a", "expired")], {});
    expect(initiator).toEqual([{ kind: "add-card", relationshipId: "a" }]);

    const counterparty = startJobsOf([row("a", "expired", { isInitiator: false })], {});
    expect(counterparty).toEqual([]);
  });

  it("offers Finish the Invite only for a draft the viewer started", () => {
    expect(startJobsOf([row("a", "draft")], {})).toEqual([
      { kind: "finish-draft", relationshipId: "a" },
    ]);
    expect(startJobsOf([row("a", "draft", { isInitiator: false })], {})).toEqual([]);
  });

  it("leads with the conversation, then one job of each kind — never two of either", () => {
    const rows = [row("a", "active"), row("b", "expired"), row("c", "expired"), row("d", "draft")];
    const jobs = startJobsOf(rows, {
      a: summaryWith("Parent Decisions", 2),
      b: null,
      c: null,
      d: null,
    });
    expect(jobs.map((job) => job.kind)).toEqual(["next-step", "add-card", "finish-draft"]);
    expect(jobs.filter((job) => job.kind === "add-card")).toHaveLength(1);
    expect(jobs.filter((job) => job.kind === "finish-draft")).toHaveLength(1);
  });
});

describe("Start's two cards (#1129)", () => {
  it("draws live before waiting, never a draft or a paused row, and caps at two", () => {
    const rows = [
      row("a", "draft"),
      row("b", "published"),
      row("c", "active"),
      row("d", "expired"),
      row("e", "active"),
    ];
    expect(activeCardsOf(rows).map((card) => card.row.id)).toEqual(["c", "e"]);
    expect(activeCardsOf(rows, 5).map((card) => card.state)).toEqual(["live", "live", "waiting"]);
  });
});
