/**
 * `/admin/gaps` — the arithmetic and the markup (`console-ia.md` §3.7, card 4 of 5).
 *
 * Four things are pinned here, and each is one of the screen's honesty rules turned into a
 * question a machine can answer:
 *
 *   population   a Setting with one complete relationship is **withheld**, not charted: the
 *                aggregate carries the numbers but `chartable` is false, and the rendered page
 *                prints the sentence with the count and the floor instead of a median.
 *   eight kinds  every kind is a row in every Setting — measured, or unmeasured with a reason.
 *                The four prediction kinds are absent on Basic-only data with `no-advanced`,
 *                never 0 (a 0 would print In Synch about a question nobody asked).
 *   statistic    the centre is the ordinal median: the first size at which half the Gaps are at
 *                or below it. The sample's Feel Gaps are 3, 2, 1, 1, 1, 1 — a mean of 1.5, a
 *                Gap that does not exist — and the screen prints 1.
 *   nameless     the population type has no party field and the rendered HTML contains no
 *                instance id, so the screen cannot name a relationship even by accident.
 *
 * The fixture is three complete Soft Basic relationships and one complete Full Advanced one —
 * the shape the demo database has (three Soft, one Full). Every number asserted below is counted
 * from the rows in this file by hand, which is what makes the assertions a check on the
 * arithmetic rather than a snapshot of it.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminGapsView } from "@/components/console/gap-analysis";
import { GAP_KINDS } from "@/content/gaps";
import { pageCopies } from "@/data/pages";
import {
  aggregateGapPopulation,
  MIN_COMPLETE_INSTANCES,
  ordinalMedian,
  type GapAspect,
  type GapInstance,
  type GapOpinions,
} from "@/lib/admin/gap-aggregates";

/** One party's answers about one Aspect, with no prediction unless it is an Advanced instance. */
function answers(feel: number, wish: number, think?: number, guess?: number): GapOpinions {
  return {
    feel: feel as never,
    wish: wish as never,
    ...(think === undefined || guess === undefined
      ? {}
      : { think: think as never, guess: guess as never }),
  };
}

/** One Aspect: both parties' answers. */
function aspect(itemId: string, initiator: GapOpinions, counterparty: GapOpinions): GapAspect {
  return { itemId, initiator, counterparty };
}

/* ------------------------------------------------------------------ *
 * The population: three Soft Basic relationships, one Full Advanced
 * ------------------------------------------------------------------ */

/**
 * Soft, Basic. Feel Gaps 3 and 2, so it carries Gaps wider than Soft's 1 → unmet.
 *   a  5/4 vs 2/4  feel 3  wish 0  initiator 1  counterparty 2
 *   b  4/4 vs 2/2  feel 2  wish 2  initiator 0  counterparty 0
 */
const SOFT_ONE: GapInstance = {
  instanceId: "soft-one",
  setting: "soft",
  aspects: [aspect("a", answers(5, 4), answers(2, 4)), aspect("b", answers(4, 4), answers(2, 2))],
};

/**
 * Soft, Basic, aligned: every Gap is 0 or 1.
 *   a  4/4 vs 3/4  feel 1  wish 0  initiator 0  counterparty 1
 *   b  3/3 vs 2/2  feel 1  wish 1  initiator 0  counterparty 0
 */
const SOFT_TWO: GapInstance = {
  instanceId: "soft-two",
  setting: "soft",
  aspects: [aspect("a", answers(4, 4), answers(3, 4)), aspect("b", answers(3, 3), answers(2, 2))],
};

/**
 * Soft, Basic, aligned: every Gap is 0 or 1 again.
 *   a  2/2 vs 3/2  feel 1  wish 0  initiator 0  counterparty 1
 *   b  2/2 vs 1/1  feel 1  wish 1  initiator 0  counterparty 0
 */
const SOFT_THREE: GapInstance = {
  instanceId: "soft-three",
  setting: "soft",
  aspects: [aspect("a", answers(2, 2), answers(3, 2)), aspect("b", answers(2, 2), answers(1, 1))],
};

/**
 * Full, Advanced — the only relationship with a prediction, and the only one under Full, so its
 * section is below the population floor and every kind in it is withheld.
 *   a  4/4 think 2 guess 3 vs 4/4 think 3 guess 2
 *      feel 0 wish 0 initiator 0 counterparty 0 init-think 2 init-guess 1
 *      cp-think 1 cp-guess 2
 *   b  2/2 think 2 guess 2 vs 2/2 think 4 guess 4
 *      feel 0 wish 0 initiator 0 counterparty 0 init-think 0 init-guess 0
 *      cp-think 2 cp-guess 2
 */
const FULL_ADVANCED: GapInstance = {
  instanceId: "full-one",
  setting: "full",
  aspects: [
    aspect("a", answers(4, 4, 2, 3), answers(4, 4, 3, 2)),
    aspect("b", answers(2, 2, 2, 2), answers(2, 2, 4, 4)),
  ],
};

const POPULATION = {
  instances: [SOFT_ONE, SOFT_TWO, SOFT_THREE, FULL_ADVANCED],
  excluded: 2,
  total: 6,
};

/** The Feel Gaps of the three Soft relationships, counted from the four rows above. */
const FEEL_GAPS: readonly number[] = [3, 2, 1, 1, 1, 1];

/** The screen, rendered: what a reader and a grep both see. */
function render(population = POPULATION): string {
  const copy = pageCopies["/admin/gaps"];
  if (copy === undefined) throw new Error('no PageCopy fixture for "/admin/gaps"');
  const aggregate = aggregateGapPopulation(population);
  return renderToStaticMarkup(createElement(AdminGapsView, { copy, aggregate }));
}

/** One Setting's section of the HTML. */
function settingSection(html: string, setting: "soft" | "full"): string {
  const match = html.match(
    new RegExp(`<section data-gap-setting="${setting}"[\\s\\S]*?</section>`),
  );
  if (match === null) throw new Error(`no ${setting} section in the render`);
  return match[0];
}

/**
 * The body cells of one kind's row, as text.
 *
 * The row is found by its attributes rather than by their position in the tag: the row now comes
 * from `components/ui/table.tsx`, whose `TableRow` emits `class` before the props it is handed,
 * so `<tr data-gap-kind=` is an assertion about the primitive's attribute order rather than about
 * the screen. The attributes themselves are still the contract.
 */
function rowCells(section: string, kind: string): string[] {
  const match = section.match(
    new RegExp(`<tr [^>]*data-gap-kind="${kind}"[^>]*>([\\s\\S]*?)</tr>`),
  );
  if (match === null) throw new Error(`no row for kind "${kind}"`);
  return [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
    cell[1].replace(/<[^>]*>/g, "").trim(),
  );
}

describe("the ordinal median", () => {
  it("reports a size the model has, never the midpoint of two of them", () => {
    expect(ordinalMedian([0, 1, 2, 4])).toBe(1);
    expect(ordinalMedian([0, 3])).toBe(0);
    expect(ordinalMedian([4])).toBe(4);
    // The averaging middle of [0, 1, 2, 4] is 1.5 — a Gap the model does not contain.
    expect(Number.isInteger(ordinalMedian([0, 1, 2, 4]))).toBe(true);
  });

  it("refuses an empty population instead of inventing a centre", () => {
    expect(() => ordinalMedian([])).toThrow(/no values/);
  });
});

describe("the population is complete relationships only", () => {
  const aggregate = aggregateGapPopulation(POPULATION);

  it("counts what is in it and states what was left out", () => {
    expect(aggregate.complete).toBe(4);
    expect(aggregate.excluded).toBe(2);
    expect(aggregate.total).toBe(6);
    expect(aggregate.floor).toBe(MIN_COMPLETE_INSTANCES);
  });

  it("never adds a Soft relationship to a Full one — each Setting is its own section", () => {
    const [soft, full] = aggregate.settings;
    expect(soft?.setting).toBe("soft");
    expect(soft?.instances).toBe(3);
    expect(full?.setting).toBe("full");
    expect(full?.instances).toBe(1);
    // 3 relationships × 2 Aspects × 4 Basic kinds, and 1 × 2 × 8 kinds.
    expect(soft?.gaps).toBe(24);
    expect(full?.gaps).toBe(16);
  });

  it("judges each relationship under its own Setting, and counts aligned and unmet", () => {
    const [soft, full] = aggregate.settings;
    // Soft tolerates a Gap of 1: soft-one's Feel Gaps of 3 and 2 are unmet, the other two align.
    expect(soft?.aligned).toBe(2);
    expect(soft?.unmet).toBe(1);
    expect(soft?.limit).toBe(1);
    // Full tolerates only 0. It has one relationship, so its outcome is withheld with the rest.
    expect(full?.aligned).toBeNull();
    expect(full?.unmet).toBeNull();
    expect(full?.limit).toBe(0);
  });
});

describe("the eight kinds are eight rows, measured or absent with a reason", () => {
  const aggregate = aggregateGapPopulation(POPULATION);
  const soft = aggregate.settings[0];
  const full = aggregate.settings[1];
  if (soft === undefined || full === undefined) throw new Error("both Settings must be present");

  it("keeps the glossary's order and never a ninth kind", () => {
    expect(soft.kinds.map((row) => row.kind)).toEqual([...GAP_KINDS]);
    expect(full.kinds.map((row) => row.kind)).toEqual([...GAP_KINDS]);
    expect(GAP_KINDS).toHaveLength(8);
  });

  it("measures the four Basic kinds on Basic data and reports the four prediction kinds absent", () => {
    const measured = soft.kinds.filter((row) => row.reading.state === "measured");
    expect(measured.map((row) => row.kind)).toEqual(["feel", "wish", "initiator", "counterparty"]);
    for (const kind of [
      "initiator-think",
      "initiator-guess",
      "counterparty-think",
      "counterparty-guess",
    ]) {
      const row = soft.kinds.find((candidate) => candidate.kind === kind);
      expect(row?.reading).toEqual({ state: "unmeasured", reason: "no-advanced" });
    }
  });

  it("summarises the six Feel Gaps by median and range, not by a mean of 1.5", () => {
    const feel = soft.kinds.find((row) => row.kind === "feel")?.reading;
    expect(feel).toEqual({
      state: "measured",
      instances: 3,
      count: 6,
      // Sorted: 1, 1, 1, 1, 2, 3 — the first size at which half are at or below is 1.
      median: 1,
      min: 1,
      max: 3,
      histogram: [0, 4, 1, 1, 0],
    });
    // The number the screen refuses to print: the arithmetic middle of the same six Gaps.
    const mean = FEEL_GAPS.reduce((sum, gap) => sum + gap, 0) / FEEL_GAPS.length;
    expect(mean).toBe(1.5);
    if (feel?.state !== "measured") throw new Error("feel must be measured");
    expect(feel.median).not.toBe(mean);
  });

  it("withholds every kind when a Setting has fewer relationships than the floor", () => {
    expect(full.chartable).toBe(false);
    for (const row of full.kinds) {
      expect(row.reading).toEqual({ state: "unmeasured", reason: "withheld" });
    }
    // The numbers exist — they are simply not drawn: the withhold is a decision, not a gap.
    expect(full.gaps).toBe(16);
  });

  it("says how many Gaps each kind was counted from", () => {
    const wish = soft.kinds.find((row) => row.kind === "wish")?.reading;
    expect(wish?.state).toBe("measured");
    if (wish?.state !== "measured") return;
    expect(wish.count).toBe(6);
    expect(wish.histogram.reduce((sum, count) => sum + count, 0)).toBe(wish.count);
    // Wishes: 0 and 2, 0 and 1, 0 and 1 → three 0s, two 1s, one 2.
    expect(wish.histogram).toEqual([3, 2, 1, 0, 0]);
  });
});

describe("the rendered screen", () => {
  const html = render();
  const soft = settingSection(html, "soft");
  const full = settingSection(html, "full");

  it("names all eight kinds in both Settings", () => {
    for (const section of [soft, full]) {
      for (const kind of GAP_KINDS) {
        expect(section).toContain(`data-gap-kind="${kind}"`);
      }
    }
  });

  it("prints the median and the range for a measured kind, not a mean", () => {
    const cells = rowCells(soft, "feel");
    // Kind · Gaps · Median · Range · at-each-size
    expect(cells[1]).toBe("6");
    expect(cells[2]).toBe("1");
    expect(cells[3]).toBe("1–3");
    expect(cells[4]).toBe("0 / 4 / 1 / 1 / 0");
    expect(cells).not.toContain("1.5");
  });

  it("prints the absence reason where a kind has no reading", () => {
    const cells = rowCells(soft, "initiator-think");
    expect(cells).toHaveLength(2);
    expect(cells[1]).toContain("no Advanced relationship here");
  });

  it("says the population is too small instead of charting one row", () => {
    expect(full).toContain("Not charted: 1 finished under Full");
    expect(full).toContain("a distribution is read from 3");
    expect(full).toContain("16 Gaps measured in this one relationship");
    for (const row of full.matchAll(/<tr [^>]*data-gap-kind="[^"]+"[^>]*data-gap-state="(\w+)"/g)) {
      expect(row[1]).toBe("unmeasured");
    }
    // Four rows have a reading (the Soft Basic kinds) and twelve do not — eight withheld under
    // Full plus the four prediction kinds under Soft.
    expect((html.match(/data-gap-state="measured"/g) ?? []).length).toBe(4);
    expect((html.match(/data-gap-state="unmeasured"/g) ?? []).length).toBe(12);
  });

  it("says so when a Setting has no complete relationship at all", () => {
    const empty = render({ instances: [], excluded: 3, total: 3 });
    expect(empty).toContain("No relationship has been finished under Soft yet.");
    expect(empty).toContain("No relationship has been finished under Full yet.");
  });

  it("never prints a party or an instance — the population has neither", () => {
    for (const instance of POPULATION.instances) {
      expect(html).not.toContain(instance.instanceId);
    }
    // …and no placeholder the fixture left unfilled.
    expect(html).not.toMatch(/\{[a-z]+\}/);
  });
});
