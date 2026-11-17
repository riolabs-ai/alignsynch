/**
 * Stage 5's Send, against **real Postgres**.
 *
 * The defect this file was born for is a column on the wrong table: `sendDraftInvitation()` selected
 * `r.method_captured_at` from `relationship`, which has no such column — it lives on
 * `relationship_payment` (`0036_relationship_payment.sql:65`). Postgres answered `42703` and the
 * handler threw, so **every** send on a real database was a 500, whatever the relationship's state.
 *
 * A fake SQL surface cannot catch that: the failure is the planner's, not the code's. So this runs
 * the real function against a real schema, in a transaction-shaped fixture of its own.
 *
 * **The money question left the send (#1115, spec D3).** #1012 (#1010 R2) made the send wait for the
 * Initiator's live subscription in `billing_subscription`; the trial now opens when the Counterparty
 * accepts, so at the instant a draft is sent there is no acceptance and no membership — the gate
 * would refuse every send the flow depends on, and it was removed with the anchor move. What this
 * file proves now is the two facts that remain: the query **runs** on a schema with no subscription
 * row (the `42703` class of defect), and the send writes **no** subscription row of its own.
 *
 * **Skipped unless `DATABASE_URL` is set**, exactly like the other `*-live.test.ts` files: the gate
 * has no connection string by design (`docs/operations/gate.md`), so this costs the gate nothing
 * and runs when someone points it at a branch.
 *
 * **It leaves nothing behind.** Every row is created under a `probe-send-…` id and deleted in
 * `afterAll`. No seeded relationship is read or written.
 *
 *     DATABASE_URL=<branch url> pnpm exec vitest run tests/stage5-send-live.test.ts
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sendDraftInvitation } from "@/lib/flow/store";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;

const TAG = `probe-send-${Date.now().toString(36)}`;
const NOW = new Date("2026-03-01T12:00:00.000Z");

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const created: string[] = [];
const payerIds: string[] = [];

/**
 * A draft relationship with a live session and two seats — the state stage 5's Send is pressed in.
 *
 * `status = 'draft'` on purpose: the send's own gate is `canTransition(status, "published")`, and a
 * published row would be refused before the query under test ever ran.
 */
async function draftRelationship(suffix: string): Promise<string> {
  const relationshipId = `${TAG}-${suffix}`;
  const templateId = `${relationshipId}-template`;
  const versionId = `${relationshipId}-version`;
  const sessionId = `${relationshipId}-session`;
  const payerId = `${relationshipId}-payer`;
  created.push(relationshipId);
  payerIds.push(payerId);

  for (const [id, title] of [
    [templateId, "Send probe template"],
    [sessionId, "Send probe session"],
  ] as const) {
    await pool.query(
      `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
       VALUES ($1, $1, 'assessment', 'published', now(), $2, 'probe', NULL, NULL, 'private')`,
      [id, title],
    );
  }
  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 1, '{}'::jsonb, now(), NULL)`,
    [versionId, templateId],
  );
  await pool.query(
    `INSERT INTO relationship
       (id, template_id, template_version_id, initiator_user_id, status, created_at, published_at)
     VALUES ($1, $2, $3, $4, 'draft', $5, NULL)`,
    [relationshipId, templateId, versionId, payerId, NOW],
  );
  await pool.query(
    `INSERT INTO session (record_id, template_record_id, relationship_id, name, mode, alignment_setting, round)
     VALUES ($1, $2, $3, 'Send probe', 'basic', 'soft', 1)`,
    [sessionId, templateId, relationshipId],
  );
  await pool.query(
    `INSERT INTO party (session_record_id, role, name, user_id)
     VALUES ($1, 'initiator', 'Init', $2), ($1, 'counterparty', 'Counter', NULL)`,
    [sessionId, payerId],
  );
  return relationshipId;
}

/**
 * The row a paid account holds — `billing_subscription`, keyed by user, with one of the entitling
 * statuses (`active`, `trialing`, `past_due`).
 *
 * The send no longer reads it (#1115), so this fixture is no longer *required* for a send to go
 * out; it stays because the interesting case after the anchor move is the one **without** it, and a
 * suite that only ever ran unpaid could not tell a removed gate from a gate that happens to pass.
 *
 * `plan_id`/`interval` are held to a seeded `billing_plan` row by `billing_subscription_plan_fk`;
 * `basic/month` is the tier stage 5 sells and is in every migrated database (0018).
 */
async function liveMembership(payerUserId: string): Promise<void> {
  await pool.query(
    `INSERT INTO billing_subscription
       (user_id, plan_id, interval, provider, provider_subscription_id, status, current_period_end)
     VALUES ($1, 'basic', 'month', 'mock', $2, 'active', $3)`,
    [payerUserId, `${payerUserId}-sub`, new Date(NOW.getTime() + 30 * 86_400_000)],
  );
}

/** Every subscription row for one probe account — the 0-row / 1-row evidence for a send. */
async function subscriptionRows(userId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM billing_subscription WHERE user_id = $1",
    [userId],
  );
  return rows[0]?.n ?? 0;
}

live("stage 5's Send sends without a membership, and writes no trial", () => {
  // The hooks live **inside** the describe: `describe.skip` with no `DATABASE_URL` must not open a
  // connection, or the gate (which has no connection string by design) fails on the pool instead of
  // skipping the file.
  beforeAll(async () => {
    // vitest still runs a skipped suite's hooks, so the guard is the URL, not `describe.skip`.
    if (databaseUrl === "") return;
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    if (databaseUrl === "") return;
    // The subscription rows the fixture wrote — and any a send granted, which it must not.
    await pool.query("DELETE FROM billing_subscription WHERE user_id LIKE $1", [`${TAG}-%`]);
    for (const id of created) {
      // Children first: payment, party, session, version, then the two records.
      await pool.query("DELETE FROM party WHERE session_record_id = $1", [`${id}-session`]);
      await pool.query("DELETE FROM session WHERE record_id = $1", [`${id}-session`]);
      await pool.query("DELETE FROM relationship_payment WHERE relationship_id = $1", [id]);
      await pool.query("DELETE FROM relationship WHERE id = $1", [id]);
      await pool.query("DELETE FROM template_version WHERE template_record_id = $1", [
        `${id}-template`,
      ]);
      await pool.query("DELETE FROM record WHERE id = ANY($1::text[])", [
        [`${id}-session`, `${id}-template`],
      ]);
    }
    await pool.end();
  });

  it("sends a draft whose Initiator holds no subscription — the week opens at acceptance", async () => {
    const relationshipId = await draftRelationship("unpaid");
    const payerId = `${relationshipId}-payer`;
    // No `billing_subscription` row: the state every draft is in now that the trial is anchored at
    // the Counterparty's acceptance (spec D3). On the pre-#948 query this call threw `42703`; on the
    // #911 gate it answered `no-payment-method`. Both are the defects a real schema and a real
    // function catch and a stub cannot.
    const result = await sendDraftInvitation({
      instanceRecordId: `${relationshipId}-session`,
      viewerUserId: payerId,
      now: NOW,
    });
    expect(result.ok === false ? result.code : "ok").not.toBe("no-payment-method");
    expect(result.ok === false ? result.code : "ok").not.toBe("internal-error");
    expect(result.ok).toBe(true);

    // The send spent nothing: a pending invitation costs no trial days.
    expect(await subscriptionRows(payerId)).toBe(0);
  });

  it("sends for a paid Initiator too, and still writes no subscription of its own", async () => {
    const relationshipId = await draftRelationship("paid");
    await liveMembership(`${relationshipId}-payer`);
    const result = await sendDraftInvitation({
      instanceRecordId: `${relationshipId}-session`,
      viewerUserId: `${relationshipId}-payer`,
      now: NOW,
    });
    expect(result.ok).toBe(true);

    // The one row is the fixture's: the send neither duplicates nor replaces it.
    expect(await subscriptionRows(`${relationshipId}-payer`)).toBe(1);
  });
});
