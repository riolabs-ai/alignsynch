/**
 * V21 — a seeded instance reads `complete`, and the check says so when it does not.
 *
 * The defect this file covers went unnamed for a day on production (2026-11-03): #427/R2 made
 * `party.accepted_at` half of the `complete` derivation, the four seeded instances were written
 * before that stamp existed, and `pnpm db:verify` stayed green while every one of them read
 * `answering` with both seats fully answered. Your report and both demo accounts' screens were
 * locked behind a `complete` that no longer derived, and nothing in the suite said a word.
 *
 * The check is `seededInstanceStatusProblems()` in `scripts/db-verify.mjs`, exported for exactly
 * this reason: the gate is database-free (`docs/GATE.md`), so the part that decides an answer takes
 * a client-shaped object and the cases here feed it rows. The status itself is the product's own
 * `instanceStatusOf()`, so these cases fail if a rule change moves `complete` — which is the class
 * of drift the card exists to catch.
 *
 * The case worth reading first is "names one seeded instance": one seat's `accepted_at` is null
 * and the check must report a `V21` naming that instance, not a green run.
 */
import { describe, expect, it } from "vitest";
import { assessmentInstances } from "@/data/assessments";

import { seededInstanceStatusProblems } from "../scripts/db-verify.mjs";

/**
 * One row of `SEEDED_STATUS_SQL`, as `pg` returns it — the six counts `instanceStatusOf()` reads.
 *
 * Written as the seed leaves a seeded instance: every Aspect answered on both seats and both
 * `party.accepted_at` stamped (`scripts/db-seed.mjs`, `seedInstance`).
 */
interface SeededRow {
  record_id: string;
  slug: string;
  aspect_count: number;
  initiators: number;
  counterparties: number;
  initiator_accepted: number;
  counterparty_accepted: number;
  initiator_answered: number;
  counterparty_answered: number;
}

/** What the seed writes for every instance the fixture authors. */
function seededRows(): SeededRow[] {
  return assessmentInstances.map((instance) => ({
    record_id: instance.id,
    slug: instance.slug,
    aspect_count: instance.items.length,
    initiators: 1,
    counterparties: 1,
    initiator_accepted: 1,
    counterparty_accepted: 1,
    initiator_answered: instance.items.length,
    counterparty_answered: instance.items.length,
  }));
}

/** Every statement the check issued, so the fixture-id question can be asserted on the arguments. */
const calls: { text: string; values: unknown[] }[] = [];

/**
 * A recording client.
 *
 * `narrow` mirrors the SQL's `WHERE ai.record_id = ANY($1)`, which is what keeps an instance people
 * created in the app out of the check at the database. The wide form (`narrow: false`) returns
 * every row regardless, so the second guarantee — a row for an id the fixture does not author is
 * ignored rather than reported — is exercised in code and not just in the query.
 */
function clientOf(rows: readonly SeededRow[], { narrow = true } = {}) {
  return {
    query: async (text: string, values: unknown[]) => {
      calls.push({ text, values });
      const asked = new Set((values[0] as string[]) ?? []);
      return { rows: narrow ? rows.filter((row) => asked.has(row.record_id)) : [...rows] };
    },
  };
}

describe("V21 — the seeded instances read complete", () => {
  it("reads the ids from data/assessments.ts, never from a list kept in the script", async () => {
    calls.length = 0;
    await seededInstanceStatusProblems(clientOf(seededRows()), assessmentInstances);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.values[0]).toEqual(assessmentInstances.map((instance) => instance.id));
    // The four the fixture authors, and none of the app-created instances production also holds.
    expect(calls[0]?.values[0]).toHaveLength(4);
    expect(calls[0]?.values[0]).not.toContain("staff-manager-61cca238");
    expect(calls[0]?.values[0]).not.toContain("relationship-basics-copy-94c15cc5");
  });

  it("passes when every seeded instance derives complete", async () => {
    const { problems, complete, authored } = await seededInstanceStatusProblems(
      clientOf(seededRows()),
      assessmentInstances,
    );

    expect(problems).toEqual([]);
    expect(complete).toBe(4);
    expect(authored).toBe(4);
  });

  it("names one seeded instance whose seat never accepted — the 2026-11-03 state", async () => {
    const target = assessmentInstances[0] as (typeof assessmentInstances)[number];
    const rows = seededRows().map((row) =>
      row.record_id === target.id
        ? // `accepted_at` NULL on the counterparty's party row: answered in full, not complete.
          { ...row, counterparty_accepted: 0 }
        : row,
    );

    const { problems, complete } = await seededInstanceStatusProblems(
      clientOf(rows),
      assessmentInstances,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("V21");
    expect(problems[0]?.message).toContain(`"${target.slug}"`);
    expect(problems[0]?.message).toContain("answering");
    expect(problems[0]?.message).toContain("counterparty's party.accepted_at is NULL");
    // The other three still read complete: the check names the instance, not the run.
    expect(complete).toBe(3);
  });

  it("names every seeded instance a rule change moves, one line each", async () => {
    const rows = seededRows().map((row) => ({
      ...row,
      initiator_accepted: 0,
      counterparty_accepted: 0,
    }));

    const { problems, complete } = await seededInstanceStatusProblems(
      clientOf(rows),
      assessmentInstances,
    );

    expect(complete).toBe(0);
    expect(problems).toHaveLength(assessmentInstances.length);
    for (const instance of assessmentInstances) {
      expect(problems.some((problem) => problem.message.includes(`"${instance.slug}"`))).toBe(true);
    }
  });

  it("reports a missing party row as drift instead of crashing", async () => {
    const target = assessmentInstances[1] as (typeof assessmentInstances)[number];
    const rows = seededRows().map((row) =>
      row.record_id === target.id
        ? {
            ...row,
            counterparties: 0,
            counterparty_accepted: 0,
            counterparty_answered: 0,
          }
        : row,
    );

    const { problems } = await seededInstanceStatusProblems(clientOf(rows), assessmentInstances);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain(`"${target.slug}"`);
    expect(problems[0]?.message).toContain("awaiting_counterparty");
    expect(problems[0]?.message).toContain("no counterparty party row");
  });

  it("ignores an instance the seed does not author, even when the query hands it one back", async () => {
    const appCreated: SeededRow = {
      record_id: "staff-manager-61cca238",
      slug: "staff-manager-61cca238",
      aspect_count: 4,
      initiators: 1,
      counterparties: 1,
      initiator_accepted: 0,
      counterparty_accepted: 0,
      initiator_answered: 2,
      counterparty_answered: 0,
    };

    const { problems, complete } = await seededInstanceStatusProblems(
      clientOf([...seededRows(), appCreated], { narrow: false }),
      assessmentInstances,
    );

    // A person mid-flow owns that status; only the fixture's ids are this check's business.
    expect(problems).toEqual([]);
    expect(complete).toBe(4);
  });

  it("does not fail an authored instance this database does not hold at all", async () => {
    // An emptied demo branch (docs/DEMO.md): no rows, and `db:verify` is green there. Absence is a
    // branch the seed has not built yet, not a seeded instance reading wrongly.
    const { problems, complete, authored } = await seededInstanceStatusProblems(
      clientOf([]),
      assessmentInstances,
    );

    expect(problems).toEqual([]);
    expect(complete).toBe(0);
    expect(authored).toBe(4);
  });
});
