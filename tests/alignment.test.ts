/**
 * Alignment — the Setting as a predicate over the Gaps (#259).
 *
 * The glossary's Setting "changes the requirement to be In Synch", and its two values say
 * exactly how far from In Synch still counts: Soft is "Small Gap (1) OK — a satisfactory
 * Setting", Full is "No Gap OK — an exceptional Setting". These cases pin the arithmetic
 * that turns those words into an answer:
 *
 *   one Gap     Soft accepts 1 and rejects 2; Full accepts 0 and rejects 1. The numbers
 *               come from `gapOf`, so the test states the scores too — `gapOf(4, 5) === 1`.
 *   one instance every Gap the instance *has* must meet the Setting, and a kind the
 *               instance does not have (Basic Mode's four prediction kinds) is never unmet.
 *   the verdict derived, never stored: `instanceAlignment()` returns the numbers it saw,
 *               so a caller can say which Gap broke it, and there is no `aligned` column
 *               for that answer to drift from.
 *
 * Two real fixtures are the second subject: `ruth-sam` agrees on every cross-party Gap and
 * differs only by 1 on its own Feel/Wish pairs (Soft: aligned; Full: six unmet Gaps of 1),
 * and `avery-rowan` is the Basic instance whose Gaps of 2 and 3 no setting tolerates.
 */
import { describe, expect, it } from "vitest";
import { SETTING_GAP_LIMITS } from "@/content/assessment";
import {
  BASIC_GAP_KINDS,
  GAP_KINDS,
  gapKindsOf,
  gapMeetsSetting,
  instanceAlignment,
  type AspectGaps,
} from "@/content/gaps";
import { gapOf } from "@/content/record";
import { assessmentInstances } from "@/data/assessments";
import type { AssessmentInstance } from "@/content/assessment";

/** One Aspect's Gaps, in the shape `instanceAlignment()` reads. */
function aspectGapsOf(instance: AssessmentInstance): AspectGaps[] {
  const [initiator, counterparty] = instance.parties;
  return instance.items.map((item) => {
    const left = initiator.opinions.find((answer) => answer.itemId === item.id);
    const right = counterparty.opinions.find((answer) => answer.itemId === item.id);
    if (left === undefined || right === undefined) {
      throw new Error(`instance "${instance.slug}" has an Aspect nobody answered: ${item.id}`);
    }
    return { itemId: item.id, gaps: gapKindsOf(left.opinions, right.opinions) };
  });
}

const ruth = assessmentInstances.find((instance) => instance.slug === "ruth-sam");
const avery = assessmentInstances.find((instance) => instance.slug === "avery-rowan");

if (ruth === undefined || avery === undefined) {
  throw new Error("the Ruth/Sam and Avery/Rowan fixtures are this file's subject");
}

describe("one Gap against one Setting", () => {
  it("uses the glossary's threshold: Soft 1, Full 0", () => {
    expect(SETTING_GAP_LIMITS).toEqual({ soft: 1, full: 0 });
  });

  it("Soft accepts a 1-point Gap and Full rejects it — gapOf(4, 5) === 1", () => {
    const gap = gapOf(4, 5);
    expect(gap).toBe(1);
    expect(gapMeetsSetting(gap, "soft")).toBe(true);
    expect(gapMeetsSetting(gap, "full")).toBe(false);
  });

  it("both settings accept In Synch — gapOf(4, 4) === 0", () => {
    const gap = gapOf(4, 4);
    expect(gap).toBe(0);
    expect(gapMeetsSetting(gap, "soft")).toBe(true);
    expect(gapMeetsSetting(gap, "full")).toBe(true);
  });

  it("Soft rejects the Big Gaps — gapOf(1, 5) === 4 is outside both settings", () => {
    expect(gapOf(1, 5)).toBe(4);
    expect(gapMeetsSetting(4, "soft")).toBe(false);
    expect(gapMeetsSetting(4, "full")).toBe(false);
    // Soft is the looser lens, never the stricter one: what Full accepts, Soft accepts.
    for (const gap of [0, 1, 2, 3, 4] as const) {
      if (gapMeetsSetting(gap, "full"))
        expect(gapMeetsSetting(gap, "soft"), `gap ${gap}`).toBe(true);
    }
  });
});

describe("one instance against its Setting", () => {
  it("reports ruth-sam aligned under Soft: every Gap is 0 or 1, and 1 is tolerated", () => {
    const verdict = instanceAlignment(aspectGapsOf(ruth), "soft");
    expect(verdict.setting).toBe("soft");
    expect(verdict.limit).toBe(1);
    expect(verdict.aligned).toBe(true);
    expect(verdict.unmet).toEqual([]);
  });

  it("reports the same instance unmet under Full: six Gaps of 1, named", () => {
    const verdict = instanceAlignment(aspectGapsOf(ruth), "full");
    expect(verdict.aligned).toBe(false);
    expect(verdict.limit).toBe(0);
    // The three Aspects whose own Feel and Wish differ by 1, on both parties.
    expect(verdict.unmet).toEqual([
      { itemId: "aspect-trust", kind: "initiator", gap: 1 },
      { itemId: "aspect-trust", kind: "counterparty", gap: 1 },
      { itemId: "aspect-one-to-one", kind: "initiator", gap: 1 },
      { itemId: "aspect-one-to-one", kind: "counterparty", gap: 1 },
      { itemId: "aspect-privacy", kind: "initiator", gap: 1 },
      { itemId: "aspect-privacy", kind: "counterparty", gap: 1 },
    ]);
  });

  it("does not count a kind the instance does not have — Basic has no prediction Gaps", () => {
    const verdict = instanceAlignment(aspectGapsOf(avery), "soft");
    expect(verdict.aligned).toBe(false);
    // The four Basic kinds only: an absent Think/Guess pair is never an unmet Gap.
    for (const unmet of verdict.unmet) {
      expect(BASIC_GAP_KINDS as readonly string[]).toContain(unmet.kind);
    }
    const advancedKinds = GAP_KINDS.filter(
      (kind) => !(BASIC_GAP_KINDS as readonly string[]).includes(kind),
    );
    for (const kind of advancedKinds) {
      expect(
        verdict.unmet.some((unmet) => unmet.kind === kind),
        kind,
      ).toBe(false);
    }
    // The numbers that break Soft on this fixture: 3, 2, 3, 2 on time-together and 2, 2 on
    // conflict — the Aspect-by-Aspect statement, not a single flag.
    expect(verdict.unmet.map((unmet) => [unmet.itemId, unmet.kind, unmet.gap])).toEqual([
      ["aspect-time-together", "feel", 3],
      ["aspect-time-together", "wish", 2],
      ["aspect-time-together", "initiator", 3],
      ["aspect-time-together", "counterparty", 2],
      ["aspect-conflict", "wish", 2],
      ["aspect-conflict", "initiator", 2],
    ]);
  });

  it("is aligned when there is nothing to be unmet about", () => {
    expect(instanceAlignment([], "full")).toEqual({
      setting: "full",
      limit: 0,
      aligned: true,
      unmet: [],
    });
  });

  it("reads a single 1-point Gap differently under the two settings", () => {
    const onePoint: AspectGaps[] = [{ itemId: "aspect-test", gaps: { feel: 1 } }];
    expect(instanceAlignment(onePoint, "soft").aligned).toBe(true);
    const full = instanceAlignment(onePoint, "full");
    expect(full.aligned).toBe(false);
    expect(full.unmet).toEqual([{ itemId: "aspect-test", kind: "feel", gap: 1 }]);
  });
});
