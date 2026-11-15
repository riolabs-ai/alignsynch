/**
 * V31 — a seeded relationship is coherent with its own session (#975).
 *
 * The defect this covers was measured on the demo branch and named by the UX walk behind #975:
 * `relationship.status` read `draft` on all four seeded relationships (0030's default, which the
 * seed never overwrote) while every one of them had both seats answered and both acceptances
 * stamped — so `/dashboard/relationships/<id>` said **"Not sent yet — nothing has been invited or
 * charged"** over a report drawing six Gaps, and `/assessments` said the pair had accepted.
 * `session_invite` held **0 rows**, so `/invite/<token>` could only answer "No such invitation" and
 * the counterparty's accept path had no screen at all. V21 asserted the session and was green
 * throughout: the two rows that describe one pair were never compared.
 *
 * The rule is `seededRelationshipProblems()` in `scripts/db-verify.mjs`, exported so these cases can
 * drive it with literals — the gate is database-free (`docs/operations/gate.md`), and a check
 * that needs a branch is a check that runs after the merge. The status itself is the product's own
 * `instanceStatusOf()`, so a rule change that moved `complete` fails here rather than turning the
 * demo silently green.
 */
import { describe, expect, it } from "vitest";

import {
  seededRelationshipCoherenceProblems,
  seededRelationshipProblems,
} from "../scripts/db-verify.mjs";

/**
 * One row of `SEEDED_RELATIONSHIP_SQL`, as `pg` returns it, plus the derived session status the
 * caller computes. Written as `db:seed` leaves a seeded relationship: `complete`, published and
 * completed at the instance's own instant, with one claimed invitation.
 */
interface CoherenceRow {
  record_id: string;
  slug: string;
  relationship_id: string | null;
  relationship_status: string;
  published_at: Date | string | null;
  completed_at: Date | string | null;
  invite_present: boolean;
  invite_claimed: boolean;
  instance_status: "yours-to-answer" | "awaiting-other" | "complete";
}

const AT = new Date("2026-10-28T18:30:00.000Z");

function coherentRow(overrides: Partial<CoherenceRow> = {}): CoherenceRow {
  return {
    record_id: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    relationship_id: "relationship-assessment-instance-avery-rowan",
    relationship_status: "complete",
    published_at: AT,
    completed_at: AT,
    invite_present: true,
    invite_claimed: true,
    instance_status: "complete",
    ...overrides,
  };
}

describe("V31 — a seeded relationship agrees with its session", () => {
  it("passes the rows the seed now writes", () => {
    expect(seededRelationshipProblems([coherentRow()])).toEqual([]);
  });

  it("names a draft relationship over a completed session", () => {
    const problems = seededRelationshipProblems([coherentRow({ relationship_status: "draft" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V31");
    // The sentence quotes the id and the session's slug, and says what to run.
    expect(problems[0].message).toContain("relationship-assessment-instance-avery-rowan");
    expect(problems[0].message).toContain("avery-rowan");
    expect(problems[0].message).toContain("db:seed");
  });

  it("treats `pending` the same way — neither was ever invited", () => {
    expect(
      seededRelationshipProblems([coherentRow({ relationship_status: "pending" })]).map(
        (problem) => problem.code,
      ),
    ).toEqual(["V31"]);
  });

  it("names a live relationship with no publish instant", () => {
    const problems = seededRelationshipProblems([
      coherentRow({ relationship_status: "active", published_at: null }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("published_at NULL");
  });

  it("names a session whose counterparty was never invited", () => {
    const problems = seededRelationshipProblems([coherentRow({ invite_present: false })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("session_invite");
    expect(problems[0].message).toContain("avery-rowan");
  });

  it("names an unclaimed invitation on a seat somebody already holds", () => {
    const problems = seededRelationshipProblems([coherentRow({ invite_claimed: false })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("unclaimed invitation");
  });

  it("names a session with no relationship row at all", () => {
    const problems = seededRelationshipProblems([coherentRow({ relationship_id: null })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("no relationship row");
  });

  it("leaves a session that is not complete alone — a person mid-flow is not drift", () => {
    expect(
      seededRelationshipProblems([
        coherentRow({
          instance_status: "yours-to-answer",
          relationship_status: "draft",
          published_at: null,
          invite_present: false,
          invite_claimed: false,
          completed_at: null,
        }),
      ]),
    ).toEqual([]);
  });

  it("reports every authored instance, not just the first one", () => {
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

describe("V31 — the wired check derives the status itself", () => {
  it("derives `complete` from the counts and flags the draft row", async () => {
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
      { id: "assessment-instance-avery-rowan", slug: "avery-rowan" },
    ]);

    expect(result.checked).toBe(1);
    // `draft` over a complete session short-circuits: the invitation finding is not piled on top.
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].code).toBe("V31");
    // The ids the check asks about are the fixture's, passed as one array.
    expect(calls).toHaveLength(1);
    expect(calls[0].values[0]).toEqual(["assessment-instance-avery-rowan"]);
  });

  it("asks nothing when the fixture authors no instance", async () => {
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
