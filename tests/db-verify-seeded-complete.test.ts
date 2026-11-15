/**
 * V21 — a seeded instance reads the status its **dataset authors**, and the check says so when it
 * does not.
 *
 * Two defects live behind this file. The first went unnamed for a day on production (2026-11-03):
 * #427/R2 made `party.accepted_at` half of the `complete` derivation, the four seeded instances were
 * written before that stamp existed, and `pnpm db:verify` stayed green while every one of them read
 * `answering` with both seats fully answered. The second is #1079: the dataset grew seven lifecycle
 * words, so a check that asserts one word (`complete`) for every instance can no longer tell a
 * correct draft from a broken one — it would fail every correct non-finished row.
 *
 * So the expectation is derived from the dataset through `seededLifecycleOf()` and the answer is read
 * with the product's own `instanceStatusOf()`. These cases fail if either moves.
 *
 * The check is `seededInstanceStatusProblems()` in `scripts/db-verify.mjs`, exported for exactly this
 * reason: the gate is database-free (`docs/operations/gate.md`), so the part that decides an answer
 * takes a client-shaped object and the cases here feed it rows.
 *
 * The case worth reading first is "names one seeded instance": one seat's `accepted_at` is null and
 * the check must report a `V21` naming that instance, not a green run.
 */
import { describe, expect, it } from "vitest";
import { seededLifecycleOf } from "@/content/assessment";
import { assessmentInstances } from "@/data/assessments";

import { expectedSessionStatusOf, seededInstanceStatusProblems } from "../scripts/db-verify.mjs";

/**
 * One row of `SEEDED_STATUS_SQL`, as `pg` returns it — the counts `instanceStatusOf()` reads plus
 * the relationship facts it needs to tell a draft from an unsent row.
 *
 * Built from the dataset's own lifecycle, so this fixture is what `db:seed` writes by construction
 * rather than a second opinion about it.
 */
interface SeededRow {
  record_id: string;
  slug: string;
  published_at: string | null;
  relationship_status: string;
  void_reason: string | null;
  aspect_count: number;
  initiators: number;
  counterparties: number;
  initiator_accepted: number;
  counterparty_accepted: number;
  initiator_answered: number;
  counterparty_answered: number;
}

/** What the seed writes for every instance the dataset authors. */
function seededRows(): SeededRow[] {
  return assessmentInstances.map((instance) => {
    const lifecycle = seededLifecycleOf(instance);
    const aspects = instance.items.length;
    const bothSeats = lifecycle.seats === "both";
    const bothAccepted = lifecycle.accepted === "both";
    const initiatorAnswered =
      lifecycle.answers === "both" || lifecycle.answers === "initiator" ? aspects : 0;
    return {
      record_id: instance.id,
      slug: instance.slug,
      published_at: lifecycle.publishedAt,
      relationship_status: lifecycle.status,
      void_reason: lifecycle.voidReason,
      aspect_count: aspects,
      initiators: 1,
      counterparties: bothSeats ? 1 : 0,
      initiator_accepted: bothAccepted ? 1 : 0,
      counterparty_accepted: bothAccepted && bothSeats ? 1 : 0,
      initiator_answered: initiatorAnswered,
      counterparty_answered: lifecycle.answers === "both" && bothSeats ? aspects : 0,
    };
  });
}

/** How many authored instances the dataset expects to read `complete` — a live or finished session. */
const EXPECTED_COMPLETE = assessmentInstances.filter(
  (instance) => expectedSessionStatusOf(seededLifecycleOf(instance)) === "complete",
).length;

/** The first instance whose lifecycle expects a finished session — the stamp cases mutate that one. */
const FIRST_COMPLETE = assessmentInstances.find(
  (instance) => expectedSessionStatusOf(seededLifecycleOf(instance)) === "complete",
) as (typeof assessmentInstances)[number];

/** Every statement the check issued, so the fixture-id question can be asserted on the arguments. */
const calls: { text: string; values: unknown[] }[] = [];

/**
 * A recording client.
 *
 * `narrow` mirrors the SQL's `WHERE ai.record_id = ANY($1)`, which is what keeps an instance people
 * created in the app out of the check at the database. The wide form (`narrow: false`) returns every
 * row regardless, so the second guarantee — a row for an id the fixture does not author is ignored
 * rather than reported — is exercised in code and not just in the query.
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

describe("V21 — a seeded instance reads the status its dataset authors", () => {
  it("reads the ids from data/assessments.ts, never from a list kept in the script", async () => {
    calls.length = 0;
    await seededInstanceStatusProblems(clientOf(seededRows()), assessmentInstances);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.values[0]).toEqual(assessmentInstances.map((instance) => instance.id));
    expect(calls[0]?.values[0]).toHaveLength(assessmentInstances.length);
    // The instances production also holds, created in the app, are not this check's business.
    expect(calls[0]?.values[0]).not.toContain("staff-manager-61cca238");
    expect(calls[0]?.values[0]).not.toContain("relationship-basics-copy-94c15cc5");
  });

  it("passes when every seeded instance reads what its lifecycle authors", async () => {
    const { problems, complete, authored, matched } = await seededInstanceStatusProblems(
      clientOf(seededRows()),
      assessmentInstances,
    );

    expect(problems).toEqual([]);
    // The dataset is a **mixed** population since #1079: some finished sessions, some drafts, some
    // waiting on a counterparty, some lapsed. That is the point — and the counts are derived rather
    // than fixed, so a new lifecycle row does not have to edit this file.
    expect(EXPECTED_COMPLETE).toBeGreaterThan(0);
    expect(EXPECTED_COMPLETE).toBeLessThan(assessmentInstances.length);
    expect(complete).toBe(EXPECTED_COMPLETE);
    expect(matched).toBe(assessmentInstances.length);
    expect(authored).toBe(assessmentInstances.length);
  });

  it("names one seeded instance whose seat never accepted — the 2026-11-03 state", async () => {
    const rows = seededRows().map((row) =>
      row.record_id === FIRST_COMPLETE.id
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
    expect(problems[0]?.message).toContain(`"${FIRST_COMPLETE.slug}"`);
    expect(problems[0]?.message).toContain("answering");
    expect(problems[0]?.message).toContain("counterparty's party.accepted_at is NULL");
    // The rest still read what they author: the check names the instance, not the run.
    expect(complete).toBe(EXPECTED_COMPLETE - 1);
  });

  it("names every finished session a rule change moves, one line each", async () => {
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
    // Only the rows whose lifecycle expects a finished session move: a draft or a pending one
    // already expects no acceptance, so nothing about it changed.
    expect(problems).toHaveLength(EXPECTED_COMPLETE);
    const named = assessmentInstances.filter((instance) =>
      problems.some((problem) => problem.message.includes(`"${instance.slug}"`)),
    );
    expect(named).toHaveLength(EXPECTED_COMPLETE);
  });

  it("reports a missing party row as drift instead of crashing", async () => {
    const rows = seededRows().map((row) =>
      row.record_id === FIRST_COMPLETE.id
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
    expect(problems[0]?.message).toContain(`"${FIRST_COMPLETE.slug}"`);
    expect(problems[0]?.message).toContain("awaiting_counterparty");
    expect(problems[0]?.message).toContain("no counterparty party row");
  });

  it("ignores an instance the seed does not author, even when the query hands it one back", async () => {
    const appCreated: SeededRow = {
      record_id: "staff-manager-61cca238",
      slug: "staff-manager-61cca238",
      published_at: "2026-10-01T09:00:00.000Z",
      relationship_status: "published",
      void_reason: null,
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
    expect(complete).toBe(EXPECTED_COMPLETE);
  });

  it("does not fail an authored instance this database does not hold at all", async () => {
    // An emptied demo branch (docs/getting-started/demo.md): no rows, and `db:verify` is green there.
    // Absence is a branch the seed has not built yet, not a seeded instance reading wrongly.
    const { problems, complete, authored } = await seededInstanceStatusProblems(
      clientOf([]),
      assessmentInstances,
    );

    expect(problems).toEqual([]);
    expect(complete).toBe(0);
    expect(authored).toBe(assessmentInstances.length);
  });
});
