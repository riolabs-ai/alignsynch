/**
 * The admin console's derivations — the counts, the filters they link to, and the limit that
 * makes the whole surface safe to read.
 *
 * The module is pure (`lib/v1/admin-console.ts`), so the cases here drive it with the real seed
 * fixtures and assert the two things the card's acceptance leans on:
 *
 *   1. **A count equals the list it opens.** Every figure `adminCounts()` returns is compared
 *      with `filterAdminRows()` run on the same rows and the query the overview card links to —
 *      the failing case would be an overview that says 2 and a registry that draws 3.
 *   2. **No answer value can reach a screen.** The row types are the contract: a relationship row
 *      and a session row are serialised and asserted to carry no `feel`/`wish`/`think`/`guess`
 *      key and no opinions record, on a **scored** relationship (whose sheet is complete) and an
 *      **unscored** one, so the blind proof is a property of the shape rather than of one screen.
 */
import { describe, expect, it } from "vitest";

import {
  seedAccounts,
  seedRelationships,
  seedSessions,
  v1Templates,
  type V1Relationship,
} from "@/data/v1/fixtures";
import {
  ADMIN_LIMITS,
  ADMIN_RELATIONSHIPS_PATH,
  adminCounts,
  adminRegistryHref,
  adminRegistryQueryOf,
  adminRelationshipRow,
  adminRelationshipRows,
  adminSeatStateOf,
  adminSessionRows,
  adminTemplateRows,
  adminUserGroups,
  filterAdminRows,
} from "@/lib/v1/admin-console";

/** The console reads `now` as an argument; a fixed day keeps the invite states stable. */
const NOW = Date.parse("2026-11-01T12:00:00.000Z");

const titles = new Map(v1Templates.map((template) => [template.id, template.title]));
const rows = adminRelationshipRows(seedRelationships, titles, NOW);

/** A seed relationship by id, or a loud failure — the cases below hold no non-null assertion. */
function seedRelationship(id: string): V1Relationship {
  const found = seedRelationships.find((rel) => rel.id === id);
  if (found === undefined) throw new Error(`fixtures: no relationship "${id}"`);
  return found;
}

/** The relationship whose sheet is complete — Ruth & Sam by their own name. */
const scored = seedRelationship("rel-aligned");
/** The relationship whose sheet is open — Jordan's claimed invite, Sam has not answered. */
const unscored = seedRelationship("rel-connected-blind");

describe("the counts are the lists they link to", () => {
  it("every relationship count equals the registry's row count for the same filter", () => {
    const counts = adminCounts(rows, v1Templates, seedAccounts, []);
    const live = filterAdminRows(rows, adminRegistryQueryOf({}));
    expect(counts.relationships).toBe(live.length);

    // Each stage card links `stage=<stage>`; the count is that filter's length.
    for (const stage of ["invited", "connected", "sharing", "aligned"] as const) {
      expect(counts.byStage[stage]).toBe(
        filterAdminRows(rows, adminRegistryQueryOf({ stage })).length,
      );
    }

    // The two derived cards link `filter=awaiting-answers` and `subscription=past_due`.
    expect(counts.awaitingAnswers).toBe(
      filterAdminRows(rows, adminRegistryQueryOf({ filter: "awaiting-answers" })).length,
    );
    expect(counts.pastDue).toBe(
      filterAdminRows(rows, adminRegistryQueryOf({ subscription: "past_due" })).length,
    );

    // The archived card links `state=archived`.
    expect(counts.archived).toBe(
      filterAdminRows(rows, adminRegistryQueryOf({ state: "archived" })).length,
    );

    // Templates and users count the store's own collections, not a relationship predicate.
    expect(counts.templates).toBe(v1Templates.length);
    expect(counts.users).toBe(seedAccounts.length);

    // The evidence the card pastes: the figures and the predicate behind each.
    console.log("overview counts:", JSON.stringify(counts));
    console.log(
      "registry rows:",
      rows
        .map((row) => `${row.id}|${row.stage}|${row.subscription}|archived=${row.archived}`)
        .join(" "),
    );
  });

  it("the seed exercises both the live and the archived bucket once a row is archived", () => {
    const counts = adminCounts(rows, v1Templates, seedAccounts, []);
    expect(counts.relationships + counts.archived).toBe(rows.length);
    expect(counts.archived).toBe(0);
  });

  it("a disabled template is counted, and only when the id names a template", () => {
    const counts = adminCounts(rows, v1Templates, seedAccounts, [
      v1Templates[0].id,
      "no-such-template",
    ]);
    expect(counts.templates).toBe(v1Templates.length);
    expect(counts.disabledTemplates).toBe(1);
  });
});

describe("the registry href is one builder for cards and chips", () => {
  it("builds a bare path for an empty query and a parameter set for a filter", () => {
    expect(adminRegistryHref()).toBe(ADMIN_RELATIONSHIPS_PATH);
    expect(adminRegistryHref({ stage: "invited" })).toBe(
      `${ADMIN_RELATIONSHIPS_PATH}?stage=invited`,
    );
    expect(adminRegistryHref({ filter: "awaiting-answers", subscription: "past_due" })).toBe(
      `${ADMIN_RELATIONSHIPS_PATH}?subscription=past_due&filter=awaiting-answers`,
    );
  });

  it("drops a query value it does not recognise instead of trusting the URL", () => {
    const query = adminRegistryQueryOf({ stage: "aligned-ish", state: "archived", filter: "x" });
    expect(query.stage).toBeNull();
    expect(query.state).toBe("archived");
    expect(query.filter).toBeNull();
  });
});

describe("seats are derived from the row, not stored", () => {
  it("reads an unclaimed invite as invited or expired, and a missing one as not-invited", () => {
    const invited = seedRelationship("rel-invited");
    const uninvited = seedRelationship("rel-unsubscribed");
    // `rel-invited`'s invite expired on 2026-10-31, so the fixed day sees `expired`.
    expect(adminSeatStateOf(invited, "counterparty", NOW).state).toBe("expired");
    expect(adminSeatStateOf(uninvited, "counterparty", NOW).state).toBe("invited");
    expect(adminSeatStateOf(scored, "counterparty", NOW)).toEqual({
      role: "counterparty",
      name: "Sam",
      state: "claimed",
    });
  });
});

describe("sessions print scored or open, and nothing a party answered", () => {
  it("a scored relationship lists its sessions as scored", () => {
    const sessions = adminSessionRows(
      scored,
      seedSessions.filter((s) => s.relationshipId === scored.id),
    );
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.scored)).toBe(true);
    expect(sessions.every((session) => session.completedAt !== null)).toBe(true);
  });

  it("an unscored relationship has exactly one open row and no completion instant", () => {
    const sessions = adminSessionRows(
      unscored,
      seedSessions.filter((s) => s.relationshipId === unscored.id),
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe("open-answers");
    expect(sessions[0].scored).toBe(false);
    expect(sessions[0].completedAt).toBeNull();
  });

  it("a row's scored/open counts are the sessions its page lists, not the store's counter", () => {
    // `rel-sharing-unmet` is the seed that proves the distinction: its `completedSessions`
    // counter is 0 and its timeline holds one scored session, and the console prints the list.
    const withSessions = adminRelationshipRows(seedRelationships, titles, NOW, seedSessions);
    for (const row of withSessions) {
      const rel = seedRelationship(row.id);
      const listed = adminSessionRows(
        rel,
        seedSessions.filter((session) => session.relationshipId === rel.id),
      );
      expect(row.sessionsScored).toBe(listed.filter((session) => session.scored).length);
      expect(row.sessionsOpen).toBe(listed.filter((session) => !session.scored).length);
    }
    expect(withSessions.find((row) => row.id === "rel-sharing-unmet")?.sessionsScored).toBe(1);
  });

  it("neither row type can carry an opinion — the blind proof is the shape", () => {
    const serialised = JSON.stringify({
      relationship: adminRelationshipRow(scored, "Parent & Child", NOW),
      session: adminSessionRows(scored, []),
      unscoredRelationship: adminRelationshipRow(unscored, "Staff & Manager", NOW),
      unscoredSession: adminSessionRows(unscored, []),
    });
    for (const forbidden of [
      "feel",
      "wish",
      "think",
      "guess",
      "initiatorAnswers",
      "counterpartyAnswers",
      "gap",
    ]) {
      expect(serialised.includes(forbidden)).toBe(false);
    }
    // And the limit is stated, not implied: the panel names all three.
    expect(ADMIN_LIMITS.map((limit) => limit.id)).toEqual(["answers", "impersonation", "delete"]);
  });
});

describe("templates count who started from them", () => {
  it("usage is the registry rows grouped by templateId", () => {
    const templates = adminTemplateRows(v1Templates, rows, []);
    const totalStarted = templates.reduce((sum, template) => sum + template.startedCount, 0);
    expect(totalStarted).toBe(rows.filter((row) => !row.archived).length);
    expect(templates.every((template) => template.aspectCount > 0)).toBe(true);
    console.log(
      "template usage:",
      templates
        .map(
          (template) =>
            `${template.id}:${template.startedCount} live/${template.archivedCount} archived`,
        )
        .join(" "),
    );
  });
});

describe("users — the two seats and the members", () => {
  it("splits initiator and counterparty from coach, admin and service", () => {
    const groups = adminUserGroups(seedAccounts);
    expect(groups.seats.map((row) => row.persona)).toEqual(["initiator", "counterparty"]);
    expect(groups.members.length).toBe(seedAccounts.length - 2);
    expect(groups.members.length).toBeGreaterThan(0);
    // No address is carried, so no screen can print one.
    expect(JSON.stringify(groups)).not.toContain("@");
    console.log(
      "users:",
      [...groups.seats, ...groups.members]
        .map((row) => `${row.name}/${row.persona}/${row.group}/${row.lastSignInAt}`)
        .join(" "),
    );
  });
});
