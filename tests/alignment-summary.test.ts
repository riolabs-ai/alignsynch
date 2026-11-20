/**
 * `lib/member/alignment-summary.ts` — the figure and the Next Step a member's screens print.
 *
 * The module's own docstring promised this file and it did not exist, so the two numbers it
 * computes had no statement anywhere: *"N of M Aspects Aligned"* and *"the widest Gap to talk
 * about"*. Both are read by the relationship card, the Start page's headline and the Align summary
 * on a relationship, so a wrong number here is a wrong number in three places.
 *
 * A Basic session measures four kinds (`GAP_KIND_SOURCES`): `feel` (initiator's feel vs the
 * counterparty's), `wish` (the same pair on want), and `initiator` / `counterparty` (each party's
 * own feel vs their own wish). So an Aspect where both parties share one score has all four at 0,
 * and a pair one step apart has `feel` and `wish` at 1.
 *
 * The cases state the two rules the module documents:
 *
 *   aligned   the **Setting** decides it — under Soft a 1-step Small Gap is aligned, under Full it
 *             is not. Counting `inSynch` alone (what this did before) printed the Full answer under
 *             Soft and left the summary's own line unable to add up.
 *   nextStep  the widest Gap, Wish before Feel on a tie, then the Aspects' authored order — and
 *             `null` when every Gap is inside the tolerance, because a finished Align has nothing
 *             to talk about.
 */
import { describe, expect, it } from "vitest";

import type { Opinions } from "@/content/assessment";
import { type AspectAnswers, alignmentSummaryOf } from "@/lib/member/alignment-summary";

/** One Aspect's two answer sheets, in the model's units. */
function aspect(
  position: number,
  prompt: string,
  initiator: Opinions,
  counterparty: Opinions,
): AspectAnswers {
  return { itemId: `item-${String(position)}`, position, prompt, initiator, counterparty };
}

/** Both parties agree with each other and with themselves — all four Gaps at 0. */
function agreed(score: 1 | 2 | 3 | 4 | 5): Opinions {
  return { feel: score, wish: score };
}

describe("alignmentSummaryOf — the tally", () => {
  it("counts one Aspect per status word, its worst Gap deciding the word", () => {
    const summary = alignmentSummaryOf("soft", [
      aspect(1, "Contact Frequency", agreed(3), agreed(3)),
      /* One step apart on both kinds: a Small Gap under Soft. */
      aspect(2, "Old Roles", agreed(3), agreed(4)),
      /* Two steps apart: a Gap whatever the Setting. */
      aspect(3, "Parent Decisions", agreed(3), agreed(5)),
    ]);

    expect(summary.tally).toEqual({ inSynch: 1, smallGap: 1, gap: 1 });
    expect(summary.total).toBe(3);
    expect(summary.aligned).toBe(2);
  });

  it("counts a Small Gap as aligned under Soft and not under Full", () => {
    const answers = [
      aspect(1, "Showing Up", agreed(4), agreed(4)),
      aspect(2, "Old Roles", agreed(4), agreed(3)),
    ];

    /* One In Synch plus one 1-step Gap: Soft's tolerance is 1, so both Aspects are aligned. */
    const soft = alignmentSummaryOf("soft", answers);
    expect(soft.tally).toEqual({ inSynch: 1, smallGap: 1, gap: 0 });
    expect(soft.aligned).toBe(2);

    /* Full's tolerance is 0: the same answer is a Gap the Setting does not accept. */
    const full = alignmentSummaryOf("full", answers);
    expect(full.tally).toEqual({ inSynch: 1, smallGap: 1, gap: 0 });
    expect(full.aligned).toBe(1);
  });

  it("never counts an Aspect with a 2-step Gap as aligned, under either Setting", () => {
    const answers = [aspect(1, "Parent Decisions", agreed(4), agreed(2))];

    for (const setting of ["soft", "full"] as const) {
      const summary = alignmentSummaryOf(setting, answers);
      expect(summary.aligned, setting).toBe(0);
      expect(summary.tally.gap, setting).toBe(1);
    }
  });
});

describe("alignmentSummaryOf — the Next Step", () => {
  it("names the widest Gap, its Aspect, its kind and how many steps it is", () => {
    const summary = alignmentSummaryOf("soft", [
      aspect(1, "Contact Frequency", agreed(3), agreed(2)),
      /* Feel 3 apart and Wish 0: this is a Feel Gap, and the widest one. */
      aspect(2, "Old Roles", { feel: 2, wish: 4 }, { feel: 5, wish: 4 }),
    ]);

    expect(summary.nextStep).toEqual({
      itemId: "item-2",
      prompt: "Old Roles",
      kind: "feel",
      gap: 3,
    });
  });

  it("prefers Wish over Feel where two kinds are equally wide", () => {
    const summary = alignmentSummaryOf("soft", [
      /* Feel 2 apart and Wish 2 apart on the same Aspect: the conversation to have is about what
         each person wants, not about how they feel today. */
      aspect(1, "Feeling Respected", { feel: 4, wish: 5 }, { feel: 2, wish: 3 }),
    ]);

    expect(summary.nextStep?.kind).toBe("wish");
    expect(summary.nextStep?.gap).toBe(2);
  });

  it("falls back to the authored Aspect order when width and kind tie", () => {
    const summary = alignmentSummaryOf("soft", [
      aspect(2, "Old Roles", agreed(3), agreed(1)),
      aspect(1, "Showing Up", agreed(3), agreed(1)),
    ]);

    /* The answers arrive in a different order from the authorship: position decides, not input. */
    expect(summary.nextStep?.prompt).toBe("Showing Up");
  });

  it("has no Next Step when every Gap is inside the tolerance", () => {
    const summary = alignmentSummaryOf("soft", [
      aspect(1, "Showing Up", agreed(5), agreed(5)),
      aspect(2, "Old Roles", agreed(4), agreed(3)),
    ]);

    expect(summary.nextStep).toBeNull();
    expect(summary.aligned).toBe(summary.total);
  });

  it("offers the 1-step Gap under Full, which Soft leaves alone", () => {
    const answers = [aspect(1, "Old Roles", agreed(4), agreed(3))];

    expect(alignmentSummaryOf("soft", answers).nextStep).toBeNull();
    expect(alignmentSummaryOf("full", answers).nextStep?.gap).toBe(1);
  });
});
