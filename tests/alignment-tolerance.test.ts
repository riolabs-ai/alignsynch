/**
 * The Soft/Full Alignment Tolerance table (#1122).
 *
 * The card's QA gate names this exactly: "a vitest for the Soft/Full verdict table (gap 0 / 1 /
 * ≥2 × Soft / Full)". The table lives in `content/gaps.ts::alignmentStatusOf`, which is the one
 * place the 1-step case is decided, so the cases below are the row-by-row statement of it plus
 * the two invariants a re-score must never break:
 *
 *   same-word   a 1-step Gap keeps the words "Small Gap" under both tolerances — only the
 *               qualifier and the colour move, which is why the surface reads its chip from this
 *               function instead of from a colour ternary;
 *   subset      every Gap Full accepts Soft accepts too (Full is the stricter lens), so a screen
 *               can never show Full as *more* aligned than Soft.
 */
import { describe, expect, it } from "vitest";

import { SETTING_GAP_LIMITS, type AlignmentSetting } from "@/content/assessment";
import { ALIGNMENT_STATUSES, alignmentStatusOf, gapMeetsSetting } from "@/content/gaps";
import type { Gap } from "@/content/record";

const GAPS: readonly Gap[] = [0, 1, 2, 3, 4];

/** The table, written once as data so a case cannot be read off the implementation. */
const TABLE: Record<Gap, Record<AlignmentSetting, string>> = {
  0: { soft: "in-synch", full: "in-synch" },
  1: { soft: "small-gap-ok", full: "small-gap-tight" },
  2: { soft: "gap", full: "gap" },
  3: { soft: "gap", full: "gap" },
  4: { soft: "gap", full: "gap" },
};

describe("alignmentStatusOf — the Soft/Full verdict table", () => {
  for (const gap of GAPS) {
    for (const setting of ["soft", "full"] as const) {
      it(`gap ${gap} under ${setting} reads "${TABLE[gap][setting]}"`, () => {
        expect(alignmentStatusOf(gap, setting)).toBe(TABLE[gap][setting]);
      });
    }
  }

  it("keeps the word 'Small Gap' for a 1-step Gap under both tolerances", () => {
    // The two statuses differ, and both are the Small Gap: the tolerance moves the qualifier and
    // the colour, never the noun. Nothing else in the table may claim the 1-step case.
    const soft = alignmentStatusOf(1, "soft");
    const full = alignmentStatusOf(1, "full");
    expect(soft).toBe("small-gap-ok");
    expect(full).toBe("small-gap-tight");
    expect(soft).not.toBe(full);
  });

  it("is a subset: Full never accepts a Gap Soft refuses", () => {
    for (const gap of GAPS) {
      const fullAccepts = gapMeetsSetting(gap, "full");
      const softAccepts = gapMeetsSetting(gap, "soft");
      expect(fullAccepts && !softAccepts).toBe(false);
      // The two functions agree on the fact they both answer.
      expect(["in-synch", "small-gap-ok"].includes(alignmentStatusOf(gap, "full"))).toBe(
        fullAccepts,
      );
      expect(["in-synch", "small-gap-ok"].includes(alignmentStatusOf(gap, "soft"))).toBe(
        softAccepts,
      );
    }
  });

  it("derives its thresholds from the schema, not from a second copy of the table", () => {
    // Soft tolerates exactly one step, Full exactly none — the constants the table above encodes.
    expect(SETTING_GAP_LIMITS.soft).toBe(1);
    expect(SETTING_GAP_LIMITS.full).toBe(0);
    expect(alignmentStatusOf(SETTING_GAP_LIMITS.soft as Gap, "soft")).toBe("small-gap-ok");
    expect(alignmentStatusOf((SETTING_GAP_LIMITS.soft + 1) as Gap, "soft")).toBe("gap");
  });

  it("names four statuses, and the table uses all four", () => {
    const used = new Set(
      GAPS.map((gap) => alignmentStatusOf(gap, "soft")).concat(
        GAPS.map((gap) => alignmentStatusOf(gap, "full")),
      ),
    );
    expect([...used].sort()).toEqual([...ALIGNMENT_STATUSES].sort());
  });
});
