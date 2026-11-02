/**
 * The relationships surface's four derived rules, against the real seed fixtures.
 *
 * Every claim here is one the card has to keep true after this change:
 *
 *   personas   an initiator sees the relationships they started, a counterparty the ones they
 *              belong to, a coach the ones they coach, an admin all of them — and a visitor none;
 *   flags      Y/O/P/R are Gap *counts*, derived per render, and a relationship with no scored
 *              session reports `null` per column rather than `0` (absent is not zero);
 *   invite     pending / expired / accepted / not-sent from the stored token and expiry — no
 *              countdown, no clock in the component;
 *   blind      the answer gate refuses a coach, an admin and a visitor, and refuses a party who
 *              has already submitted, from the same pure function the server page and the client
 *              sheet both call.
 */
import { describe, expect, it } from "vitest";

import { seedRelationships, type V1Relationship } from "@/data/v1/fixtures";
import { answerGateFor, answerGateMessage } from "@/lib/v1/blind";
import {
  GAP_FLAG_COLUMNS,
  cardMetricsOf,
  gapFlagCountsOf,
  inviteStateOf,
  sessionCompleteOf,
} from "@/lib/v1/derive";
import { moneyVisibleTo, relationshipsVisibleTo } from "@/lib/v1/persona";

/** One fixed instant for the invite-window cases, so nothing here reads the wall clock. */
const NOW = Date.parse("2026-11-01T12:00:00.000Z");

const ids = (rows: readonly V1Relationship[]) => rows.map((rel) => rel.id);

const rel = (id: string): V1Relationship => {
  const found = seedRelationships.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no seed relationship "${id}"`);
  return found;
};

describe("who sees which relationship", () => {
  it("scopes the list per persona, from the store's rows", () => {
    expect(ids(relationshipsVisibleTo("initiator", seedRelationships))).toEqual([
      "rel-invited",
      "rel-connected-blind",
      // The shop's "before" seed: an unsubscribed relationship with no counterparty yet.
      // It is still one the initiator started, so it belongs in their list.
      "rel-unsubscribed",
    ]);
    expect(ids(relationshipsVisibleTo("counterparty", seedRelationships))).toEqual([
      "rel-connected-blind",
      "rel-aligned",
    ]);
    expect(ids(relationshipsVisibleTo("coach", seedRelationships))).toEqual([
      "rel-sharing-unmet",
      "rel-aligned",
    ]);
    expect(relationshipsVisibleTo("admin", seedRelationships)).toHaveLength(
      seedRelationships.length,
    );
    expect(relationshipsVisibleTo("visitor", seedRelationships)).toEqual([]);
    expect(relationshipsVisibleTo("service", seedRelationships)).toEqual([]);
  });

  it("gives the admin every row and the initiator only their own", () => {
    const admin = relationshipsVisibleTo("admin", seedRelationships);
    const initiator = relationshipsVisibleTo("initiator", seedRelationships);
    expect(admin.map((row) => row.id)).toEqual(seedRelationships.map((row) => row.id));
    expect(initiator.every((row) => row.initiatorName === "Jordan")).toBe(true);
  });
});

describe("the four flag columns", () => {
  it("reports null for a relationship with no scored session, never 0", () => {
    expect(sessionCompleteOf(rel("rel-connected-blind"))).toBe(false);
    expect(gapFlagCountsOf(rel("rel-connected-blind"))).toEqual({
      yellow: null,
      orange: null,
      pink: null,
      red: null,
    });
  });

  it("counts the Gaps at each magnitude once the session is scored", () => {
    // Ruth and Sam answered every Aspect identically, so the report is aligned and only the
    // four Feel/Wish kinds sit at magnitude 0 — 6 kinds (three Aspects × the two
    // Desires-To-Change kinds) sit at magnitude 1, and nothing is higher. A scored session is
    // real numbers, never the `null` above.
    expect(gapFlagCountsOf(rel("rel-aligned"))).toEqual({
      yellow: 6,
      orange: 0,
      pink: 0,
      red: 0,
    });

    // Noor and Iris (Advanced Mode, four Aspects) carry all four magnitudes at once. These are
    // the same numbers `tests/v1-flag-counts.test.ts` asserts on `main`: both suites now read
    // the one derivation in `content/gaps.ts`, so a disagreement between them would be a
    // defect rather than a fixture change.
    const advanced = gapFlagCountsOf(rel("rel-advanced"));
    expect(advanced).toEqual({ yellow: 9, orange: 9, pink: 9, red: 4 });
    expect(GAP_FLAG_COLUMNS.map((column) => advanced[column])).toEqual([9, 9, 9, 4]);
  });
});

describe("the invite's honest state", () => {
  it("derives pending, expired and accepted from the stored token, not a countdown", () => {
    const invited = rel("rel-invited"); // token set, expiry 2026-10-31T09:00Z
    expect(inviteStateOf(invited, NOW)).toBe("expired");
    expect(inviteStateOf(invited, Date.parse("2026-10-30T12:00:00.000Z"))).toBe("pending");
    expect(inviteStateOf({ ...invited, inviteExpiresAt: null }, NOW)).toBe("pending");
    expect(inviteStateOf(rel("rel-aligned"), NOW)).toBe("accepted");
    expect(inviteStateOf({ ...invited, inviteToken: null }, NOW)).toBe("not-sent");
  });
});

describe("the answer gate — the blind rule, in one function", () => {
  it("refuses a coach, an admin and a visitor: they have no answer form", () => {
    const blind = rel("rel-connected-blind");
    for (const persona of ["coach", "admin", "visitor", "service"]) {
      expect(answerGateFor(blind, persona)).toBe("not-a-party");
    }
    expect(answerGateMessage("not-a-party", blind)).toContain("no answer form");
  });

  it("refuses the party who already submitted, and opens for the one who has not", () => {
    const blind = rel("rel-connected-blind"); // initiator submitted, counterparty has not
    expect(answerGateFor(blind, "initiator")).toBe("already-submitted");
    expect(answerGateFor(blind, "counterparty")).toBeNull();
  });

  it("refuses both parties on a scored relationship — until a new session opens", () => {
    const aligned = rel("rel-aligned");
    expect(answerGateFor(aligned, "initiator")).toBe("already-submitted");
    expect(answerGateFor(aligned, "counterparty")).toBe("already-submitted");
    expect(answerGateMessage("already-submitted", aligned)).toContain("Both of you");
  });
});

describe("the card's metric row — the My Quizzes translation, honestly", () => {
  it("reports no completion rate and no alignment for a relationship with no session", () => {
    // Jordan's invited relationship: nothing has opened, so there is no rate to print. `null`
    // becomes `—` on the card; a `0` here would be a rate nobody measured.
    const metrics = cardMetricsOf(rel("rel-invited"));
    expect(metrics.openedSessions).toBe(0);
    expect(metrics.completionPercent).toBeNull();
    expect(metrics.averageAlignment).toBeNull();
    expect(metrics.aspectCount).toBe(rel("rel-invited").items.length);
  });

  it("prints a real 0% completion and still no alignment while a session is open", () => {
    // One session opened, none completed, and only the initiator has answered: 0% is measured,
    // the mean Gap is not (the blind rule still holds).
    const metrics = cardMetricsOf(rel("rel-connected-blind"));
    expect(metrics.openedSessions).toBe(1);
    expect(metrics.completedSessions).toBe(0);
    expect(metrics.completionPercent).toBe(0);
    expect(metrics.averageAlignment).toBeNull();
  });

  it("derives completion and the mean Gap once both parties accept", () => {
    const aligned = cardMetricsOf(rel("rel-aligned"));
    expect(aligned.openedSessions).toBe(2);
    expect(aligned.completedSessions).toBe(2);
    expect(aligned.completionPercent).toBe(100);
    // Ruth and Sam are Basic Mode — 16 measured kinds over four Aspects — and answered every
    // Aspect identically, so every cross-party and prediction Gap is 0 and only each party's own
    // Feel-vs-Wish pair sits at 1: six of 16, never a stored number.
    expect(rel("rel-aligned").mode).toBe("basic");
    expect(aligned.averageAlignment).toBeCloseTo(6 / 16, 5);
    expect(aligned.averageAlignment).not.toBeNull();
    expect(aligned.aspectCount).toBe(4);

    const advanced = cardMetricsOf(rel("rel-advanced"));
    expect(advanced.openedSessions).toBe(4);
    expect(advanced.completionPercent).toBe(100);
    // Advanced Mode measures 32 kinds per four Aspects; Noor and Iris sit 70 apart in total.
    expect(advanced.averageAlignment).toBeCloseTo(70 / 32, 5);
    expect(advanced.aspectCount).toBe(4);
  });

  it("rounds a completion rate to a whole percent and never divides by zero", () => {
    const partial = { ...rel("rel-invited"), openedSessions: 3, completedSessions: 2 };
    expect(cardMetricsOf(partial).completionPercent).toBe(67);
  });
});

describe("what was paid is the Initiator's line alone", () => {
  it("has a money field for the initiator and for no other persona", () => {
    expect(moneyVisibleTo("initiator")).toBe(true);
    expect(moneyVisibleTo("counterparty")).toBe(false);
    expect(moneyVisibleTo("coach")).toBe(false);
    expect(moneyVisibleTo("admin")).toBe(false);
  });
});
