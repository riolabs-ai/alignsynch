/**
 * The eight proofs `docs/ACCOUNT-DELETION-SPEC.md` §7 asks for, against a **live branch** (#278).
 *
 * Skipped unless `DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEON_PROJECT_ID` are set, so the gate
 * (which has no connection string, by design — `docs/GATE.md`) stays database-free and this file
 * costs it nothing. Run it against the **demo** branch only:
 *
 *     DATABASE_URL=<demo unpooled url> NEON_AUTH_BASE_URL=<demo auth url> \
 *     NEON_PROJECT_ID=<project> NEON_API_KEY=… NEON_BRANCH=demo \
 *     npx vitest run tests/account-deletion-live.test.ts
 *
 * **Every account and every row these cases touch is created by them.** No seeded demo account is
 * purged and no real person's data is read: each case signs up a throwaway on the branch's own auth
 * endpoint (the spec's §4.2 method), builds its own template, version, relationship, sessions,
 * seats, opinions and account-keyed rows under a `probe-…` prefix, and removes both in the same run.
 *
 * The account has to be a **real** auth user — `runAccountDeletion` reads the identity from
 * `neon_auth."user"` before it deletes anything (§7 step 2), so an invented id answers
 * `unknown-account` and would prove nothing.
 */
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  DELETED_SEAT_NAME,
  deleteAuthUser,
  purgeAccount,
  runAccountDeletion,
} from "@/lib/account/purge";
import { tlsPinnedUrl } from "@/lib/db/client";
import { readGapPopulation } from "@/lib/db/gap-rows";
import { readUserProfileByHandle } from "@/lib/db/user-profiles";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const authBase = process.env.NEON_AUTH_BASE_URL?.trim() ?? "";
const projectId = process.env.NEON_PROJECT_ID?.trim() ?? "";
const live = databaseUrl !== "" && authBase !== "" && projectId !== "";

/** A tag per run, so two runs on the same branch cannot collide. */
const tag = `probe-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
const probeName = "Probe Person";
const survivorName = "Survivor Seat";
const templateRecordId = `${tag}-template`;
const templateVersionId = `${tag}-version`;
const completeSessionId = `${tag}-complete`;
const incompleteSessionId = `${tag}-incomplete`;
const relationshipId = `${tag}-relationship`;
const itemCount = 2;

/** The accounts this run created. Emptied by deleting each one through the API it was made with. */
const createdAccounts: { id: string; email: string; password: string }[] = [];
let probeUserId = "";
let probeEmail = "";
let probeHandle = "";

/** A throwaway account on the branch's auth server — created here, deleted by this run. */
async function createThrowaway(
  label: string,
): Promise<{ id: string; email: string; password: string }> {
  const email = `${tag}-${label}@example.test`;
  const password = `Probe-${tag}-${label}-password-1`;
  const response = await fetch(`${authBase}/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Managed Auth refuses a sign-up with no `Origin` (`MISSING_ORIGIN`): it wants to know which
      // site the request came from before it mints a session.
      origin: new URL(authBase).origin,
    },
    body: JSON.stringify({ email, password, name: `Throwaway ${label}` }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user?: { id?: string } };
  const id = body.user?.id;
  expect(typeof id).toBe("string");
  const account = { id: id as string, email, password };
  createdAccounts.push(account);
  return account;
}

/** Sign-in for a throwaway: its status is the proof the account is (or is not) gone. */
async function signInStatus(account: { email: string; password: string }): Promise<number> {
  const response = await fetch(`${authBase}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(authBase).origin },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  return response.status;
}

/**
 * The fixture: everything §1.1 lists, for one account, plus the survivor's completed session.
 *
 * Written as one function so the create and cleanup lists cannot drift from each other — a probe
 * that leaves a row behind on a shared branch is the kind of mess the next card inherits.
 */
async function buildFixture(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Three records: the template, the private copy the complete session reads, and the copy the
    // incomplete one reads — the flow's own shape (`lib/flow/store.ts`).
    for (const [id, summary, owner] of [
      [templateRecordId, "Probe template.", probeUserId],
      [completeSessionId, `Probe template, answered by ${probeName} and ${survivorName}.`, null],
      [incompleteSessionId, `Probe template, answered by ${probeName}.`, null],
    ] as const) {
      await client.query(
        `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
         VALUES ($1, $2, 'assessment', 'published', now(), 'Probe template', $3, $4, $5, 'public')`,
        [id, id, summary, probeUserId, owner],
      );
      for (let position = 1; position <= itemCount; position += 1) {
        await client.query(
          `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
           VALUES ($1, $2, $3, 'Aspect', 'score', 'Not at all', 'Completely')`,
          [id, `aspect-${position}`, position],
        );
      }
    }

    await client.query(
      `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
       VALUES ($1, $2, 1, $3::jsonb, now(), $4)`,
      [templateVersionId, templateRecordId, JSON.stringify({ id: templateRecordId }), probeUserId],
    );

    await client.query(
      `INSERT INTO relationship (id, template_id, template_version_id, initiator_user_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [relationshipId, templateRecordId, templateVersionId, probeUserId],
    );

    // S1 — complete: both seats answered every Aspect and both accepted, which is what makes the
    // survivor's report survive (§2.3). The probe holds the initiator seat.
    // S2 — incomplete: the probe holds the counterparty seat and nobody answered.
    // `round` because one relationship holds one session per round (`session_relationship_round_key`).
    await client.query(
      `INSERT INTO session (record_id, template_record_id, relationship_id, name, mode, alignment_setting, round)
       VALUES ($1, $3, $4, $5, 'basic', 'soft', 1), ($2, $3, $4, NULL, 'basic', 'soft', 2)`,
      [
        completeSessionId,
        incompleteSessionId,
        templateRecordId,
        relationshipId,
        `Run for ${probeName}`,
      ],
    );
    await client.query(
      `INSERT INTO party (session_record_id, role, name, user_id, accepted_at, submitted_at)
       VALUES ($1, 'initiator', $2, $3, now(), now()),
              ($1, 'counterparty', $4, NULL, now(), now()),
              ($5, 'initiator', $4, NULL, NULL, NULL),
              ($5, 'counterparty', $2, $3, NULL, NULL)`,
      [completeSessionId, probeName, probeUserId, survivorName, incompleteSessionId],
    );
    for (let position = 1; position <= itemCount; position += 1) {
      for (const role of ["initiator", "counterparty"]) {
        await client.query(
          `INSERT INTO opinion (session_record_id, role, item_id, feel, wish, think, guess)
           VALUES ($1, $2, $3, 3, 4, NULL, NULL)`,
          [completeSessionId, role, `aspect-${position}`],
        );
      }
    }

    // §2.6: one invitation for the complete session (the probe is the initiator, so the row stays
    // and its address is cleared) and one for the incomplete one (the probe is the counterparty, so
    // the row goes — its address and name are NOT NULL).
    await client.query(
      `INSERT INTO session_invite (session_record_id, email, counterparty_name, token_hash, expires_at, initiator_email)
       VALUES ($1, 'survivor@example.test', $2, $3, now() + interval '7 days', $4),
              ($5, $4, $6, $7, now() + interval '7 days', NULL)`,
      [
        completeSessionId,
        survivorName,
        `${tag}-token-1`,
        probeEmail,
        incompleteSessionId,
        probeName,
        `${tag}-token-2`,
      ],
    );

    await client.query(
      `INSERT INTO relationship_member (relationship_id, user_id, role)
       VALUES ($1, $2, 'initiator')`,
      [relationshipId, probeUserId],
    );
    await client.query(
      `INSERT INTO coach_invite (relationship_id, token_hash, email, invited_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
      [relationshipId, `${tag}-coach-token`, probeEmail, probeUserId],
    );
    await client.query(
      `INSERT INTO user_profile (user_id, handle, display_name) VALUES ($1, $2, $3)`,
      [probeUserId, probeHandle, probeName],
    );
    await client.query(
      `INSERT INTO admin_invite (email, role, token_hash, invited_by, expires_at)
       VALUES ($1, 'support', $2, $3, now() + interval '7 days')`,
      [probeEmail, `${tag}-admin-token`, probeUserId],
    );
    await client.query(
      `INSERT INTO password_reset (email, user_id, token_hash, requester_hash)
       VALUES ($1, $2, $3, $4)`,
      [probeEmail, probeUserId, `${tag}-reset-token`, `${tag}-requester`],
    );
    await client.query(
      `INSERT INTO contact_message (name, email, message, assigned_user_id, assigned_at)
       VALUES ($1, $2, 'A support request.', $3, now())`,
      [probeName, probeEmail, probeUserId],
    );
    await client.query(
      `INSERT INTO news_signup (email, source, created_at) VALUES ($1, '/news', now())`,
      [probeEmail],
    );
    await client.query(
      `INSERT INTO admin_action (actor_user_id, actor_role, action, target_table, target_id, reason, before, after)
       VALUES ($1, 'admin', 'probe.action', 'probe', $2, 'a probe row for the sweep', $3::jsonb, $4::jsonb)`,
      [
        probeUserId,
        tag,
        JSON.stringify({ displayName: probeName }),
        JSON.stringify({ email: probeEmail }),
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove every probe row, in foreign-key order (a session points at its relationship, which points
 * at the template record). The sweep keeps the seat rows on purpose, so deletes are by prefix.
 */
async function dropFixture(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM relationship_member WHERE relationship_id = $1", [
      relationshipId,
    ]);
    await client.query("DELETE FROM session_invite WHERE token_hash LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM coach_invite WHERE token_hash LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM admin_invite WHERE token_hash LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM password_reset WHERE token_hash LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM session WHERE record_id LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM relationship WHERE id = $1", [relationshipId]);
    await client.query("DELETE FROM template_version WHERE id = $1", [templateVersionId]);
    await client.query("DELETE FROM record WHERE id LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM user_profile WHERE user_id LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM news_signup WHERE email LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM contact_message WHERE email LIKE $1", [`${tag}%`]);
    await client.query("DELETE FROM admin_action WHERE actor_user_id LIKE $1 OR target_id = $2", [
      `${tag}%`,
      tag,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Every row the spec says must be `0` or `NULL` for the deleted person, as one snapshot. */
async function snapshot(pool: Pool): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM user_profile WHERE user_id = $1) AS profiles,
       (SELECT count(*)::int FROM party WHERE user_id = $1) AS bound_seats,
       (SELECT count(*)::int FROM party WHERE session_record_id LIKE $2 AND name = $5) AS named_seats,
       (SELECT count(*)::int FROM party WHERE session_record_id LIKE $2 AND name = $3) AS labelled_seats,
       (SELECT count(*)::int FROM party WHERE session_record_id LIKE $2 AND access_token_hash IS NOT NULL) AS seat_credentials,
       (SELECT count(*)::int FROM party WHERE session_record_id LIKE $2 AND unlock_seen_at IS NOT NULL) AS unlock_marks,
       (SELECT count(*)::int FROM party WHERE session_record_id LIKE $2 AND impersonated_by IS NOT NULL) AS impersonations,
       (SELECT count(*)::int FROM relationship WHERE initiator_user_id = $1 OR counterparty_user_id = $1) AS relationships,
       (SELECT count(*)::int FROM relationship_member WHERE user_id = $1) AS members,
       (SELECT count(*)::int FROM coach_invite WHERE invited_by_user_id = $1 OR email = $4) AS coach_invites,
       (SELECT count(*)::int FROM admin_invite WHERE email = $4) AS admin_invites,
       (SELECT count(*)::int FROM password_reset WHERE user_id = $1 OR email = $4) AS password_resets,
       (SELECT count(*)::int FROM contact_message WHERE email = $4 OR assigned_user_id = $1) AS contact_messages,
       (SELECT count(*)::int FROM news_signup WHERE email = $4 AND unsubscribed_at IS NULL) AS addressable_signups,
       (SELECT count(*)::int FROM record WHERE owner_user_id = $1 OR author_user_id = $1) AS owned_records,
       (SELECT count(*)::int FROM admin_action WHERE actor_user_id = $1 AND (before IS NOT NULL OR after IS NOT NULL)) AS audit_payloads,
       (SELECT count(*)::int FROM session WHERE record_id LIKE $2 AND name LIKE '%' || $5 || '%') AS session_names,
       (SELECT count(*)::int FROM record WHERE id LIKE $2 AND summary LIKE '%' || $5 || '%') AS summaries,
       (SELECT count(*)::int FROM session_invite WHERE email = $4 OR initiator_email = $4) AS invites_carrying
     `,
    [probeUserId, `${tag}%`, DELETED_SEAT_NAME, probeEmail, probeName],
  );
  return rows[0] ?? {};
}

/** The counts `instanceStatusOf()` reads, for one session. */
async function sessionCounts(pool: Pool, sessionRecordId: string): Promise<Record<string, number>> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM item i WHERE i.record_id = s.record_id) AS item_count,
       (SELECT count(*)::int FROM opinion o WHERE o.session_record_id = s.record_id AND o.role = 'initiator') AS initiator_answered,
       (SELECT count(*)::int FROM opinion o WHERE o.session_record_id = s.record_id AND o.role = 'counterparty') AS counterparty_answered,
       (SELECT count(*)::int FROM party p WHERE p.session_record_id = s.record_id AND p.role = 'counterparty') AS counterparties,
       (SELECT count(*)::int FROM party p WHERE p.session_record_id = s.record_id AND p.role = 'initiator' AND p.accepted_at IS NOT NULL) AS initiator_accepted,
       (SELECT count(*)::int FROM party p WHERE p.session_record_id = s.record_id AND p.role = 'counterparty' AND p.accepted_at IS NOT NULL) AS counterparty_accepted,
       (SELECT count(*)::int FROM session v WHERE v.record_id = s.record_id AND v.voided_at IS NOT NULL) AS voided
     FROM session s WHERE s.record_id = $1`,
    [sessionRecordId],
  );
  return (rows[0] ?? {}) as Record<string, number>;
}

let caseIndex = 0;

/**
 * The live cases talk to Postgres **and** the Neon API (three round trips per auth delete), so
 * vitest's 5 s default is not a budget they fit in. Everything here is I/O on a 160–200 ms RTT
 * link to `us-east-2`; nothing is slow code.
 */
const liveIt = (name: string, fn: () => Promise<void>) => it(name, fn, 90_000);

describe.skipIf(!live)("account deletion, live (§7's eight proofs)", () => {
  const pool = new Pool({
    connectionString: tlsPinnedUrl(databaseUrl),
    ssl: { rejectUnauthorized: true },
    max: 3,
  });

  beforeEach(async () => {
    caseIndex += 1;
    const account = await createThrowaway(`probe-${caseIndex}`);
    probeUserId = account.id;
    probeEmail = account.email;
    probeHandle = `${tag}-handle-${caseIndex}`;
    await dropFixture(pool);
    await buildFixture(pool);
  }, 60_000);

  afterAll(async () => {
    await dropFixture(pool);
    // Every account this run made is deleted here unless a case already deleted it. The auth
    // delete answers 404 for one that is already gone, which is not a failure to report.
    for (const account of createdAccounts) {
      try {
        await deleteAuthUser(account.id);
      } catch {
        // already deleted by the case under test
      }
    }
    await pool.end();
  }, 120_000);

  liveIt("deleted means gone: every §1.1 row is 0 or NULL for that person", async () => {
    const outcome = await runAccountDeletion(probeUserId);
    expect(outcome.kind).toBe("deleted");

    expect(await snapshot(pool)).toMatchObject({
      profiles: 0,
      bound_seats: 0,
      named_seats: 0,
      // The two seats the deleted account held now read the label (S1's initiator, S2's
      // counterparty); the survivor's seat keeps its own name, which `named_seats` above covers.
      labelled_seats: 2,
      seat_credentials: 0,
      unlock_marks: 0,
      impersonations: 0,
      relationships: 0,
      members: 0,
      coach_invites: 0,
      admin_invites: 0,
      password_resets: 0,
      contact_messages: 0,
      addressable_signups: 0,
      owned_records: 0,
      audit_payloads: 0,
      session_names: 0,
      summaries: 0,
      invites_carrying: 0,
    });
  });

  liveIt("keeps the survivor's report complete, with both roles' answers", async () => {
    await runAccountDeletion(probeUserId);

    const counts = await sessionCounts(pool, completeSessionId);
    // `instanceStatusOf()`'s own rule, over the rows the sweep left behind.
    expect(counts.voided).toBe(0);
    expect(counts.counterparties).toBe(1);
    expect(counts.item_count).toBe(itemCount);
    expect(counts.initiator_answered).toBe(itemCount);
    expect(counts.counterparty_answered).toBe(itemCount);
    expect(counts.initiator_accepted).toBe(1);
    expect(counts.counterparty_accepted).toBe(1);

    // GAP_ROWS_SQL inner-joins both roles' opinions per Aspect and filters on completeness, so a
    // row existing IS both answers and a surviving report.
    const population = await readGapPopulation();
    const survivor = population.instances.find((i) => i.instanceId === completeSessionId);
    expect(survivor).toBeDefined();
    expect(survivor?.aspects).toHaveLength(itemCount);
  });

  liveIt(
    "leaves no identity resolvable: the label, has_account false, and no profile route",
    async () => {
      await runAccountDeletion(probeUserId);

      const { rows } = await pool.query(
        `SELECT p.name, p.role, p.user_id IS NOT NULL AS has_account
         FROM party p WHERE p.session_record_id = $1 ORDER BY p.role`,
        [completeSessionId],
      );
      const seats = rows as { name: string; role: string; has_account: boolean }[];
      const deletedSeat = seats.find((seat) => seat.role === "initiator");
      const survivorSeat = seats.find((seat) => seat.role === "counterparty");
      expect(deletedSeat?.name).toBe(DELETED_SEAT_NAME);
      expect(deletedSeat?.has_account).toBe(false);
      // The survivor's own label is not collateral damage — §1.1's disposition is per person.
      expect(survivorSeat?.name).toBe(survivorName);

      // `/profile/<handle>` asks this function and renders `notFound()` on null.
      expect(await readUserProfileByHandle(probeHandle)).toBeNull();
    },
  );

  liveIt("rewrites the prose: no summary or session name still names the person", async () => {
    await runAccountDeletion(probeUserId);

    const { rows } = await pool.query(
      `SELECT (SELECT summary FROM record WHERE id = $1) AS summary,
              (SELECT name FROM session WHERE record_id = $1) AS session_name`,
      [completeSessionId],
    );
    const row = rows[0] as { summary: string; session_name: string };
    expect(row.summary).not.toContain(probeName);
    expect(row.summary).toContain(DELETED_SEAT_NAME);
    expect(row.session_name).not.toContain(probeName);
    expect(row.session_name).toContain(DELETED_SEAT_NAME);
    // The other person's name is not collateral damage.
    expect(row.summary).toContain(survivorName);
  });

  liveIt("voids an incomplete session instead of leaving it waiting (§2.4)", async () => {
    await runAccountDeletion(probeUserId);

    const { rows } = await pool.query(
      `SELECT voided_at IS NOT NULL AS voided, voided_by FROM session WHERE record_id = $1`,
      [incompleteSessionId],
    );
    const row = rows[0] as { voided: boolean; voided_by: string | null };
    expect(row.voided).toBe(true);
    // The spec says `voided_by = NULL`; `session_voided_by_comes_with_instant` refuses that, so the
    // sweep stamps the deletion actor. Recorded in `lib/account/purge.ts`.
    expect(row.voided_by).toBe("account-deletion");

    // And the complete session is untouched: voiding one is the data-loss bug §2.3 forbids.
    expect((await sessionCounts(pool, completeSessionId)).voided).toBe(0);
  });

  liveIt("is idempotent: a second run changes nothing and reports zeroes", async () => {
    const first = await runAccountDeletion(probeUserId);
    expect(first.kind).toBe("deleted");
    expect(first.kind === "deleted" && first.counts.partiesAnonymised).toBeGreaterThan(0);
    const stateAfterFirst = await snapshot(pool);

    // The whole sweep again, with the same identity it started from — the state §7 step 4 has to
    // survive, because a failed scrub is retried after the auth user is already gone.
    const client = await pool.connect();
    const second = await purgeAccount(client, {
      userId: probeUserId,
      email: probeEmail,
      names: [probeName],
      roles: ["initiator", "counterparty"],
    });
    client.release();

    expect(Object.values(second).every((count) => count === 0)).toBe(true);
    expect(await snapshot(pool)).toEqual(stateAfterFirst);

    // And from the caller's side the account is simply gone: the identity read finds nothing, so a
    // second request is a no-op rather than a second deletion.
    expect((await runAccountDeletion(probeUserId)).kind).toBe("unknown-account");
    expect(await snapshot(pool)).toEqual(stateAfterFirst);
  });

  liveIt("leaves every public row untouched when the auth delete fails (§7 step 3)", async () => {
    const before = await snapshot(pool);

    const outcome = await runAccountDeletion(probeUserId, {
      deleteAuth: async () => {
        throw new Error("DELETE …/auth/users/… answered 500");
      },
    });

    expect(outcome.kind).toBe("auth-failed");
    expect(await snapshot(pool)).toEqual(before);
    // The seat is still bound and the profile still resolves: the account still works.
    expect(await readUserProfileByHandle(probeHandle)).not.toBeNull();
    // And the auth user really is still there — the account can still sign in.
    const account = createdAccounts.find((candidate) => candidate.id === probeUserId);
    expect(account).toBeDefined();
    if (account !== undefined) expect(await signInStatus(account)).toBe(200);
  });

  liveIt("deletes a throwaway account, and sign-in answers 401 afterwards", async () => {
    const account = createdAccounts.find((candidate) => candidate.id === probeUserId);
    expect(account).toBeDefined();
    if (account === undefined) return;

    expect(await signInStatus(account)).toBe(200);
    expect((await runAccountDeletion(account.id)).kind).toBe("deleted");
    expect(await signInStatus(account)).toBe(401);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM user_profile WHERE user_id = $1`,
      [account.id],
    );
    expect(rows[0]).toEqual({ n: 0 });
  });
});
