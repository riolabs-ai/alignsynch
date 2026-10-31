/**
 * The console Overview's counts are counts, and they are the same numbers the lists behind them
 * render (Console 2/5).
 *
 * Four claims, each one a line of the card:
 *
 *   * **per-viewer, from real rows** — a count is `overviewCountsOf()` over `MyInstance[]`, and the
 *     only rows that exist are the ones `listMyInstances(user.userId)` returned. Nothing here
 *     reads a fixture metric, and there is no field on the result a label could be formatted into:
 *     the values are `number`.
 *   * **each count equals the list it links to** — `overviewCountsOf(rows)[f]` and
 *     `overviewFiltered(rows, f).length` are asserted equal for every state, because they are two
 *     passes over one array through one predicate. That is the property that makes "click through
 *     and the list's length matches" true by construction rather than by care.
 *   * **the blind rule** — an instance where the other party has answered and the viewer has not
 *     is `yours-to-answer`, which counts the *viewer's* obligation and says nothing about the other
 *     party's progress. The other direction (`awaiting-other`) is asserted to carry no count of
 *     the other party's answers, and the copy is asserted to hold no such sentence.
 *   * **the empty state is honest** — no authorised figure anywhere in the fixture, and the three
 *     relationship filters plus the templates card are the only four numbers the surface can draw.
 *
 * Pure: hand-built rows, no database, no session, no clock.
 */
import { describe, expect, it } from "vitest";

import { overviewPageCopy } from "@/data/pages/overview";
import { myInstancesPageCopy } from "@/data/pages/assessment-instances";
import type { MyInstance } from "@/lib/db/my-instances";
import {
  OVERVIEW_FILTERS,
  matchesOverviewFilter,
  overviewCountsOf,
  overviewFilterOf,
  overviewFilterPath,
  overviewFiltered,
} from "@/lib/flow/overview";
import { MY_INSTANCES_PATH } from "@/lib/flow/paths";
import { myInstanceStateOf } from "@/lib/flow/state";

/** A row as the read produces it: the state is already derived from the counts. */
function row(overrides: Partial<MyInstance>): MyInstance {
  return {
    instanceRecordId: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    templateTitle: "Relationship Basics",
    viewerRole: "initiator",
    viewerName: "Avery",
    otherName: "Rowan",
    state: "yours-to-answer",
    unlock: "seen",
    ...overrides,
  };
}

const awaiting = row({ instanceRecordId: "i-awaiting", state: "awaiting-other" });
const yours = row({ instanceRecordId: "i-yours", state: "yours-to-answer" });
const openReport = row({ instanceRecordId: "i-open", state: "complete", unlock: "unseen" });
const readReport = row({ instanceRecordId: "i-read", state: "complete", unlock: "seen" });

describe("the four counts", () => {
  it("counts each state, and a complete report the viewer has already read is in none of them", () => {
    const counts = overviewCountsOf([awaiting, yours, openReport, readReport]);

    expect(counts).toEqual({ "awaiting-other": 1, "yours-to-answer": 1, "reports-open": 1 });
  });

  it("is zero for an account with no rows — not a missing value, a real zero", () => {
    expect(overviewCountsOf([])).toEqual({
      "awaiting-other": 0,
      "yours-to-answer": 0,
      "reports-open": 0,
    });
  });

  it("equals the list it links to, for every filter, over every state", () => {
    const rows = [awaiting, yours, openReport, readReport];
    const counts = overviewCountsOf(rows);

    for (const filter of OVERVIEW_FILTERS) {
      // The card's figure and the list's length, from the one predicate.
      expect(counts[filter]).toBe(overviewFiltered(rows, filter).length);
      expect(overviewFiltered(rows, filter).length).toBe(
        rows.filter((instance) => matchesOverviewFilter(instance, filter)).length,
      );
    }

    // And the three lists are disjoint: one row cannot appear under two cards, which is what
    // makes each figure a question with its own answer rather than a share of a total.
    const seen = new Set<string>();
    for (const filter of OVERVIEW_FILTERS) {
      for (const instance of overviewFiltered(rows, filter)) {
        expect(seen.has(instance.instanceRecordId)).toBe(false);
        seen.add(instance.instanceRecordId);
      }
    }
  });
});

describe("the blind rule on the Overview", () => {
  it("a viewer who has not answered is `yours-to-answer`, never a count of the other party's answers", () => {
    // The other party has answered all three Aspects; this viewer has answered none. This is the
    // exact state that must not be visible as progress anywhere.
    const state = myInstanceStateOf({
      aspectCount: 3,
      hasCounterparty: true,
      initiatorAnswered: 0,
      counterpartyAnswered: 3,
      viewerRole: "initiator",
    });

    expect(state).toBe("yours-to-answer");
    const counts = overviewCountsOf([row({ state })]);
    expect(counts["yours-to-answer"]).toBe(1);
    expect(counts["awaiting-other"]).toBe(0);
    expect(counts["reports-open"]).toBe(0);
  });

  it("`awaiting-other` is the mirror case, and still carries no figure about them", () => {
    const state = myInstanceStateOf({
      aspectCount: 3,
      hasCounterparty: true,
      initiatorAnswered: 3,
      counterpartyAnswered: 1,
      viewerRole: "initiator",
    });

    expect(state).toBe("awaiting-other");
    const counts = overviewCountsOf([row({ state })]);
    expect(counts).toEqual({ "awaiting-other": 1, "yours-to-answer": 0, "reports-open": 0 });

    // The count is 1 (one relationship). The other party's answered total — 1 — is not in the
    // result at all: `overviewCountsOf` returns three numbers, and none of them is a count of
    // opinions.
    expect(Object.keys(counts).sort()).toEqual([...OVERVIEW_FILTERS].sort());
  });

  it("no sentence on the surface states how far the other party has got", () => {
    const text = JSON.stringify(overviewPageCopy);

    // No authored figure anywhere (the only digits a reader sees are the counts, which the page
    // computes), and no wording that reports the other party's progress.
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/answered \d|\d of \d|percent|%|average|total/i);
    expect(text).not.toMatch(/their answers|their score|gap of/i);
  });
});

describe("the filter contract between the card and the list", () => {
  it("every filter the card counts is a label the card can draw and a list the list page can name", () => {
    const counts = overviewPageCopy.sections?.find((section) => section.id === "counts");
    const filters = myInstancesPageCopy.sections?.find((section) => section.id === "filter");

    for (const filter of OVERVIEW_FILTERS) {
      expect((counts?.items ?? []).map((item) => item.id)).toContain(filter);
      expect((filters?.items ?? []).map((item) => item.id)).toContain(filter);
    }
  });

  it("links each card to the filtered list, on the list's own path", () => {
    for (const filter of OVERVIEW_FILTERS) {
      expect(overviewFilterPath(filter)).toBe(`${MY_INSTANCES_PATH}?filter=${filter}`);
    }
  });

  it("refuses a value nobody recognises instead of drawing an empty filtered list", () => {
    expect(overviewFilterOf("awaiting-other")).toBe("awaiting-other");
    expect(overviewFilterOf("every-relationship")).toBeNull();
    expect(overviewFilterOf("REPORTS-OPEN")).toBeNull();
    expect(overviewFilterOf(["awaiting-other", "yours-to-answer"])).toBeNull();
    expect(overviewFilterOf(undefined)).toBeNull();
    expect(overviewFilterOf(null)).toBeNull();
    expect(overviewFilterOf("")).toBeNull();
  });
});
