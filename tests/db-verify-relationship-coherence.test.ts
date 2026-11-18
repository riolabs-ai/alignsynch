/**
 * V31 — a seeded relationship carries the lifecycle its **dataset authors** (#975, #1079).
 *
 * The defect this was written for was measured on the demo branch and named by the UX walk behind
 * #975: `relationship.status` read `draft` on all four seeded relationships (0030's default, which
 * the seed never overwrote) while every one of them had both seats answered and both acceptances
 * stamped — so `/dashboard/relationships/<id>` said **"Not sent yet — nothing has been invited or
 * charged"** over a report drawing six Gaps, and `/assessments` said the pair had accepted.
 * `session_invite` held **0 rows**, so `/invite/<token>` could only answer "No such invitation".
 * V21 asserted the session and was green throughout: the two rows that describe one pair were never
 * compared.
 *
 * #1079 moved the expectation: the dataset authors seven lifecycle words, each with its own row set,
 * so the rule compares a row against the lifecycle it should carry rather than against "complete".
 * These cases pin both directions — a row that disagrees with its dataset is named, and a row that
 * agrees with a *non-finished* lifecycle passes.
 *
 * The rule is `seededRelationshipProblems()` in `scripts/db-verify.mjs`, exported so these cases can
 * drive it with literals — the gate is database-free (`docs/operations/gate.md`), and a check that
 * needs a branch is a check that runs after the merge.
 */
import { describe, expect, it } from "vitest";
import { seededLifecycleOf, type DerivedLifecycle } from "@/content/assessment";

import {
  seededRelationshipCoherenceProblems,
  seededRelationshipProblems,
} from "../scripts/db-verify.mjs";

const AT = "2026-10-28T18:30:00.000Z";

/** The lifecycle one status derives, through the model's own function. */
function expectedOfStatus(status: string, extra: Record<string, unknown> = {}): DerivedLifecycle {
  return seededLifecycleOf({ date: AT, lifecycle: { status, ...extra } as never });
}

/**
 * One row of `SEEDED_RELATIONSHIP_SQL`, as `pg` returns it, plus the lifecycle the dataset authors
 * (`expected`). Written as `db:seed` leaves a seeded relationship.
 */
interface CoherenceRow {
  record_id: string;
  slug: string;
  relationship_id: string | null;
  relationship_status: string;
  published_at: Date | string | null;
  completed_at: Date | string | null;
  expired_at: Date | string | null;
  lapse_reason: string | null;
  void_reason: string | null;
  invite_present: boolean;
  invite_claimed: boolean;
  counterparties: number;
  expected: DerivedLifecycle | undefined;
}

function coherentRow(overrides: Partial<CoherenceRow> = {}): CoherenceRow {
  const expected = expectedOfStatus("complete", { plan: "basic" });
  return {
    record_id: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    relationship_id: "relationship-assessment-instance-avery-rowan",
    relationship_status: "complete",
    published_at: expected.publishedAt,
    completed_at: expected.completedAt,
    expired_at: null,
    lapse_reason: null,
    void_reason: null,
    invite_present: true,
    invite_claimed: true,
    counterparties: 1,
    expected,
    ...overrides,
  };
}

describe("V31 — a seeded relationship agrees with the lifecycle its dataset authors", () => {
  it("passes the row the seed writes", () => {
    expect(seededRelationshipProblems([coherentRow()])).toEqual([]);
  });

  it("passes a draft, a pending invitation and a lapsed row — the three #1079 added", () => {
    for (const [status, extra] of [
      ["draft", {}],
      ["pending", {}],
      ["published", { answers: "initiator" }],
      ["expired", { lapseReason: "trial-ended" }],
      ["void", { voidReason: "Closed at both parties' request." }],
    ] as const) {
      const expected = expectedOfStatus(status, extra);
      const row = coherentRow({
        relationship_status: status,
        published_at: expected.publishedAt,
        completed_at: expected.completedAt,
        expired_at: expected.expiredAt,
        lapse_reason: expected.lapseReason,
        void_reason: expected.voidReason,
        // #1196 — every word carries its invitation row, a draft included: the product writes it in
        // the relationship's own transaction, and only a claimed seat claims it.
        invite_present: true,
        invite_claimed: expected.invite === "claimed",
        counterparties: expected.seats === "both" ? 1 : 0,
        expected,
      });
      expect({ status, problems: seededRelationshipProblems([row]) }).toEqual({
        status,
        problems: [],
      });
    }
  });

  it("names a draft with no invitation row — the state #1196 removed from the demo (#1196)", () => {
    // The row the seed used to write for a draft: one seat, `status = 'draft'`, and no
    // `session_invite`. No product writer produces it — `createSessionFromTemplate` inserts the
    // invitation with the relationship — and stage 5's Send can only answer `no-invitation` over it.
    // V31 has to name it, because this is the report the fix must not buy tidiness by deleting.
    const expected = expectedOfStatus("draft");
    const problems = seededRelationshipProblems([
      coherentRow({
        relationship_status: "draft",
        published_at: null,
        completed_at: null,
        expired_at: null,
        invite_present: false,
        invite_claimed: false,
        counterparties: 0,
        expected,
      }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V31");
    expect(problems[0].message).toContain("has no session_invite row");
    expect(problems[0].message).toContain("no-invitation");
  });

  it("names a draft whose invitation reads claimed — a seat nobody took", () => {
    const expected = expectedOfStatus("draft");
    const problems = seededRelationshipProblems([
      coherentRow({
        relationship_status: "draft",
        published_at: null,
        completed_at: null,
        expired_at: null,
        invite_claimed: true,
        counterparties: 0,
        expected,
      }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V31");
    expect(problems[0].message).toContain("its invitation is claimed");
  });

  it("names a relationship whose stored status is not the one its dataset authors", () => {
    const problems = seededRelationshipProblems([coherentRow({ relationship_status: "draft" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V31");
    // The sentence quotes the id and the session's slug, and says what to run.
    expect(problems[0].message).toContain("relationship-assessment-instance-avery-rowan");
    expect(problems[0].message).toContain("avery-rowan");
    expect(problems[0].message).toContain("db:seed");
  });

  it("names a completed relationship with no completed_at", () => {
    const problems = seededRelationshipProblems([coherentRow({ completed_at: null })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("completed_at");
  });

  it("names a live relationship with no publish instant", () => {
    const expected = expectedOfStatus("active", { plan: "basic" });
    const problems = seededRelationshipProblems([
      coherentRow({
        relationship_status: "active",
        published_at: null,
        completed_at: null,
        expected,
      }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("published_at");
  });

  it("names a relationship whose counterparty seat was never claimed", () => {
    const problems = seededRelationshipProblems([coherentRow({ invite_present: false })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("session_invite");
    expect(problems[0].message).toContain("avery-rowan");
  });

  it("passes a draft carrying its unclaimed link — the row every create writes (#1196)", () => {
    // This case used to assert the finding: #1079 had the seed delete a draft's invitation, so a
    // draft holding one was reported. The product's own create writes it in the relationship's
    // transaction (`lib/flow/store.ts:797`), which makes this row — `draft`, one seat, an unclaimed
    // `session_invite` — the state the seed must produce, not the state it must avoid.
    const expected = expectedOfStatus("draft");
    const problems = seededRelationshipProblems([
      coherentRow({
        relationship_status: "draft",
        published_at: null,
        completed_at: null,
        invite_present: true,
        invite_claimed: false,
        counterparties: 0,
        expected,
      }),
    ]);
    expect(problems).toEqual([]);
  });

  it("names an unclaimed invitation on a seat somebody already holds", () => {
    const problems = seededRelationshipProblems([coherentRow({ invite_claimed: false })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("claimed");
  });

  it("names a lapse reason on a relationship that never lapsed", () => {
    const problems = seededRelationshipProblems([coherentRow({ lapse_reason: "payment-failed" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("lapse_reason");
  });

  it("names a session with no relationship row at all", () => {
    const problems = seededRelationshipProblems([coherentRow({ relationship_id: null })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("no relationship row");
  });

  it("reports every authored session, not just the first one", () => {
    const problems = seededRelationshipProblems([
      coherentRow({ relationship_status: "draft" }),
      coherentRow({
        record_id: "assessment-instance-marco-priya",
        slug: "marco-priya",
        relationship_id: "relationship-assessment-instance-marco-priya",
        invite_present: false,
      }),
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[1].message).toContain("marco-priya");
  });
});

describe("V31 — the wired check asks for the dataset's lifecycle", () => {
  it("derives the expectation from the session and flags the row that disagrees", async () => {
    const calls: { text: string; values: unknown[] }[] = [];
    const client = {
      async query(text: string, values: unknown[]) {
        calls.push({ text, values });
        return {
          rows: [
            {
              record_id: "assessment-instance-avery-rowan",
              slug: "avery-rowan",
              relationship_id: "relationship-assessment-instance-avery-rowan",
              relationship_status: "draft",
              published_at: null,
              completed_at: null,
              expired_at: null,
              lapse_reason: null,
              void_reason: null,
              invite_present: false,
              invite_claimed: false,
              aspect_count: 5,
              initiators: 1,
              counterparties: 1,
              initiator_accepted: 1,
              counterparty_accepted: 1,
              initiator_answered: 5,
              counterparty_answered: 5,
            },
          ],
        };
      },
    };

    const result = await seededRelationshipCoherenceProblems(client, [
      { id: "assessment-instance-avery-rowan", slug: "avery-rowan", date: AT },
    ]);

    expect(result.checked).toBe(1);
    // `draft` over a finished session's row short-circuits: the invitation finding is not piled on.
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].code).toBe("V31");
    // The ids the check asks about are the fixture's, passed as one array.
    expect(calls).toHaveLength(1);
    expect(calls[0].values[0]).toEqual(["assessment-instance-avery-rowan"]);
  });

  it("asks nothing when the fixture authors no session", async () => {
    const client = {
      async query() {
        throw new Error("no query should be issued");
      },
    };
    expect(await seededRelationshipCoherenceProblems(client, [])).toEqual({
      problems: [],
      checked: 0,
    });
  });
});
