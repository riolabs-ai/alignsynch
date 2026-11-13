/**
 * #958 — **a relationship with no initiator member still has an initiator.**
 *
 * The owner's third rule is *no Initiator member → resolved through the modal*, and it was the one
 * rule with no working path. The sweep (#913) measured why on two rows: a draft whose
 * `relationship.initiator_user_id` is `NULL` read as a Counterparty's — the role chip said
 * "Initiator" (from the party seat) while `isInitiator` was `false`, both draft CTAs were absent,
 * and the screen behind the row opened with *"You are the Counterparty on this relationship"* about
 * the reader's own relationship. No publish band, no Invite Members, no Aspects editor — and so no
 * way into the pay modal, which is the only surface that takes a card.
 *
 * The demo branch ships that shape on **every** relationship (`scripts/db-seed.mjs` writes the two
 * account columns `NULL` on purpose — the seats are the binding), and so does every row a
 * signed-out creator wrote before #825. So this is not an edge case: it is the demo.
 *
 * Four seams, and each answers a different question:
 *
 *   the rule     `initiatorIsViewer()` — the column wins when it names somebody, `NULL` falls to
 *                the seat, and a *different* account in the column is never overruled by a seat
 *                (#706's protection, kept).
 *   the read     `readMyRelationship` on a `NULL` row: the seat-holder gets the three write flags
 *                and the modal's address resolves; the Counterparty on the same row gets none.
 *   the write    `saveAspects` accepts the seat-holder and still refuses the Counterparty — a
 *                screen and a transaction that disagreed is the other half of this defect.
 *   one resolver `lib/member/relationships.ts` carries no direct `initiator_user_id` comparison
 *                outside the resolver, so a later card cannot quietly re-derive half of it. That is
 *                the shape `tests/one-payment-surface.test.ts` takes for the capture.
 *
 * Nothing here renders Stripe and nothing opens a connection: the transaction is a scripted
 * `ActSql` (`relationship-edit-reorder-race.test.ts`'s path) and the read is a fake `queryRows`
 * (`member-relationships-party.test.ts`'s).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import type { ActSql, ActTransactionRunner } from "@/lib/admin/act";
import type { ItemRow, OptionRow, RecordRow } from "@/lib/db/rows";
import { initiatorIsViewer } from "@/lib/relationship/initiator";

const { queryRows, readActiveSubscription, readRelationshipPayment } = vi.hoisted(() => ({
  queryRows: vi.fn(),
  readActiveSubscription: vi.fn(),
  readRelationshipPayment: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  queryRows,
  DatabaseUnavailableError: class DatabaseUnavailableError extends Error {},
}));
vi.mock("@/lib/db/billing", () => ({ readActiveSubscription }));
vi.mock("@/lib/db/relationship-payment", () => ({
  readRelationshipPayment,
  openPaymentObligation: vi.fn(),
  readPaymentForSession: vi.fn(async () => undefined),
  paymentFactsOf: vi.fn(() => null),
}));

import { readMyRelationship, saveAspects } from "@/lib/member/relationships";

/* ------------------------------------------------------------------ *
 * The rule
 * ------------------------------------------------------------------ */

describe("initiatorIsViewer — the column first, the seat only when it names nobody", () => {
  const AVERY = "3c567793-fd5d-4996-b5d9-9d30fea69f39";
  const ROWAN = "d763df4c-7118-484f-9d14-1f1403eab83a";

  it("names the account the column records, whoever holds a seat", () => {
    // The ordinary case, and #706's protection: a hand-edited `party` row cannot outvote the column.
    expect(
      initiatorIsViewer({ initiatorUserId: AVERY, viewerSeat: "initiator", viewerUserId: AVERY }),
    ).toBe(true);
    expect(
      initiatorIsViewer({ initiatorUserId: AVERY, viewerSeat: "initiator", viewerUserId: ROWAN }),
    ).toBe(false);
    expect(
      initiatorIsViewer({
        initiatorUserId: AVERY,
        viewerSeat: "counterparty",
        viewerUserId: ROWAN,
      }),
    ).toBe(false);
  });

  it("falls to the Initiator seat when the column names nobody — #958", () => {
    // The demo seed's shape, and the row the sweep measured.
    expect(
      initiatorIsViewer({ initiatorUserId: null, viewerSeat: "initiator", viewerUserId: AVERY }),
    ).toBe(true);
    // …and the other seat is still the other seat.
    expect(
      initiatorIsViewer({ initiatorUserId: null, viewerSeat: "counterparty", viewerUserId: ROWAN }),
    ).toBe(false);
    // …and a viewer with no seat at all is nobody, however the column reads.
    expect(
      initiatorIsViewer({ initiatorUserId: null, viewerSeat: null, viewerUserId: AVERY }),
    ).toBe(false);
  });

  it("reads a blank column as nobody, because a hand repair can write one", () => {
    expect(
      initiatorIsViewer({ initiatorUserId: "", viewerSeat: "initiator", viewerUserId: AVERY }),
    ).toBe(true);
    expect(
      initiatorIsViewer({ initiatorUserId: "   ", viewerSeat: "initiator", viewerUserId: AVERY }),
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * The read — the row as `listMyRelationships`/`readMyRelationship` build it
 * ------------------------------------------------------------------ */

const template: Assessment = (() => {
  const found = assessments[0];
  if (found === undefined) throw new Error("data/assessments.ts carries no template to read");
  return found;
})();

const RELATIONSHIP_ID = "relationship-assessment-instance-avery-rowan";
const SESSION_RECORD = "assessment-instance-avery-rowan";
const AVERY = "3c567793-fd5d-4996-b5d9-9d30fea69f39";
const ROWAN = "d763df4c-7118-484f-9d14-1f1403eab83a";

/**
 * The demo row, exactly: a `draft`, `NULL` in the account column, a session, and the two seats
 * bound. `viewer` decides which seat the statement's `viewer_role` subquery would answer.
 */
function noInitiatorRowFor(viewer: string): Record<string, unknown> {
  return {
    id: RELATIONSHIP_ID,
    status: "draft",
    initiator_user_id: null,
    viewer_role: viewer === AVERY ? "initiator" : viewer === ROWAN ? "counterparty" : null,
    initiator_name: "Avery",
    created_at: new Date("2026-11-01T09:00:00.000Z"),
    published_at: null,
    expired_at: null,
    lapse_reason: null,
    template_id: SESSION_RECORD,
    template_slug: "relationship-basics",
    title: template.title,
    relationship_title: "Avery & Rowan",
    summary: template.summary,
    session_record_id: SESSION_RECORD,
    aspect_count: template.items.length,
    counterparty_name: "Rowan",
    claimed: false,
    revoked: false,
    expires_at: null,
  };
}

const recordRow: RecordRow = {
  id: SESSION_RECORD,
  slug: "relationship-basics",
  record_type: "assessment",
  status: "draft",
  date: new Date("2026-11-01T09:00:00.000Z"),
  title: template.title,
  summary: template.summary,
};

const itemRows: ItemRow[] = template.items.map((item, position) => ({
  record_id: SESSION_RECORD,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const optionRows: OptionRow[] = [];

/**
 * Set by a case before it reads; the fake statement answers this viewer's seat.
 *
 * Module scope rather than an argument because `queryRows` is mocked once for the file and the
 * statement carries the viewer as `$1` — the fake has to know who is asking.
 */
let viewerId: string = AVERY;

beforeEach(() => {
  vi.clearAllMocks();
  viewerId = AVERY;
  readActiveSubscription.mockResolvedValue(null);
  readRelationshipPayment.mockResolvedValue(null);
  queryRows.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM relationship rel")) return [noInitiatorRowFor(viewerId)];
    if (sql.includes("FROM record WHERE id")) return [{ ...recordRow, owner_user_id: null }];
    if (sql.includes("FROM item")) return itemRows;
    if (sql.includes("FROM response_option")) return optionRows;
    return [];
  });
});

describe("a relationship with no initiator member, read", () => {
  it("gives the account in the Initiator seat every write flag", async () => {
    viewerId = AVERY;
    const view = await readMyRelationship(AVERY, RELATIONSHIP_ID);
    expect(view).toBeDefined();
    if (view === undefined) return;
    // The three flags the bands are drawn from: without them the screen had no editor, no publish
    // band and no reissue — and the row's own CTAs were absent, which is the reported defect.
    expect(view.isInitiator).toBe(true);
    expect(view.aspectsEditable).toBe(true);
    expect(view.publishable).toBe(true);
    expect(view.viewerRole).toBe("initiator");
    // The initiator owns the words, so the Counterparty's fork door is not theirs (#785).
    expect(view.canForkTemplate).toBe(false);
    // …and the pay modal's address exists, because a bound seat hangs off a session (#958's
    // header): stage 5 is reached with `?instance=<session>`, so the route is open.
    expect(view.sessionRecordId).not.toBeNull();
  });

  it("still reads the Counterparty on the same row as read-only", async () => {
    viewerId = ROWAN;
    const view = await readMyRelationship(ROWAN, RELATIONSHIP_ID);
    expect(view).toBeDefined();
    if (view === undefined) return;
    expect(view.isInitiator).toBe(false);
    expect(view.viewerRole).toBe("counterparty");
    expect(view.aspectsEditable).toBe(false);
    expect(view.publishable).toBe(false);
    expect(view.offersRepublish).toBe(false);
    // #785 — and the one action that is theirs.
    expect(view.canForkTemplate).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * The write — the same question, asked where the write would happen
 * ------------------------------------------------------------------ */

/**
 * A transaction that answers the statements `saveAspects` issues, with the demo row's shape.
 *
 * `seat` is what `party` says about the actor: `"initiator"` for Avery, `"counterparty"` for Rowan,
 * `null` for an account with no seat. The version pin names the session's own copy, so a save
 * writes no snapshot — the cheapest honest scene, and it keeps the case about the refusal.
 */
class DraftDb {
  readonly statements: string[] = [];

  constructor(readonly seat: "initiator" | "counterparty" | null) {}

  readonly sql: ActSql = {
    query: async <R>(text: string): Promise<{ rows: R[] }> => {
      const sql = text.replace(/\s+/g, " ").trim();
      this.statements.push(sql);
      return { rows: this.answer(sql) as R[] };
    },
  };

  private answer(sql: string): unknown[] {
    if (sql.startsWith("SELECT role FROM user_profile")) return [{ role: "member" }];
    if (sql.startsWith("INSERT INTO admin_action")) return [{ id: "admin-action-958" }];
    if (sql.startsWith("SELECT id, status, template_id, template_version_id, initiator_user_id")) {
      return [
        {
          id: RELATIONSHIP_ID,
          status: "draft",
          // The template the relationship was started from, **not** the session's own copy — so a
          // save writes the pin's version and no snapshot (#936's second branch), which keeps this
          // scene about the refusal rather than about `template_version`.
          template_id: "record-template-958",
          template_version_id: "template-version-958-v1",
          // The defect, as data: the column names nobody.
          initiator_user_id: null,
        },
      ];
    }
    // #958's own statement — the seat, read only because the column named nobody.
    if (sql.startsWith("SELECT p.role FROM session s")) {
      return this.seat === null ? [] : [{ role: this.seat }];
    }
    if (sql.startsWith("SELECT record_id FROM session WHERE relationship_id")) {
      return [{ record_id: SESSION_RECORD }];
    }
    if (sql.startsWith("SELECT id FROM record WHERE id = $1 FOR UPDATE")) {
      return [{ id: SESSION_RECORD }];
    }
    if (sql.startsWith("SELECT item_id, prompt, left_value, right_value FROM item")) {
      return itemRows.map((item) => ({
        item_id: item.item_id,
        prompt: item.prompt,
        left_value: item.left_value,
        right_value: item.right_value,
      }));
    }
    if (sql.startsWith("SELECT version FROM template_version")) return [{ version: 1 }];
    if (sql.startsWith("UPDATE record SET title")) return [];
    if (sql.startsWith("DELETE FROM item")) return [];
    if (sql.startsWith("INSERT INTO item")) return [];
    return [];
  }
}

function runnerOf(db: DraftDb): ActTransactionRunner {
  return { transaction: async (work) => work(db.sql) };
}

const DRAFT: Assessment = {
  ...template,
  id: SESSION_RECORD,
  slug: "relationship-basics",
  status: "draft",
  title: template.title,
  summary: template.summary,
};

describe("a relationship with no initiator member, written", () => {
  it("accepts a save from the account in the Initiator seat", async () => {
    const db = new DraftDb("initiator");
    const result = await saveAspects(
      {
        actorUserId: AVERY,
        reason: "958 — the seat-holder saves",
        relationshipId: RELATIONSHIP_ID,
        record: DRAFT,
        saveAs: "pending",
      },
      runnerOf(db),
    );
    expect(result.after.status).toBe("pending");
    // The seat really was consulted, and only because the column named nobody.
    expect(db.statements.some((sql) => sql.startsWith("SELECT p.role FROM session s"))).toBe(true);
  });

  it("still refuses the Counterparty on the same relationship", async () => {
    const db = new DraftDb("counterparty");
    await expect(
      saveAspects(
        {
          actorUserId: ROWAN,
          reason: "958 — the other seat tries",
          relationshipId: RELATIONSHIP_ID,
          record: DRAFT,
          saveAs: "pending",
        },
        runnerOf(db),
      ),
    ).rejects.toThrow(/started by another account/);
    // Nothing was written: the refusal is the first statement after the lock.
    expect(db.statements.some((sql) => sql.startsWith("UPDATE record"))).toBe(false);
  });

  it("refuses an account with no seat, on a row whose column names nobody", async () => {
    // The fallback must not turn "no initiator member" into "any account may write".
    const db = new DraftDb(null);
    await expect(
      saveAspects(
        {
          actorUserId: "00000000-0000-4000-8000-000000000000",
          reason: "958 — a stranger",
          relationshipId: RELATIONSHIP_ID,
          record: DRAFT,
          saveAs: "pending",
        },
        runnerOf(db),
      ),
    ).rejects.toThrow(/started by another account/);
  });
});

/* ------------------------------------------------------------------ *
 * One resolver, mechanically
 * ------------------------------------------------------------------ */

describe("the permission has one home", () => {
  const SOURCE = readFileSync(join(__dirname, "..", "lib/member/relationships.ts"), "utf8");

  it("carries no direct initiator_user_id comparison outside the resolver", () => {
    /*
     * The half of #958 a later card would reintroduce by hand: a write that compares the account
     * column itself keeps refusing the seat-holder after the read was mended, so the screen offers a
     * control the transaction refuses. Every write goes through `actorIsInitiator()`; the only
     * comparisons left in the module are that function's and the resolver's own docstring.
     */
    const comparisons = SOURCE.split("\n")
      .map((line, index) => ({ line: line.trim(), index: index + 1 }))
      .filter(({ line }) => line.includes("initiator_user_id") && line.includes("!=="));
    expect(comparisons).toEqual([]);
  });

  it("asks the shared rule rather than a fourth copy of it", () => {
    expect(SOURCE).toContain('from "@/lib/relationship/initiator"');
    expect(SOURCE).toContain("initiatorIsViewer({");
    expect(SOURCE).toContain("await actorIsInitiator(sql, rel, request.actorUserId)");
    expect(SOURCE).toContain("await actorIsInitiator(poolSql, row, request.actorUserId)");
  });
});
