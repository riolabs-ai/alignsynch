/**
 * **A draft session is not a live session** (#1100b).
 *
 * The owner's ruling, and the four claims this file pins without a database:
 *
 *   * **the state is the seat.** `sessionStateOf()` is the one derivation: a relationship whose
 *     Counterparty has not joined (`draft`, `pending`) carries a `draft` session, and one where they
 *     have (`published`, `active`, `complete`, `void`, `expired`) carries a live one. The seed writes
 *     it, `db:verify` V33 reads it back from the `party` rows, and `claimInvite` flips it — so this
 *     table is the contract all three are held to.
 *   * **publishing is not accepting.** A `published` relationship has both seats and a sheet in
 *     progress: it is live. Counting it as a draft would delete the demo's "sent, being answered"
 *     screen, which is why the state is not `accepted`.
 *   * **a draft is invisible to the dashboard's counts.** `overviewCountsOf()` counts three
 *     predicates over `MyInstanceState`, and a `draft` row matches none of them — so the four numbers
 *     on `/dashboard` cannot report a session nobody has accepted, whichever read produced the row.
 *   * **a draft reads as a draft, never as a session with 0 answers.** `myInstanceStateOf()` answers
 *     `draft` before it looks at the viewer's answered count, so an unsent session with an empty
 *     sheet says "not sent yet" rather than "you owe six Aspects".
 *
 * Pure: fixtures and hand-built rows, no `pg`, no clock.
 */
import { describe, expect, it } from "vitest";

import { seededLifecycleOf, sessionStateOf } from "@/content/assessment";
import type { MyInstanceState } from "@/lib/flow/state";
import { assessmentInstances } from "@/data/assessments";
import type { MyInstance } from "@/lib/db/my-instances";
import {
  OVERVIEW_FILTERS,
  matchesOverviewFilter,
  overviewCountsOf,
  overviewFiltered,
} from "@/lib/flow/overview";
import { myInstanceStateOf } from "@/lib/flow/state";

/** The lifecycle each authored instance carries, through the model's one derivation. */
const lifecycles = assessmentInstances.map((instance) => ({
  id: instance.id,
  status: instance.lifecycle?.status ?? "complete",
  lifecycle: seededLifecycleOf(instance),
}));

describe("the state a lifecycle implies", () => {
  // The table, written once. `published` is the row that makes the rule visible: both seats, one
  // sheet part-filled, nobody accepted — and live, because the pair has started.
  const expected: Record<string, "draft" | "active"> = {
    draft: "draft",
    pending: "draft",
    published: "active",
    active: "active",
    complete: "active",
    void: "active",
    expired: "active",
  };

  it("maps every lifecycle word to the session state the seat implies", () => {
    for (const row of lifecycles) {
      expect({ status: row.status, state: sessionStateOf(row.lifecycle) }).toEqual({
        status: row.status,
        state: expected[row.status],
      });
    }
  });

  it("agrees with the seats, which is the fact the seed and db:verify share", () => {
    for (const row of lifecycles) {
      expect(sessionStateOf(row.lifecycle)).toBe(
        row.lifecycle.seats === "both" ? "active" : "draft",
      );
    }
  });

  it("carries both states on the demo dataset, so neither is unexercised", () => {
    const drafts = lifecycles.filter((row) => sessionStateOf(row.lifecycle) === "draft");
    const live = lifecycles.filter((row) => sessionStateOf(row.lifecycle) === "active");
    // Every draft session is a `draft` or a `pending` relationship — an invitation nobody has
    // accepted — and every live one is a relationship past the claim. Counted from the fixture
    // rather than hardcoded, and non-empty in both directions, because a dataset carrying only one
    // of them could not show the difference the state exists for.
    expect(new Set(drafts.map((row) => row.status))).toEqual(new Set(["draft", "pending"]));
    expect(drafts.length).toBeGreaterThan(0);
    for (const row of live) {
      expect(["published", "active", "complete", "void", "expired"]).toContain(row.status);
    }
    expect(live.length).toBeGreaterThan(drafts.length);
  });
});

describe("a draft session is invisible to the dashboard's counts", () => {
  /** A row as `listMyInstances()` produces it — the state is already derived from the rows. */
  function row(state: MyInstanceState, instanceRecordId: string): MyInstance {
    return {
      instanceRecordId,
      slug: instanceRecordId,
      templateTitle: "Relationship Basics",
      viewerRole: "initiator",
      viewerName: "Avery",
      otherName: null,
      state,
      unlock: "seen",
    };
  }

  it("matches none of the three filters, so no number counts it", () => {
    const draft = row("draft", "i-draft");
    for (const filter of OVERVIEW_FILTERS) {
      expect(matchesOverviewFilter(draft, filter)).toBe(false);
    }
    expect(overviewCountsOf([draft])).toEqual({
      "awaiting-other": 0,
      "yours-to-answer": 0,
      "reports-open": 0,
    });
    expect(overviewFiltered([draft], "yours-to-answer")).toEqual([]);
  });

  it("is not counted even beside live rows", () => {
    const rows = [row("draft", "i-draft"), row("yours-to-answer", "i-yours")];
    expect(overviewCountsOf(rows)["yours-to-answer"]).toBe(1);
    expect(overviewFiltered(rows, "yours-to-answer").map((r) => r.instanceRecordId)).toEqual([
      "i-yours",
    ]);
  });
});

describe("a draft reads as a draft, not as a session with 0 answers", () => {
  it("answers `draft` before it counts the viewer's sheet", () => {
    expect(
      myInstanceStateOf({
        aspectCount: 6,
        hasCounterparty: false,
        initiatorAnswered: 0,
        counterpartyAnswered: 0,
        initiatorAccepted: 0,
        counterpartyAccepted: 0,
        viewerRole: "initiator",
        // #975 — never published: the send did not happen.
        published: false,
      }),
    ).toBe("draft");
  });

  it("still says `yours-to-answer` once the invitation has gone out", () => {
    // The difference the state is *not* allowed to blur: a `pending` relationship has a draft
    // **session** and a sent invitation, so the person who created it does owe their sheet.
    expect(
      myInstanceStateOf({
        aspectCount: 6,
        hasCounterparty: false,
        initiatorAnswered: 0,
        counterpartyAnswered: 0,
        initiatorAccepted: 0,
        counterpartyAccepted: 0,
        viewerRole: "initiator",
        published: true,
      }),
    ).toBe("yours-to-answer");
  });
});
