/**
 * #619 — the payment job against **real Postgres**, not a recording fake.
 *
 * `tests/payment-job-run.test.ts` proves the job's decisions with a fake SQL surface. This file
 * proves the SQL itself: that `openPaymentObligations()` finds a sealed unpaid obligation, that its
 * `SEALED_AT_SQL` reads the **second** acceptance, that the trial charge stamps `charged_at` and
 * completes the relationship, and that day 14 expires both rows — in a real transaction on a real
 * schema.
 *
 * **Skipped unless `DATABASE_URL` is set**, exactly like `tests/account-deletion-live.test.ts`: the
 * gate has no connection string by design (`docs/GATE.md`), so this costs the gate nothing and runs
 * when someone points it at a branch.
 *
 * **It leaves nothing behind.** Every row is created under a `probe-pay-…` id and deleted in
 * `afterAll`, and the two relationships it uses are its own — no seeded demo relationship is read
 * or written. The charge is the injected seam, so no provider is called and no money moves: what is
 * being proven is the write path, which is the half a fake cannot check.
 *
 *     DATABASE_URL=<branch url> npx vitest run tests/payment-jobs-live.test.ts
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { openPaymentObligations, readRelationshipPayment } from "@/lib/db/relationship-payment";
import { runPaymentJobs } from "@/lib/member/payment-job-run";
import type { ChargeOutcome } from "@/lib/billing/types";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;

const TAG = `probe-pay-${Date.now().toString(36)}`;
const DAY = 86_400_000;
/** One instant for every fixture, so a window is arithmetic a reader can check by hand. */
const SEALED = new Date("2026-03-01T12:00:00.000Z");
const day = (n: number) => new Date(SEALED.getTime() + n * DAY);

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

/** The rows one relationship needs: a template version, a relationship, an active session, two seats. */
async function fixture(suffix: string, options: { sealed: boolean }): Promise<string> {
  const relationshipId = `${TAG}-${suffix}`;
  const templateId = `${relationshipId}-template`;
  const versionId = `${relationshipId}-version`;
  const sessionId = `${relationshipId}-session`;

  await pool.query(
    `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $1, 'assessment', 'published', now(), 'Payment probe', 'probe', NULL, NULL, 'private')`,
    [templateId],
  );
  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 1, '{}'::jsonb, now(), NULL)`,
    [versionId, templateId],
  );
  await pool.query(
    `INSERT INTO relationship
       (id, template_id, template_version_id, initiator_user_id, status, created_at, published_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
    // Both instants are dated explicitly, because the fixture invents March instants and three
    // merged CHECKs pair them with the row's state:
    //   0032 `relationship_lapsed_pair`            expired_at >= created_at  (the day-14 case)
    //   0030 `relationship_completed_after_published`  completed_at needs published_at, and >= it
    //   0030 `relationship_published_after_creation`   published_at >= created_at
    // Left to their defaults the row is created in the present, and every historical write is a
    // constraint violation that looks exactly like the write path being wrong.
    [relationshipId, templateId, versionId, `${relationshipId}-payer`, day(-30), day(-29)],
  );
  // The session's own record row: `session.record_id` is `PRIMARY KEY REFERENCES record (id)`, so the
  // assessment instance is a record before it is a session. Skipping this is what made the first
  // real run fail on `assessment_instance_record_id_fkey` — the constraint kept its 0001 name when
  // 0013 renamed the table.
  await pool.query(
    `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $1, 'assessment', 'published', now(), 'Payment probe session', 'probe', NULL, NULL, 'private')`,
    [sessionId],
  );
  await pool.query(
    `INSERT INTO session (record_id, template_record_id, relationship_id, name, mode, alignment_setting, round)
     VALUES ($1, $2, $3, 'Payment probe', 'basic', 'soft', 1)`,
    [sessionId, templateId, relationshipId],
  );
  // The second acceptance is what seals: the counterparty accepts a day after the initiator, so a
  // sealed instant read as `max(accepted_at)` is distinguishable from a read of `min`.
  await pool.query(
    `INSERT INTO party (session_record_id, role, name, user_id, accepted_at, submitted_at)
     VALUES ($1, 'initiator', 'Init', $2, $3, $3),
            ($1, 'counterparty', 'Counter', NULL, $4, $4)`,
    [
      sessionId,
      `${relationshipId}-payer`,
      options.sealed ? new Date(SEALED.getTime() - DAY) : null,
      options.sealed ? SEALED : null,
    ],
  );
  return relationshipId;
}

/** The obligation, written with the same columns the capture writes. */
async function obligation(
  relationshipId: string,
  overrides: { readonly failedAt?: Date | null; readonly attempts?: number } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO relationship_payment
       (relationship_id, payer_user_id, provider, provider_customer_id, provider_payment_method_id,
        method_captured_at, charge_due_at, charge_amount_cents, charge_attempts, first_failed_at)
     VALUES ($1, $2, 'mock', 'cus_probe', 'pm_probe', $3, $4, 1900, $5, $6)`,
    [
      relationshipId,
      `${relationshipId}-payer`,
      SEALED,
      day(7),
      overrides.attempts ?? 0,
      overrides.failedAt ?? null,
    ],
  );
}

const chargeOk = async (): Promise<ChargeOutcome> => ({
  ok: true,
  chargeId: "ch_probe",
  amountCents: 1900,
});

/**
 * Run the job against **one fixture's** obligations.
 *
 * `runPaymentJobs()` scans every open obligation, and this file keeps three of them alive at the
 * same instant: an unscoped day-8 run charges the day-14 fixture's fee and the expiry it is meant
 * to prove never happens. Scoping the input is what makes each case a case; the unscoped scan is
 * `openPaymentObligations()` itself, which the first test pins.
 */
async function runFor(relationshipId: string, now: Date) {
  const all = await openPaymentObligations();
  return runPaymentJobs({
    now,
    charge: chargeOk,
    obligations: all.filter((row) => row.row.relationship_id === relationshipId),
  });
}

live("the payment job, on the real schema", () => {
  // One fixture per case, created once: `relationship` is keyed by id, so a second create would be
  // a collision rather than a test.
  const ids = { retry: `${TAG}-retry`, expire: `${TAG}-expire`, quiet: `${TAG}-quiet` };

  beforeAll(async () => {
    // Fail loudly here rather than in the first assertion: a live suite without the migration is a
    // missing table, and that sentence is more useful than a null row.
    const table = await pool.query(
      "SELECT to_regclass('public.relationship_payment') IS NOT NULL AS present",
    );
    expect(table.rows[0]?.present, "relationship_payment must exist — run pnpm db:migrate").toBe(
      true,
    );

    // `fixture()` owns the id: it prefixes `TAG` itself, so passing an already-qualified id here
    // doubled it (`TAG-TAG-retry`) and the obligation then pointed at a relationship that did not
    // exist — the first real run died on `relationship_payment_relationship_id_fkey`. Take the id
    // the fixture returns.
    await obligation(await fixture("retry", { sealed: true }));
    await obligation(await fixture("expire", { sealed: true }));
    await obligation(await fixture("quiet", { sealed: false }));
  });

  afterAll(async () => {
    // Children first: the payment row, the seats, the session, then the relationship and its
    // template. `record` owns `template_version` and `relationship` by FK, so the order matters.
    for (const suffix of ["retry", "expire", "quiet"]) {
      const id = `${TAG}-${suffix}`;
      await pool.query("DELETE FROM relationship_payment WHERE relationship_id = $1", [id]);
      await pool.query(
        "DELETE FROM party WHERE session_record_id IN (SELECT record_id FROM session WHERE relationship_id = $1)",
        [id],
      );
      await pool.query(
        "DELETE FROM opinion WHERE session_record_id IN (SELECT record_id FROM session WHERE relationship_id = $1)",
        [id],
      );
      await pool.query("DELETE FROM session WHERE relationship_id = $1", [id]);
      // The session's own record row, added by the fixture above; `record` is not cascaded.
      await pool.query("DELETE FROM record WHERE id = $1", [`${id}-session`]);
      await pool.query("DELETE FROM relationship WHERE id = $1", [id]);
      await pool.query("DELETE FROM template_version WHERE template_record_id = $1", [
        `${id}-template`,
      ]);
      await pool.query("DELETE FROM record WHERE id = $1", [`${id}-template`]);
    }
    await pool.end();
  });

  it("finds a sealed, unpaid obligation, and reads the seal as the second acceptance", async () => {
    const open = await openPaymentObligations();
    const found = open.find((row) => row.row.relationship_id === ids.retry);
    expect(found, "the scan must find this obligation").toBeDefined();
    expect(found?.sealedAt?.toISOString()).toBe(SEALED.toISOString());
    // `pg` hands a `timestamptz` back as a `Date`, and `rowFacts` keeps it one; comparing a
    // `Date.prototype.toString()` ("Sun Mar 01 2026 …") with an ISO string is not a near miss, it
    // is a different string, so the comparison is ISO to ISO.
    const factsSealedAt = found?.facts.sealedAt;
    expect(factsSealedAt instanceof Date).toBe(true);
    expect((factsSealedAt as Date).toISOString()).toBe(SEALED.toISOString());
  });

  it("takes the trial fee on day 8 for the stored amount, and completes the relationship", async () => {
    const id = ids.retry;

    const run = await runFor(id, day(8));
    const mine = run.results.find((result) => result.relationshipId === id);
    // The first attempt is `charge`, not `retry-charge`: nothing had failed before it.
    expect(mine?.jobs.some((job) => job.outcome.kind === "charge")).toBe(true);

    const row = await readRelationshipPayment(id);
    expect(row?.charged_at?.toISOString()).toBe(day(8).toISOString());
    expect(row?.charge_amount_cents).toBe(1900);

    const relationship = await pool.query<{ status: string }>(
      "SELECT status FROM relationship WHERE id = $1",
      [id],
    );
    expect(relationship.rows[0]?.status).toBe("complete");
  });

  it("is idempotent: a second run takes nothing twice", async () => {
    const id = ids.retry;
    const before = await readRelationshipPayment(id);
    await runFor(id, day(9));
    const after = await readRelationshipPayment(id);
    expect(after?.charged_at?.toISOString()).toBe(before?.charged_at?.toISOString());
    // A charged obligation is no longer in the scan at all.
    const open = await openPaymentObligations();
    expect(open.some((row) => row.row.relationship_id === id)).toBe(false);
  });

  it("expires an unpaid seal at day 14 and closes the relationship with a reason", async () => {
    const relationshipId = ids.expire;

    const run = await runFor(relationshipId, day(14));
    const mine = run.results.find((result) => result.relationshipId === relationshipId);
    expect(mine?.jobs[0]?.outcome).toEqual({ kind: "expire", status: "expired", reason: "unpaid" });

    const row = await readRelationshipPayment(relationshipId);
    expect(row?.expired_at?.toISOString()).toBe(day(14).toISOString());
    expect(row?.expire_reason).toBe("unpaid");

    const relationship = await pool.query<{ status: string; lapse_reason: string | null }>(
      "SELECT status, lapse_reason FROM relationship WHERE id = $1",
      [relationshipId],
    );
    expect(relationship.rows[0]).toEqual({ status: "expired", lapse_reason: "payment-failed" });
  });

  it("leaves a relationship that has not sealed alone", async () => {
    const relationshipId = ids.quiet;

    await runFor(relationshipId, day(30));

    const row = await readRelationshipPayment(relationshipId);
    // No seal means no window: the obligation is open, uncharged and unexpired, and the
    // relationship is still active — a job must never expire a session nobody has finished.
    expect(row?.charged_at).toBeNull();
    expect(row?.expired_at).toBeNull();
    const relationship = await pool.query<{ status: string }>(
      "SELECT status FROM relationship WHERE id = $1",
      [relationshipId],
    );
    expect(relationship.rows[0]?.status).toBe("active");
  });
});
