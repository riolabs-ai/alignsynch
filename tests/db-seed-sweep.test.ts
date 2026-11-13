/**
 * The bundle-scoped sweep (#865) — the rules that decide what a seed removes, proved without a
 * database.
 *
 * Why the rules live in `scripts/db-seed-sweep.mjs` at all: `db-seed.mjs` runs its seed at import,
 * so anything left inside it is untestable, and the thing that broke here was a *rule* (an exact
 * count with no way to converge the branch it was counting) rather than a typo. These cases pin
 * the four claims the fix makes:
 *
 *   1. the sweep's id set is "everything not in the bundle" — a statement about the file, never
 *      about how a row looks;
 *   2. the delete order is bottom-up, because `relationship_payment`'s FK has no cascade;
 *   3. `--check` writes nothing — every statement it issues is a `SELECT`, so there is no
 *      destructive path behind it to roll back;
 *   4. the exact-count assertion still fires, in both directions. Convergence is what makes it
 *      affordable; it is not a reason to relax it.
 */
import { describe, expect, test } from "vitest";
import {
  SWEEP_PARENT,
  SWEEP_STATEMENTS,
  assertExactCount,
  checkReport,
  emptyCounts,
  inspectDrift,
  removeStrays,
  strayRelationshipIds,
  sweepLine,
  sweepOrder,
} from "../scripts/db-seed-sweep.mjs";

const BUNDLE = [
  "relationship-assessment-instance-avery-rowan",
  "relationship-assessment-instance-marco-priya",
  "relationship-assessment-instance-noor-iris",
  "relationship-assessment-instance-ruth-sam",
];

interface Statement {
  sql: string;
  params?: unknown[];
}

/**
 * A `pg` client that records what it is asked and answers as the branch would.
 *
 * It is deliberately dumb: a statement it does not recognise throws, so a future query added to
 * `inspectDrift` fails this suite instead of silently reaching a real branch in some later run.
 */
function recordingClient({
  relationships = [] as Record<string, unknown>[],
  sessions = [] as string[],
  counts = {} as Record<string, number>,
} = {}) {
  const statements: Statement[] = [];
  return {
    statements,
    async query(sql: string, params?: unknown[]) {
      statements.push({ sql, params });
      // Order matters: the aggregate query also reads `FROM session`, so it is matched first.
      if (/AS relationship_payment/.test(sql)) {
        return { rows: [{ ...emptyCounts(), ...counts }] };
      }
      if (/FROM relationship r\b/.test(sql)) return { rows: relationships };
      if (/^SELECT record_id FROM session\s+WHERE relationship_id/.test(sql)) {
        return { rows: sessions.map((record_id) => ({ record_id })) };
      }
      // The sweep's own deletes: the fake removes nothing, so every count comes back 0 and the
      // assertion about *which* statements were issued stays the point of the case.
      if (/^DELETE FROM/.test(sql)) return { rows: [], rowCount: 0 };
      throw new Error(`unexpected statement: ${sql}`);
    },
  };
}

/** One stray relationship as `inspectDrift()` reports it: an id, when, and its child counts. */
function strayRow(
  id: string,
  counts: { payment?: number; member?: number; session?: number } = {},
) {
  return {
    id,
    created_at: new Date("2026-11-12T08:00:00.000Z"),
    initiator_user_id: null,
    payment: counts.payment ?? 0,
    member: counts.member ?? 0,
    session: counts.session ?? 0,
  };
}

describe("the sweep's id set", () => {
  test("is every relationship the bundle does not describe", () => {
    expect(strayRelationshipIds([...BUNDLE, "relationship-9c1f"], BUNDLE)).toEqual([
      "relationship-9c1f",
    ]);
    expect(strayRelationshipIds(BUNDLE, BUNDLE)).toEqual([]);
  });

  test("keeps an id once and prints the strays in a stable order", () => {
    expect(
      strayRelationshipIds(["relationship-b", "relationship-a", "relationship-b"], []),
    ).toEqual(["relationship-a", "relationship-b"]);
  });

  test("compares handles exactly — a prefix or a suffix is a different row", () => {
    expect(
      strayRelationshipIds(
        ["relationship-assessment-instance-avery-rowan-2", "assessment-instance-avery-rowan"],
        BUNDLE,
      ),
    ).toEqual([
      "assessment-instance-avery-rowan",
      "relationship-assessment-instance-avery-rowan-2",
    ]);
  });

  test("and a bundle row the branch does not hold is not drift — this deletes nothing extra", () => {
    // `strayRelationshipIds` is one-directional on purpose: a missing bundle row is the seed's
    // job (it writes it), while an extra row is nobody's and is what the sweep exists for.
    expect(strayRelationshipIds(["relationship-a"], ["relationship-a", "relationship-b"])).toEqual(
      [],
    );
  });
});

describe("the delete order", () => {
  test("is bottom-up: every child before its parent", () => {
    const order = sweepOrder();
    for (const [child, parent] of Object.entries(SWEEP_PARENT)) {
      expect(order, `${child} is in the sweep`).toContain(child);
      expect(order.indexOf(child), `${child} before ${parent}`).toBeLessThan(
        order.indexOf(parent as string),
      );
    }
  });

  test("ends with the instance's own record, after every row that names it", () => {
    // The session's `record` row is the one a flow-created relationship leaves behind when its
    // session is swept (#962 follow-up), so it must go last: `session.record_id`, `item.record_id`
    // and the parties' `session_record_id` all name it, and each is deleted earlier in the list.
    expect(sweepOrder().at(-1)).toBe("record");
    expect(sweepOrder().indexOf("session")).toBeLessThan(sweepOrder().indexOf("record"));
    expect(sweepOrder().indexOf("item")).toBeLessThan(sweepOrder().indexOf("record"));
  });

  test("covers the whole subtree, `relationship_payment` first", () => {
    expect(sweepOrder()).toEqual([
      "relationship_payment",
      "relationship_member",
      "coach_invite",
      "opinion",
      "party",
      "session_invite",
      "session",
      "relationship",
      "item",
      "record",
    ]);
  });

  test("the record delete is scoped to the sessions' ids and to assessment rows", () => {
    const record = SWEEP_STATEMENTS.find((statement) => statement.table === "record");
    expect(record?.scope).toBe("session");
    expect(record?.sql).toContain("record_type = 'assessment'");
  });

  test("and `removeStrays` issues exactly those statements, in that order", async () => {
    const client = recordingClient();
    await removeStrays(client, {
      relationshipIds: ["relationship-shell"],
      sessionRecordIds: ["session-shell"],
    });
    expect(client.statements.map(({ sql }) => sql.match(/^DELETE FROM (\w+)/)?.[1])).toEqual(
      sweepOrder(),
    );
    // Each statement binds exactly one list: the relationship ids, or the sessions they own.
    const expected = SWEEP_STATEMENTS.map(({ scope }) =>
      scope === "session" ? ["session-shell"] : ["relationship-shell"],
    );
    expect(client.statements.map(({ params }) => params?.[0])).toEqual(expected);
    for (const { params } of client.statements) expect(params).toHaveLength(1);
  });

  test("deletes nothing when the branch is already the bundle's", async () => {
    const client = recordingClient();
    expect(await removeStrays(client, { relationshipIds: [], sessionRecordIds: [] })).toEqual(
      emptyCounts(),
    );
    expect(client.statements).toHaveLength(0);
  });
});

describe("--check", () => {
  test("writes nothing: every statement it issues is a SELECT", async () => {
    const client = recordingClient({
      relationships: [strayRow("relationship-shell", { payment: 1, member: 1 })],
      counts: { relationship_payment: 1, relationship_member: 1 },
    });
    const drift = await inspectDrift(client, { bundleRelationshipIds: BUNDLE });

    expect(drift.strays).toEqual(["relationship-shell"]);
    expect(drift.sessionRecordIds).toEqual([]);
    expect(client.statements.length).toBeGreaterThan(0);
    for (const { sql } of client.statements) {
      expect(sql.trim(), `wrote: ${sql}`).toMatch(/^SELECT\b/);
    }
  });

  test("exits 1 and names the strays when the branch has drifted", async () => {
    const client = recordingClient({
      relationships: [strayRow("relationship-shell", { payment: 1, member: 1, session: 1 })],
      sessions: ["assessment-instance-stray"],
      counts: {
        relationship_payment: 1,
        relationship_member: 1,
        session: 1,
        party: 2,
        opinion: 10,
      },
    });
    const drift = await inspectDrift(client, { bundleRelationshipIds: BUNDLE });
    const report = checkReport({
      ...drift,
      source: "data/bundles/demo-dataset.alignsynch.json",
    });

    expect(report.exitCode).toBe(1);
    const text = report.lines.join("\n");
    expect(text).toContain("relationship-shell");
    expect(text).toContain("2026-11-12T08:00:00.000Z");
    expect(text).toContain("1 payment");
    expect(text).toContain("1 session");
    expect(text).toContain("the sweep would remove:");
    expect(text).toContain("nothing was written");
  });

  test("exits 0 and says the branch is converged when there is nothing to remove", async () => {
    const client = recordingClient({
      relationships: BUNDLE.map((id) => strayRow(id)),
    });
    const drift = await inspectDrift(client, { bundleRelationshipIds: BUNDLE });
    const report = checkReport({
      ...drift,
      source: "data/bundles/demo-dataset.alignsynch.json",
    });

    expect(drift.strays).toEqual([]);
    expect(report.exitCode).toBe(0);
    expect(report.lines.join("\n")).toContain("converged");
  });
});

describe("what the seed prints", () => {
  test("a clean run says the branch is the bundle's, in words rather than zeroes", () => {
    const line = sweepLine({ strays: [], counts: emptyCounts(), source: "the bundle" });
    expect(line).toContain("0 stray relationship(s)");
    expect(line).toContain("the bundle");
  });

  test("a swept run prints the counts it removed, and only the non-zero ones", () => {
    const line = sweepLine({
      strays: ["relationship-a", "relationship-b"],
      counts: {
        ...emptyCounts(),
        relationship_payment: 2,
        relationship_member: 2,
        relationship: 2,
      },
      source: "the bundle",
    });
    expect(line).toContain("2 stray relationship(s) removed");
    expect(line).toContain("relationship_payment 2");
    expect(line).toContain("relationship 2");
    expect(line).not.toContain("session 0");
  });
});

describe("the exact-count assertion", () => {
  const source = "data/bundles/demo-dataset.alignsynch.json";

  test("still fires for a relationship the bundle does not describe", () => {
    expect(() =>
      assertExactCount({ table: "relationship", expected: 4, actual: 38, source }),
    ).toThrow(
      "relationship: expected 4 row(s) from data/bundles/demo-dataset.alignsynch.json, found 38",
    );
  });

  test("and for too few, because convergence is not a licence to under-seed", () => {
    expect(() =>
      assertExactCount({ table: "relationship", expected: 4, actual: 3, source }),
    ).toThrow("found 3");
  });

  test("and stays quiet on the exact count", () => {
    expect(() =>
      assertExactCount({ table: "relationship", expected: 4, actual: 4, source }),
    ).not.toThrow();
  });
});
