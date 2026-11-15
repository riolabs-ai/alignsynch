/**
 * Stage 5's Send, against **real Postgres**.
 *
 * The defect this file exists for is a column on the wrong table: `sendDraftInvitation()` selected
 * `r.method_captured_at` from `relationship`, which has no such column — it lives on
 * `relationship_payment` (`0036_relationship_payment.sql:65`). Postgres answered `42703` and the
 * handler threw, so **every** send on a real database was a 500, whatever the relationship's state.
 *
 * A fake SQL surface cannot catch that: the failure is the planner's, not the code's. So this runs
 * the real function against a real schema, in a transaction-shaped fixture of its own.
 *
 * **The table that owns the fact moved, and this file moved with it (#1069).** #1012 (#1010 R2)
 * deleted the card gate from the send: a card now reaches an account by buying the membership at
 * stage 5, so the fact the send waits for is the Initiator's live subscription in
 * **`billing_subscription`** — `lib/flow/store.ts::sendDraftInvitation()` reads
 * `bs.status … WHERE bs.user_id = r.initiator_user_id`. This file kept writing a
 * `relationship_payment` row, which nothing reads any more, so its "paid" case answered
 * `no-payment-method` exactly like its "unpaid" case: the fixture, not the product, was stale. It
 * now writes the row the read actually owns.
 *
 * **Skipped unless `DATABASE_URL` is set**, exactly like the other `*-live.test.ts` files: the gate
 * has no connection string by design (`docs/operations/gate.md`), so this costs the gate nothing
 * and runs when someone points it at a branch.
 *
 * **It leaves nothing behind.** Every row is created under a `probe-send-…` id and deleted in
 * `afterAll`. No seeded relationship is read or written.
 *
 *     DATABASE_URL=<branch url> npx vitest run tests/stage5-send-live.test.ts
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
 * The row the send actually reads since #1012 — `billing_subscription`, keyed by user, with one of
 * the entitling statuses (`active`, `trialing`, `past_due`). `active` on purpose: it is the value a
 * real checkout produces, and it cannot be reached by the trial writer's default.
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

live("stage 5's Send reads the membership fact from the table that owns it", () => {
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
    // The subscription rows the fixture wrote — and any the send's own publish path granted.
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

  it("does not answer 42703 — the query runs, whatever the relationship's membership state", async () => {
    const relationshipId = await draftRelationship("unpaid");
    // No `billing_subscription` row for the Initiator: the state before a plan is bought. On the
    // pre-#948 query this call threw `42703 column r.method_captured_at does not exist`, which is
    // the 500 every send produced — the throw is what this assertion is about.
    const result = await sendDraftInvitation({
      instanceRecordId: `${relationshipId}-session`,
      viewerUserId: `${relationshipId}-payer`,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    // The absence of a live membership reads as "no card on file", never as 500 or as "not found".
    expect(result.ok === false && result.code).toBe("no-payment-method");
  });

  it("finds the live membership on the subscription row and proceeds past the card gate", async () => {
    const relationshipId = await draftRelationship("paid");
    // The fact the send waits on lives on `billing_subscription` since #1012. A fixture that wrote
    // a `relationship_payment` row instead (what this file did until #1069) reads as unpaid, and
    // the case fails on a product that is working.
    await liveMembership(`${relationshipId}-payer`);
    const result = await sendDraftInvitation({
      instanceRecordId: `${relationshipId}-session`,
      viewerUserId: `${relationshipId}-payer`,
      now: NOW,
    });
    // Past `no-payment-method`: what it does next belongs to the invitation path, not this card.
    expect(result.ok === false ? result.code : "ok").not.toBe("no-payment-method");
  });
});
