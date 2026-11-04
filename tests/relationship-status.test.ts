/**
 * The relationship lifecycle's transition table (#533 phase 1), driven with no database and no clock.
 *
 * Three claims, and they are the ones phase 2 (initiator CRUD) and phase 3 (lapse enforcement) read
 * before they write anything:
 *
 *   1. **The table is the state machine.** Every edge it lists is allowed for exactly the actors it
 *      names, and refused for every other actor — so a new actor cannot acquire authority by being
 *      added to a union type somewhere else.
 *   2. **A closed status is closed.** `complete` and `void` have no outgoing edge, which is what
 *      makes "complete → active" a refusal rather than a repair. `expired` is *lapsed*, not closed
 *      (#533 phase 3): its only two outgoing edges are the system's payment moves, and they are
 *      asserted by name.
 *   3. **The counterparty holds no lifecycle authority.** Publishing, voiding and completing are the
 *      initiator's, support's or a consequence's act; the invited member's act is acceptance, which
 *      lives on `party.accepted_at` (0016).
 *
 * The vocabulary is also checked against `0030_relationship_lifecycle.sql`: the TS list and the SQL
 * CHECK are two authoured copies of one fact, and a seventh status added to one and not the other
 * would otherwise be found in production.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  actorsFor,
  canTransition,
  CLOSED_RELATIONSHIP_STATUSES,
  isClosedRelationshipStatus,
  isRelationshipActor,
  isRelationshipStatus,
  RELATIONSHIP_ACTORS,
  RELATIONSHIP_STATUSES,
  RELATIONSHIP_TRANSITIONS,
  targetsFrom,
  transitionsBy,
  transitionsFrom,
  type RelationshipActor,
  type RelationshipStatus,
} from "@/lib/relationship/status";

const MIGRATION = new URL("../db/migrations/0030_relationship_lifecycle.sql", import.meta.url);

describe("the relationship lifecycle vocabulary", () => {
  it("is the seven words of #533, in lifecycle order", () => {
    expect(RELATIONSHIP_STATUSES).toEqual([
      "draft",
      "pending",
      "published",
      "active",
      "complete",
      "void",
      "expired",
    ]);
  });

  it("agrees with the CHECK in 0030, so the table and the column cannot drift", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const check = /relationship_status_vocabulary[\s\S]*?CHECK\s*\(([\s\S]*?)\);/.exec(sql);
    expect(check, "0030 no longer carries the status CHECK").not.toBeNull();

    const words = [...(check?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(words).toEqual([...RELATIONSHIP_STATUSES]);
  });

  it("closes the vocabulary and the actor list at their guards", () => {
    expect(isRelationshipStatus("active")).toBe(true);
    expect(isRelationshipStatus("cancelled")).toBe(false);
    expect(isRelationshipActor("system")).toBe(true);
    expect(isRelationshipActor("owner")).toBe(false);
  });
});

describe("the transition table", () => {
  it("allows every listed edge for every actor it names, and refuses it for every other actor", () => {
    for (const transition of RELATIONSHIP_TRANSITIONS) {
      expect(
        transition.actors.length,
        `${transition.from} → ${transition.to} names no actor`,
      ).toBeGreaterThan(0);

      for (const actor of RELATIONSHIP_ACTORS) {
        const allowed = transition.actors.includes(actor);
        expect(
          canTransition(transition.from, transition.to, actor),
          `${actor}: ${transition.from} → ${transition.to}`,
        ).toBe(allowed);
      }
    }
  });

  it("refuses complete → active", () => {
    expect(canTransition("complete", "active", "system")).toBe(false);
    expect(canTransition("complete", "active", "admin")).toBe(false);
    expect(canTransition("complete", "active", "initiator")).toBe(false);
    expect(actorsFor("complete", "active")).toEqual([]);
  });

  it("refuses a counterparty publishing", () => {
    expect(canTransition("pending", "published", "counterparty")).toBe(false);
    expect(canTransition("draft", "published", "counterparty")).toBe(false);
    expect(transitionsBy("counterparty")).toEqual([]);
  });

  it("refuses the initiator activating, completing, expiring or voiding a live relationship", () => {
    expect(canTransition("published", "active", "initiator")).toBe(false);
    expect(canTransition("active", "complete", "initiator")).toBe(false);
    expect(canTransition("active", "expired", "initiator")).toBe(false);
    expect(canTransition("active", "void", "initiator")).toBe(false);
  });

  it("refuses an operator selling: admin cannot publish or activate", () => {
    expect(canTransition("draft", "published", "admin")).toBe(false);
    expect(canTransition("pending", "published", "admin")).toBe(false);
    expect(canTransition("published", "active", "admin")).toBe(false);
  });

  it("refuses a move to where it already is", () => {
    for (const status of RELATIONSHIP_STATUSES) {
      for (const actor of RELATIONSHIP_ACTORS) {
        expect(canTransition(status, status, actor), `${actor}: ${status} → ${status}`).toBe(false);
      }
    }
  });

  it("gives the two closed statuses no way out, and refuses money as a way back", () => {
    for (const status of CLOSED_RELATIONSHIP_STATUSES) {
      expect(transitionsFrom(status), `${status} has an outgoing edge`).toEqual([]);
    }
    for (const status of RELATIONSHIP_STATUSES) {
      expect(isClosedRelationshipStatus(status)).toBe(
        (CLOSED_RELATIONSHIP_STATUSES as readonly string[]).includes(status),
      );
    }
    // #533 phase 3: `complete` and `void` are decisions and no payment event reopens them. The
    // table has no edge from either, whatever the actor, so the reactivation path cannot reach a
    // relationship a person ended.
    for (const actor of RELATIONSHIP_ACTORS) {
      for (const to of RELATIONSHIP_STATUSES) {
        expect(canTransition("complete", to, actor)).toBe(false);
        expect(canTransition("void", to, actor)).toBe(false);
      }
    }
  });

  it("revives an expired relationship only through the system, and only two ways", () => {
    // #533 phase 3 reversed phase 1's "expired is terminal": a lapse is *unpaid*, not decided, so
    // a payment lands and the relationship comes back. The two targets are the two origins.
    expect(targetsFrom("expired", "system")).toEqual(["active", "published"]);
    expect(targetsFrom("expired", "initiator")).toEqual([]);
    expect(targetsFrom("expired", "counterparty")).toEqual([]);
    expect(targetsFrom("expired", "admin")).toEqual([]);
    expect(actorsFor("expired", "active")).toEqual(["system"]);
    expect(actorsFor("expired", "published")).toEqual(["system"]);
  });

  it("reaches every non-terminal status from draft", () => {
    const seen = new Set<RelationshipStatus>(["draft"]);
    const queue: RelationshipStatus[] = ["draft"];
    while (queue.length > 0) {
      const from = queue.shift() as RelationshipStatus;
      for (const transition of transitionsFrom(from)) {
        if (seen.has(transition.to)) continue;
        seen.add(transition.to);
        queue.push(transition.to);
      }
    }
    expect([...seen].sort()).toEqual([...RELATIONSHIP_STATUSES].sort());
  });

  it("names the actors as what a screen renders, in lifecycle order", () => {
    expect(targetsFrom("draft", "initiator")).toEqual(["pending", "published", "void"]);
    expect(targetsFrom("published", "admin")).toEqual(["complete", "void"]);
    expect(targetsFrom("published", "system")).toEqual(["active", "expired"]);
    expect(targetsFrom("draft", "system")).toEqual([]);
  });

  it("is a closed table: no edge names an actor outside the four", () => {
    const actors: ReadonlySet<string> = new Set(RELATIONSHIP_ACTORS);
    for (const transition of RELATIONSHIP_TRANSITIONS) {
      for (const actor of transition.actors as readonly RelationshipActor[]) {
        expect(actors.has(actor), `${transition.from} → ${transition.to}: ${actor}`).toBe(true);
      }
      expect(isRelationshipStatus(transition.from)).toBe(true);
      expect(isRelationshipStatus(transition.to)).toBe(true);
      expect(transition.why.length).toBeGreaterThan(0);
    }
  });
});
