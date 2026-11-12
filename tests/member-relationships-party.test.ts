/**
 * #706 — **the same relationship, read by both people, with the write permission split off.**
 *
 * The owner's report was that a Counterparty's console list was empty: the relationship showed on
 * `/assessment/instances` (keyed on `party.user_id`) and not on `/dashboard/relationships` (keyed on
 * `relationship.initiator_user_id`). The fix is two predicates that must never be merged again, and
 * this file is the acceptance for both:
 *
 *   membership   `listMyRelationships` returns the row for **both** accounts, so a Counterparty is
 *                not told they have no relationships.
 *   permission   `readMyRelationship` gives the **initiator** the write flags and the Counterparty
 *                none of them (`aspectsEditable === false`, `publishable === false`,
 *                `offersRepublish === false`), on a row whose status would allow both.
 *
 * The rows come from a fake `queryRows` that answers the two statements this module issues, which
 * is the shape `tests/relationship-detail.test.ts` uses to hold the gate database-free. The fake
 * implements the membership rule the SQL expresses, and each test also asserts the statement itself
 * carries the party binding — a fake that agreed with a wrong query would satisfy neither.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import type { ItemRow, OptionRow, RecordRow } from "@/lib/db/rows";

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
  // #739 — the completion gate reads the obligation by session; this fixture has no payment facts,
  // which is the "not measured" branch (`readCompletionGate` answers `undefined`).
  readPaymentForSession: vi.fn(async () => undefined),
  paymentFactsOf: vi.fn(() => null),
}));

import { listMyRelationships, readMyRelationship } from "@/lib/member/relationships";

const template: Assessment = (() => {
  const found = assessments[0];
  if (found === undefined) throw new Error("data/assessments.ts carries no template to read");
  return found;
})();

const RELATIONSHIP_ID = "fc8b3f52-77d0-48db-a55e-4b0f9d5898e1";
const INITIATOR = "638efc4d-17b9-40a1-bf9b-d0043342434e";
const COUNTERPARTY = "567439b5-f122-4a0a-b35b-1785beb5ceed";
const STRANGER = "00000000-0000-4000-8000-000000000000";
const SESSION_RECORD = "member-session-706";
const COPY_RECORD = "member-config-706";

/** The relationship as the statement returns it, for a given viewer (#706's production row). */
function relationshipRowFor(viewer: string): Record<string, unknown> {
  const isInitiator = viewer === INITIATOR;
  const isCounterparty = viewer === COUNTERPARTY;
  return {
    id: RELATIONSHIP_ID,
    status: "draft",
    initiator_user_id: INITIATOR,
    viewer_role: isCounterparty ? "counterparty" : isInitiator ? "initiator" : null,
    initiator_name: "Jaden",
    created_at: new Date("2026-11-08T14:28:14.000Z"),
    published_at: null,
    expired_at: null,
    lapse_reason: null,
    template_id: COPY_RECORD,
    title: template.title,
    summary: template.summary,
    session_record_id: isCounterparty || isInitiator ? SESSION_RECORD : null,
    aspect_count: template.items.length,
    counterparty_name: "Walt",
    claimed: false,
    revoked: false,
    expires_at: null,
  };
}

const recordRow: RecordRow = {
  id: COPY_RECORD,
  slug: "member-config-706",
  record_type: "assessment",
  status: "draft",
  date: new Date("2026-11-08T14:28:14.000Z"),
  title: template.title,
  summary: template.summary,
};

const itemRows: ItemRow[] = template.items.map((item, position) => ({
  record_id: COPY_RECORD,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const optionRows: OptionRow[] = [];

/** Every statement this module issues, in the order the fake answers them. */
const statements: { sql: string; params: readonly unknown[] }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  statements.length = 0;
  readActiveSubscription.mockResolvedValue(null);
  readRelationshipPayment.mockResolvedValue(null);
  queryRows.mockImplementation(async (sql: string, params: readonly unknown[] = []) => {
    statements.push({ sql, params });
    if (sql.includes("FROM relationship rel")) {
      /*
       * The membership rule, in one place: the initiator, or an account bound to a party seat.
       * A stranger is answered `[]` — which is what the page turns into `notFound()`.
       */
      const viewer = String(params[0]);
      return viewer === INITIATOR || viewer === COUNTERPARTY ? [relationshipRowFor(viewer)] : [];
    }
    if (sql.includes("FROM record WHERE id = $1")) return [recordRow];
    if (sql.includes("FROM item WHERE record_id = $1")) return itemRows;
    if (sql.includes("FROM response_option WHERE record_id = $1")) return optionRows;
    throw new Error(`unexpected statement: ${sql}`);
  });
});

describe("listMyRelationships lists every relationship the viewer is a party to", () => {
  it("returns the same relationship to the initiator and to the Counterparty", async () => {
    const asInitiator = await listMyRelationships(INITIATOR);
    const asCounterparty = await listMyRelationships(COUNTERPARTY);

    expect(asInitiator.map((row) => row.id)).toEqual([RELATIONSHIP_ID]);
    expect(asCounterparty.map((row) => row.id)).toEqual([RELATIONSHIP_ID]);
  });

  it("keys the statement on the party binding, not on the initiator alone", async () => {
    await listMyRelationships(COUNTERPARTY);

    const [statement] = statements;
    expect(statement).toBeDefined();
    // The seat binding, reached through the session — the rule `lib/db/my-instances.ts` follows.
    expect(statement?.sql).toContain("FROM session vs");
    expect(statement?.sql).toContain("p.user_id = $1");
    expect(statement?.sql).toContain("OR EXISTS");
    // …and the viewer is the only parameter, so nothing can widen it from the URL.
    expect(statement?.params).toEqual([COUNTERPARTY]);
  });

  it("labels each row with the reader's own seat", async () => {
    const [initiatorRow] = await listMyRelationships(INITIATOR);
    const [counterpartyRow] = await listMyRelationships(COUNTERPARTY);

    expect(initiatorRow?.viewerRole).toBe("initiator");
    expect(initiatorRow?.isInitiator).toBe(true);
    expect(counterpartyRow?.viewerRole).toBe("counterparty");
    expect(counterpartyRow?.isInitiator).toBe(false);
  });

  it("answers a stranger with nothing", async () => {
    await expect(listMyRelationships(STRANGER)).resolves.toEqual([]);
  });
});

describe("readMyRelationship opens for the Counterparty, read-only", () => {
  it("gives the initiator the write flags on a draft", async () => {
    const view = await readMyRelationship(INITIATOR, RELATIONSHIP_ID);

    expect(view?.isInitiator).toBe(true);
    expect(view?.viewerRole).toBe("initiator");
    expect(view?.aspectsEditable).toBe(true);
    expect(view?.publishable).toBe(true);
  });

  it("gives the Counterparty the same relationship with every write flag false", async () => {
    const view = await readMyRelationship(COUNTERPARTY, RELATIONSHIP_ID);

    expect(view?.id).toBe(RELATIONSHIP_ID);
    expect(view?.isInitiator).toBe(false);
    expect(view?.viewerRole).toBe("counterparty");
    // The status would allow both — `draft` is editable and publishable — so these `false`s are
    // the permission and not the lifecycle.
    expect(view?.aspectsEditable).toBe(false);
    expect(view?.publishable).toBe(false);
    expect(view?.offersRepublish).toBe(false);
    expect(view?.trialWithoutLiveInvite).toBe(false);
  });

  it("still answers `undefined` for an account that is neither seat", async () => {
    await expect(readMyRelationship(STRANGER, RELATIONSHIP_ID)).resolves.toBeUndefined();
  });
});
