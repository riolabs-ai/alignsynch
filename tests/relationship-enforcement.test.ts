/**
 * `lib/relationship/enforcement.ts` (#533 phase 3) — the SQL, against a scripted connection.
 *
 * The module is the only place that reads the rows behind a membership and the only place that
 * writes a lapse, so the cases here pin the statements themselves:
 *
 *   - **the lapse is written at the instant the *row* says**, not at the request's clock: a trial
 *     that ran out on the 1st must not be recorded as ending whenever someone next opened the page.
 *     That is the same instant `membershipSentence()` prints, so the copy cannot drift from the row.
 *   - **the guard is the two lapsable statuses**, so `complete`/`void` — somebody's decision — are
 *     never overwritten by a payment event or a refused write.
 *   - **the payment rule is read from the entitlement, in both directions**, and the reactivation
 *     target is derived from the seat rather than from a stored origin.
 *   - **the trial's holder is named**: the card's refusal quotes the relationship, not only a date.
 *
 * The fake is not a SQL engine — it answers the statements this module sends and records the rest.
 * Where a case asserts a value in the UPDATE's parameters, that is the only place the fact exists.
 */
import { describe, expect, it } from "vitest";

import {
  LAPSABLE_STATUSES,
  lapseIfDue,
  syncRelationshipsWithSubscription,
  trialHolderOf,
  type Sql,
} from "@/lib/relationship/enforcement";

type Row = Record<string, unknown>;

interface Call {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
}

/** A connection that answers by the statement's own text, in the order the handlers are given. */
function fakeSql(handlers: readonly { readonly match: RegExp; readonly rows?: readonly Row[] }[]): {
  readonly sql: Sql;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  const sql: Sql = {
    async query<R = Row>(text: string, values?: readonly unknown[]) {
      calls.push({ text, values });
      const handler = handlers.find((candidate) => candidate.match.test(text));
      return { rows: (handler?.rows ?? []) as readonly R[] };
    },
  };
  return { sql, calls };
}

/** The four columns `relationshipFactsOf` selects, plus the column list the UPDATE touches. */
const RELATIONSHIP_ROW = /FROM relationship\s+WHERE id = \$1/;
const SUBSCRIPTION = /FROM billing_subscription/;
const COUNTERPARTY = /SELECT EXISTS/;
const LAPSE_UPDATE = /UPDATE relationship\s+SET status = 'expired',\s+expired_at/;
const REACTIVATE = /SET status = CASE/;

const NOW = new Date("2026-11-04T12:00:00.000Z");
/** The subscription's own period end, ten minutes before `NOW` and after the publish. */
const PERIOD_END = new Date("2026-11-04T11:30:00.000Z");

const publishedRow = {
  id: "rel-1",
  status: "published",
  initiator_user_id: "auth-1",
  expired_at: null,
  lapse_reason: null,
};

describe("lapseIfDue", () => {
  it("writes the derived instant and the reason, not the request clock", async () => {
    const { sql, calls } = fakeSql([
      { match: RELATIONSHIP_ROW, rows: [publishedRow] },
      { match: SUBSCRIPTION, rows: [{ status: "trialing", current_period_end: PERIOD_END }] },
      { match: COUNTERPARTY, rows: [{ present: false }] },
      { match: LAPSE_UPDATE, rows: [] },
    ]);

    const reading = await lapseIfDue(sql, "rel-1", NOW);

    const update = calls.find((call) => LAPSE_UPDATE.test(call.text));
    expect(update).toBeDefined();
    // The period end, not `NOW`: the row records when the money stopped, not when it was noticed.
    expect(update?.values?.[1]).toBe(PERIOD_END.toISOString());
    expect(update?.values?.[2]).toBe("trial-ended");
    expect(update?.values?.[3]).toEqual(LAPSABLE_STATUSES);
    expect(reading?.status).toBe("expired");
    expect(reading?.membership.state).toBe("lapsed");
    expect(reading?.membership.endedAt?.toISOString()).toBe(PERIOD_END.toISOString());
  });

  it("does not write a lapse on a relationship somebody closed", async () => {
    const { sql, calls } = fakeSql([
      {
        match: RELATIONSHIP_ROW,
        rows: [{ ...publishedRow, status: "complete", expired_at: null }],
      },
      { match: SUBSCRIPTION, rows: [{ status: "trialing", current_period_end: PERIOD_END }] },
      { match: COUNTERPARTY, rows: [{ present: true }] },
    ]);

    const reading = await lapseIfDue(sql, "rel-1", NOW);

    expect(calls.some((call) => LAPSE_UPDATE.test(call.text))).toBe(false);
    expect(reading?.status).toBe("complete");
    expect(reading?.membership.state).toBe("closed");
  });

  it("treats a published relationship with no subscription row as lapsed, and records why", async () => {
    // The subscription is gone entirely (a purged row, a reset branch): nothing pays, so the pair is
    // read-only and the reason is the cancellation that removed it — not `trial-ended`, which would
    // claim a trial window the account no longer has.
    const { sql, calls } = fakeSql([
      { match: RELATIONSHIP_ROW, rows: [publishedRow] },
      { match: COUNTERPARTY, rows: [{ present: false }] },
      { match: LAPSE_UPDATE, rows: [] },
    ]);

    const reading = await lapseIfDue(sql, "rel-1", NOW);

    const update = calls.find((call) => LAPSE_UPDATE.test(call.text));
    expect(update?.values?.[2]).toBe("subscription-canceled");
    expect(reading?.membership.state).toBe("lapsed");
  });
});

describe("syncRelationshipsWithSubscription", () => {
  it("reactivates an expired relationship when the account is entitled", async () => {
    const { sql, calls } = fakeSql([{ match: REACTIVATE, rows: [{ id: "rel-1" }] }]);

    const consequence = await syncRelationshipsWithSubscription(
      sql,
      { userId: "auth-1", status: "active", currentPeriodEnd: PERIOD_END },
      NOW,
    );

    expect(consequence).toEqual({ entitled: true, reactivated: 1, lapsed: 0 });
    const update = calls.find((call) => REACTIVATE.test(call.text));
    // The seat decides whether the relationship comes back as `active` or as `published`: a link
    // nobody has claimed must work again, and a bound pair must not read as an unclaimed invitation.
    expect(update?.text).toContain("p.role = 'counterparty'");
    expect(update?.text).toContain("THEN 'active'");
    expect(update?.text).toContain("ELSE 'published'");
    expect(update?.text).toContain("AND r.status = 'expired'");
  });

  it("lapses the account's live relationships when the entitlement ends", async () => {
    const { sql, calls } = fakeSql([
      { match: LAPSE_UPDATE, rows: [{ id: "rel-1" }, { id: "rel-2" }] },
    ]);

    const consequence = await syncRelationshipsWithSubscription(
      sql,
      { userId: "auth-1", status: "canceled", currentPeriodEnd: PERIOD_END },
      NOW,
    );

    expect(consequence).toEqual({ entitled: false, reactivated: 0, lapsed: 2 });
    const update = calls.find((call) => LAPSE_UPDATE.test(call.text));
    expect(update?.values?.[1]).toBe(PERIOD_END.toISOString());
    expect(update?.values?.[2]).toBe("subscription-canceled");
    expect(update?.values?.[3]).toEqual(LAPSABLE_STATUSES);
    // `COALESCE` keeps the instant of the first lapse: a second event does not re-date the ending.
    expect(update?.text).toContain("COALESCE(expired_at, $2)");
  });

  it("counts `past_due` as entitled — dunning is a grace period", async () => {
    const { sql } = fakeSql([{ match: REACTIVATE, rows: [] }]);
    const consequence = await syncRelationshipsWithSubscription(
      sql,
      { userId: "auth-1", status: "past_due", currentPeriodEnd: PERIOD_END },
      NOW,
    );
    expect(consequence.entitled).toBe(true);
  });
});

describe("trialHolderOf", () => {
  it("names the relationship the running trial pays for, and its title", async () => {
    const { sql } = fakeSql([
      {
        match: /LEFT JOIN relationship r ON bs.provider_subscription_id/,
        rows: [
          {
            relationship_id: "rel-1",
            title: "Probe template for the lapse",
            current_period_end: new Date("2026-11-18T11:00:00.000Z"),
          },
        ],
      },
    ]);

    const holder = await trialHolderOf(sql, "auth-1");
    expect(holder?.relationshipId).toBe("rel-1");
    expect(holder?.title).toBe("Probe template for the lapse");
    expect(holder?.endsAt.toISOString()).toBe("2026-11-18T11:00:00.000Z");
  });

  it("falls back to the account's most recently published relationship", async () => {
    const { sql } = fakeSql([
      {
        match: /LEFT JOIN relationship r ON bs.provider_subscription_id/,
        rows: [{ relationship_id: null, title: null, current_period_end: PERIOD_END }],
      },
      {
        match: /FROM relationship r\s+JOIN record t/,
        rows: [{ relationship_id: "rel-9", title: "Most recent" }],
      },
    ]);

    const holder = await trialHolderOf(sql, "auth-1");
    expect(holder?.relationshipId).toBe("rel-9");
    expect(holder?.title).toBe("Most recent");
  });
});
