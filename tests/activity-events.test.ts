/**
 * The activity feed's rules, proved with no database, no server and no Neon key (t_6cc2b56a).
 *
 * Four things are asserted, in the order they would go wrong:
 *
 *   1. **the derivation is a function of the dataset** — `seedActivityEvents()` writes one row per act
 *      a lifecycle records and no row for an act it does not, so the number the seed asserts and
 *      `pnpm demo:verify` records cannot drift from the fixtures;
 *   2. **the identity is derived, not random** — a second run collides on
 *      `UNIQUE (idempotency_key)` instead of writing a second timeline, and two different facts can
 *      never share a key;
 *   3. **the vocabulary is the tree's, not a wish** — the migration's `source` CHECK carries `seed`
 *      and `simulate` and **no `cron`**, because nothing in this tree is scheduled and a Vercel cron
 *      entry runs on production deployments while the demo is a branch deployment;
 *   4. **the demo check is exact where it can be and bounded where it cannot** — the seed's count is
 *      in the expectations file, the simulate source is a band, and the band's ceiling is held to
 *      `SIMULATE_MAX_EVENTS` so nobody can widen it to hide a second writer.
 *
 * The one thing this file cannot see is the branch: whether the rows landed. That is
 * `pnpm db:seed` + `pnpm demo:verify`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_KINDS,
  ACTIVITY_SOURCES,
  type ActivitySeedSession,
  type ActivityLifecycleShape,
  SIMULATE_MAX_EVENTS,
  SIMULATE_MAX_RELATIONSHIPS,
  activityEventProblems,
  activityIdempotencyKey,
  relationshipIdOf,
  seedActivityEvents,
  simulateActivityEvents,
} from "@/lib/activity/events";
import { reviseExpectations, simulateBoundProblems } from "../scripts/demo-verify-rules.mjs";

const MIGRATION_PATH = new URL("../db/migrations/0044_activity_event.sql", import.meta.url);
const EXPECTATIONS_PATH = new URL("../data/verify/demo-expectations.json", import.meta.url);

const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf8")) as {
  rows: Record<string, number>;
  activity?: { simulate?: { min?: number; max?: number } };
};

const migration = readFileSync(MIGRATION_PATH, "utf8");

/** One session as the dataset writes it, with the two names the feed says. */
const SESSION: ActivitySeedSession = {
  id: "assessment-instance-avery-rowan",
  date: "2026-10-28T18:30:00.000Z",
  parties: [
    { role: "initiator", name: "Avery" },
    { role: "counterparty", name: "Rowan" },
  ],
};

/** One lifecycle, in the shape `seededLifecycleOf()` answers, with the fields overridden. */
function lifecycle(overrides: Partial<ActivityLifecycleShape>): ActivityLifecycleShape {
  return {
    status: "complete",
    invite: "claimed",
    seats: "both",
    answers: "both",
    publishedAt: SESSION.date,
    completedAt: "2026-10-29T18:30:00.000Z",
    expiredAt: null,
    voidReason: null,
    lapseReason: null,
    ...overrides,
  };
}

/** The kinds one derivation produced, in order — the whole derivation in one line per case. */
function kindsOf(status: ActivityLifecycleShape): string[] {
  return seedActivityEvents([{ session: SESSION, lifecycle: status }]).map((event) => event.kind);
}

describe("seedActivityEvents", () => {
  it("writes one row for a draft, and only the act a draft records", () => {
    const events = seedActivityEvents([
      {
        session: SESSION,
        lifecycle: lifecycle({
          status: "draft",
          invite: "created",
          seats: "initiator",
          answers: "none",
          publishedAt: null,
          completedAt: null,
        }),
      },
    ]);
    expect(events.map((event) => event.kind)).toEqual(["relationship.created"]);
    expect(events[0].summary).toBe("Avery started this relationship.");
    expect(events[0].occurredAt).toBe(SESSION.date);
    expect(events[0].source).toBe("seed");
    expect(events[0].relationshipId).toBe(relationshipIdOf(SESSION.id));
  });

  it("adds the invitation for a pending relationship", () => {
    expect(
      kindsOf(
        lifecycle({
          status: "pending",
          invite: "sent",
          seats: "initiator",
          answers: "none",
          completedAt: null,
        }),
      ),
    ).toEqual(["relationship.created", "invite.sent"]);
  });

  it("records the claim, both sheets and the report for a complete relationship", () => {
    const events = seedActivityEvents([{ session: SESSION, lifecycle: lifecycle({}) }]);
    expect(events.map((event) => event.kind)).toEqual([
      "relationship.created",
      "invite.sent",
      "invite.claimed",
      "answers.submitted",
      "answers.submitted",
      "report.published",
    ]);
    // The claim is the counterparty's act, the two sheets are each side's, and the report is
    // published at the lifecycle's own `completedAt` — never at a clock read.
    expect(events[2].partyRole).toBe("counterparty");
    expect(events[3].partyRole).toBe("initiator");
    expect(events[4].partyRole).toBe("counterparty");
    expect(events[5].occurredAt).toBe("2026-10-29T18:30:00.000Z");
  });

  it("gives a closure no actor, and says which closure it was", () => {
    const voided = seedActivityEvents([
      {
        session: SESSION,
        lifecycle: lifecycle({
          status: "void",
          answers: "initiator",
          completedAt: null,
          voidReason: "Duplicate of #1041",
        }),
      },
    ]);
    const closed = voided[voided.length - 1];
    expect(closed.kind).toBe("relationship.closed");
    expect(closed.partyRole).toBeNull();
    expect(closed.sessionRecordId).toBeNull();
    expect(closed.summary).toBe("Closed by support — Duplicate of #1041");

    const lapsed = seedActivityEvents([
      {
        session: SESSION,
        lifecycle: lifecycle({
          status: "expired",
          answers: "initiator",
          completedAt: null,
          expiredAt: "2026-11-04T18:30:00.000Z",
          lapseReason: "Trial ended",
        }),
      },
    ]);
    const lapse = lapsed[lapsed.length - 1];
    expect(lapse.summary).toBe("The invitation lapsed — Trial ended");
    expect(lapse.occurredAt).toBe("2026-11-04T18:30:00.000Z");
  });

  it("does not write a sheet for a side the lifecycle says did not fill one in", () => {
    const events = seedActivityEvents([
      { session: SESSION, lifecycle: lifecycle({ answers: "initiator" }) },
    ]);
    const submitted = events.filter((event) => event.kind === "answers.submitted");
    expect(submitted).toHaveLength(1);
    expect(submitted[0].partyRole).toBe("initiator");
  });

  it("is deterministic: two runs produce the same rows, byte for byte", () => {
    const first = seedActivityEvents([{ session: SESSION, lifecycle: lifecycle({}) }]);
    const second = seedActivityEvents([{ session: SESSION, lifecycle: lifecycle({}) }]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("orders the timeline: created, then the invitation, then the claim, then the sheets", () => {
    const events = seedActivityEvents([{ session: SESSION, lifecycle: lifecycle({}) }]);
    const instants = events
      .filter((event) => event.kind !== "report.published")
      .map((event) => event.occurredAt);
    expect(instants).toEqual([...instants].sort());
  });

  it("gives every row its own identity, so a re-run cannot duplicate one", () => {
    const events = seedActivityEvents([
      { session: SESSION, lifecycle: lifecycle({}) },
      {
        session: { ...SESSION, id: "assessment-instance-second" },
        lifecycle: lifecycle({}),
      },
    ]);
    const keys = events.map((event) => event.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("activityIdempotencyKey", () => {
  it("distinguishes the two facts that differ only by actor", () => {
    const base = {
      source: "seed" as const,
      relationshipId: "relationship-1",
      kind: "answers.submitted" as const,
    };
    expect(activityIdempotencyKey({ ...base, partyRole: "initiator" })).not.toBe(
      activityIdempotencyKey({ ...base, partyRole: "counterparty" }),
    );
    // The same fact, twice, is the same key — that is the whole defence.
    expect(activityIdempotencyKey({ ...base, partyRole: "initiator" })).toBe(
      activityIdempotencyKey({ ...base, partyRole: "initiator" }),
    );
  });

  it("separates the sources, so a played timeline never collides with a seeded one", () => {
    const shared = {
      relationshipId: "relationship-1",
      kind: "answers.submitted" as const,
      partyRole: "initiator" as const,
    };
    expect(activityIdempotencyKey({ ...shared, source: "seed" })).not.toBe(
      activityIdempotencyKey({ ...shared, source: "simulate" }),
    );
  });

  it("names a closure '-' rather than an empty slot", () => {
    expect(
      activityIdempotencyKey({
        source: "seed",
        relationshipId: "relationship-1",
        kind: "relationship.closed",
        partyRole: null,
      }),
    ).toBe("seed/relationship-1/relationship.closed/-");
  });
});

describe("simulateActivityEvents", () => {
  const seats = Array.from({ length: 40 }, (_, index) => ({
    relationshipId: `relationship-${Math.floor(index / 2)}`,
    sessionRecordId: `session-${Math.floor(index / 2)}`,
    partyRole: (index % 2 === 0 ? "initiator" : "counterparty") as "initiator" | "counterparty",
    partyName: `Person ${index}`,
  }));

  it("stops at the cap, so one press cannot write an unbounded timeline", () => {
    const events = simulateActivityEvents(seats, "2026-11-20T12:00:00.000Z");
    expect(events.length).toBe(SIMULATE_MAX_EVENTS);
    const relationships = new Set(events.map((event) => event.relationshipId));
    expect(relationships.size).toBe(SIMULATE_MAX_RELATIONSHIPS);
  });

  it("tags every row 'simulate', so the exact seed count can never include one", () => {
    for (const event of simulateActivityEvents(seats, "2026-11-20T12:00:00.000Z")) {
      expect(event.source).toBe("simulate");
      expect(event.idempotencyKey.startsWith("simulate/")).toBe(true);
    }
  });

  it("presses twice without writing a second row", () => {
    const first = simulateActivityEvents(seats, "2026-11-20T12:00:00.000Z");
    const second = simulateActivityEvents(seats, "2026-11-20T12:05:00.000Z");
    expect(second.map((event) => event.idempotencyKey)).toEqual(
      first.map((event) => event.idempotencyKey),
    );
  });
});

describe("activityEventProblems", () => {
  it("passes a row whose seat resolves to its own relationship", () => {
    expect(
      activityEventProblems([
        {
          id: "1",
          relationshipId: "relationship-1",
          sessionRecordId: "session-1",
          partyRole: "initiator",
          seatRelationshipId: "relationship-1",
        },
      ]),
    ).toEqual([]);
  });

  it("names a seat that does not resolve", () => {
    const problems = activityEventProblems([
      {
        id: "2",
        relationshipId: "relationship-1",
        sessionRecordId: "session-9",
        partyRole: "initiator",
        seatRelationshipId: null,
      },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V35");
    expect(problems[0].message).toContain("orphan");
  });

  it("names a seat that belongs to another relationship — the case the FK cannot express", () => {
    const problems = activityEventProblems([
      {
        id: "3",
        relationshipId: "relationship-1",
        sessionRecordId: "session-2",
        partyRole: "counterparty",
        seatRelationshipId: "relationship-2",
      },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("relationship-2");
  });

  it("names half a seat reference", () => {
    const problems = activityEventProblems([
      {
        id: "4",
        relationshipId: "relationship-1",
        sessionRecordId: "session-1",
        partyRole: null,
        seatRelationshipId: null,
      },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("half a seat reference");
  });

  it("accepts a closure, which names no seat at all", () => {
    expect(
      activityEventProblems([
        {
          id: "5",
          relationshipId: "relationship-1",
          sessionRecordId: null,
          partyRole: null,
          seatRelationshipId: null,
        },
      ]),
    ).toEqual([]);
  });
});

describe("the migration's vocabulary", () => {
  it("accepts the two writers the tree has", () => {
    for (const source of ACTIVITY_SOURCES) {
      expect(migration).toContain(`'${source}'`);
    }
    expect(ACTIVITY_SOURCES).toEqual(["seed", "simulate"]);
  });

  it("never accepts 'cron' — nothing in this tree is scheduled", () => {
    // The word appears in the file's prose (explaining why it is absent), never in the CHECK's list.
    const check = migration.slice(
      migration.indexOf("activity_event_source_vocabulary"),
      migration.indexOf("activity_event_kind_vocabulary"),
    );
    expect(/\bcron\b/i.test(check)).toBe(false);
    expect(check).not.toContain("'cron'");
  });

  it("closes the kind vocabulary to the words the feed renders", () => {
    const check = migration.slice(
      migration.indexOf("activity_event_kind_vocabulary"),
      migration.indexOf("activity_event_party_role_vocabulary"),
    );
    for (const kind of ACTIVITY_KINDS) {
      expect(check).toContain(`'${kind}'`);
    }
  });

  it("makes the identity unique and the party reference a real key", () => {
    expect(migration).toContain("UNIQUE (idempotency_key)");
    expect(migration).toContain("REFERENCES party (session_record_id, role)");
  });
});

describe("the demo check's two halves", () => {
  it("counts the seed's rows exactly", () => {
    expect(Object.keys(expectations.rows)).toContain("activity_event_seed");
  });

  it("bounds the simulate path, and the band's ceiling is the writer's own cap", () => {
    const band = expectations.activity?.simulate;
    expect(band).toBeDefined();
    // `demo:verify` presses the action itself before reading the count, so zero would mean the
    // writer wrote nothing — a floor of 1 is the honest one.
    expect(band?.min).toBe(1);
    expect(band?.max).toBeLessThanOrEqual(SIMULATE_MAX_EVENTS);
  });

  it("reads a count inside the band as fine, and outside it as a finding", () => {
    const band = expectations.activity?.simulate;
    expect(
      simulateBoundProblems({ count: band?.min ?? 0, min: band?.min, max: band?.max }),
    ).toEqual([]);
    expect(
      simulateBoundProblems({ count: (band?.max ?? 0) + 1, min: band?.min, max: band?.max }),
    ).not.toEqual([]);
    expect(simulateBoundProblems({ count: 0, min: band?.min, max: band?.max })).not.toEqual([]);
  });

  it("says nothing about a source whose band nobody authored", () => {
    expect(simulateBoundProblems({ count: 999 })).toEqual([]);
  });

  it("does not let --update rewrite the authored band", () => {
    const { next, changes } = reviseExpectations(
      {
        dataset: "demo-dataset.alignsynch.json",
        brand: "alignsynch",
        // The count is **recorded** by `--update` (it is in `rows`), the band is not.
        rows: { activity_event_seed: 0 },
        routes: [],
        activity: expectations.activity,
      },
      { rows: { activity_event_seed: 87 }, routes: [] },
    );
    expect(next.rows).toMatchObject({ activity_event_seed: 87 });
    expect(changes).toEqual(["rows.activity_event_seed 0 → 87"]);
    expect(next.activity).toEqual(expectations.activity);
  });
});
