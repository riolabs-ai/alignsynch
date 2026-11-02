/**
 * The flag counts (#384) — the derivation `lib/v1/derive.ts::flagCountsOfRelationship` turns a
 * relationship's Gaps into per-severity counts (yellow / orange / pink / red), and it is a
 * **function of the opinion rows**, never a stored total. This file pins the three facts the
 * card asks for, against the real `data/v1/fixtures.ts` seeds:
 *
 *   scored       a complete (both-submitted-and-accepted) relationship reports its exact counts;
 *   unscored     an incomplete relationship reports `null`, never four zeroes;
 *   derivation   the counts equal `content/gaps.ts::flagCountsOf` over the same Aspects, so a
 *                fabricated flag total could not match the arithmetic without being recomputed.
 *
 * The fixture answers were authored to span every severity: `rel-aligned` carries yellow (a Gap
 * of 1 that Soft tolerates), and `rel-advanced` carries all four — yellow, orange, pink and red
 * — at once, so one relationship per colour is a property the seeds hold rather than a number
 * pasted into a sentence. `rel-same-sheet-full` is the Setting control: the same Mode on the
 * same answers as `rel-aligned`, played under Full, so the counts must be identical and only
 * the verdict may move.
 */
import { describe, expect, it } from "vitest";

import { FLAG_SEVERITIES, flagCountsOf } from "@/content/gaps";
import { seedRelationships } from "@/data/v1/fixtures";
import {
  allAspectGaps,
  flagCountsOfRelationship,
  sessionCompleteOf,
  verdictOf,
} from "@/lib/v1/derive";

const rel = (id: string) => {
  const found = seedRelationships.find((relationship) => relationship.id === id);
  if (found === undefined) throw new Error(`the fixtures have no relationship "${id}"`);
  return found;
};

describe("the flag counts are derived, never authored", () => {
  it("gives a scored relationship its exact per-severity counts", () => {
    // Ruth & Sam, Basic and aligned under Soft: six Gaps of 1 (yellow), the rest In Synch.
    expect(flagCountsOfRelationship(rel("rel-aligned"))).toEqual({
      yellow: 6,
      orange: 0,
      pink: 0,
      red: 0,
    });
    // Noor & Iris, Advanced under Full: 32 measured Gaps spanning all four severities.
    expect(flagCountsOfRelationship(rel("rel-advanced"))).toEqual({
      yellow: 9,
      orange: 9,
      pink: 9,
      red: 4,
    });
  });

  it("reports null for an unscored relationship, never four zeroes", () => {
    for (const id of ["rel-invited", "rel-connected-blind", "rel-sharing-unmet"]) {
      expect(flagCountsOfRelationship(rel(id))).toBeNull();
    }
  });

  it("agrees with the gap arithmetic on every relationship", () => {
    for (const relationship of seedRelationships) {
      if (!sessionCompleteOf(relationship)) {
        expect(flagCountsOfRelationship(relationship)).toBeNull();
        continue;
      }
      expect(flagCountsOfRelationship(relationship)).toEqual(
        flagCountsOf(allAspectGaps(relationship)),
      );
    }
  });

  it("has one relationship per severity colour", () => {
    const scored = seedRelationships.filter(sessionCompleteOf);
    for (const severity of FLAG_SEVERITIES) {
      const carriers = scored.filter((relationship) => {
        const counts = flagCountsOfRelationship(relationship);
        return counts !== null && counts[severity] > 0;
      });
      expect(carriers.length).toBeGreaterThan(0);
    }
    // The Advanced Full fixture alone carries all four severities at once.
    const advanced = flagCountsOfRelationship(rel("rel-advanced"));
    expect(advanced).not.toBeNull();
    if (advanced === null) return;
    for (const severity of FLAG_SEVERITIES) {
      expect(advanced[severity]).toBeGreaterThan(0);
    }
  });

  it("keeps the Setting out of the counts: the control pair differs only in its verdict", () => {
    // `rel-aligned` (Soft) and `rel-same-sheet-full` (Full) are the same Mode on the same
    // answers. If a Setting ever leaked into the counts, or a count were authored rather than
    // derived, this pair would disagree — the numbers are the test that it cannot.
    const soft = rel("rel-aligned");
    const full = rel("rel-same-sheet-full");
    expect(full.mode).toBe(soft.mode);
    expect(flagCountsOfRelationship(full)).toEqual(flagCountsOfRelationship(soft));
    expect(flagCountsOfRelationship(full)).toEqual({
      yellow: 6,
      orange: 0,
      pink: 0,
      red: 0,
    });
    // Same six Gaps of 1: Soft tolerates them, Full tolerates none.
    expect(verdictOf(soft)?.aligned).toBe(true);
    expect(verdictOf(soft)?.unmet.length).toBe(0);
    expect(verdictOf(full)?.aligned).toBe(false);
    expect(verdictOf(full)?.unmet.length).toBe(6);
  });
});
