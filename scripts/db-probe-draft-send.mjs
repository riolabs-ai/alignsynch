/**
 * #1196 — **a seeded `draft` relationship sends**, against a real branch.
 *
 * The demo seed used to model a draft as invitation-less (#1079) while the product writes the
 * invitation in the relationship's own transaction (`lib/flow/store.ts:797`,
 * `lib/member/relationships.ts:1607`). Stage 5's Send mints its outgoing token by reissuing that
 * row, so a seeded draft answered `no-invitation` — on the branch a prospective customer is shown.
 * `scripts/db-seed.mjs` now writes the row; this proves the consequence rather than the intent:
 * **Send on a seeded draft returns `ok: true`.**
 *
 * **It leaves nothing behind, and proves it.** The probe snapshots the three rows the send touches
 * (`relationship`, `session_invite`, and the Initiator's `party` row, whose `user_id` it borrows so
 * the send has a viewer to authorise), drives `sendDraftInvitation()`, then restores every column
 * and compares a `to_jsonb()` snapshot of each row against the pre-send one. A mismatch exits 1
 * with the column names, so a probe that half-restored cannot pass quietly. The seed is idempotent,
 * so the recovery from a killed run is `pnpm db:seed`, never a manual repair.
 *
 * Read-only apart from that window: no seeded row is added, deleted, or left changed. Nothing is
 * special-cased for demo data — this is the product's own `sendDraftInvitation()`, imported the way
 * `scripts/flow-e2e.mjs` imports the flow, and a dataset that stopped carrying its invitations
 * would fail here.
 *
 *     DATABASE_URL=<branch url> node --import ./scripts/ts-modules.mjs \
 *       --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-probe-draft-send.mjs
 *
 * Exit 0 with one line per seeded draft and the send's own result; exit 1 names what disagreed.
 */
import { Client } from "pg";
import { loadEnv, writeDatabaseUrl } from "./load-env.mjs";

/** The snapshot of one row, as `to_jsonb` renders it — compared as text, so any column counts. */
async function rowJson(client, sql, values) {
  const { rows } = await client.query(sql, values);
  return rows[0]?.row ?? null;
}

const RELATIONSHIP_ROW = `SELECT to_jsonb(r) AS row FROM relationship r WHERE r.id = $1`;
const INVITE_ROW = `SELECT to_jsonb(iv) AS row FROM session_invite iv WHERE iv.session_record_id = $1`;
const PARTY_ROW = `SELECT to_jsonb(p) AS row FROM party p
                    WHERE p.session_record_id = $1 AND p.role = 'initiator'`;

loadEnv();
const client = new Client({
  connectionString: writeDatabaseUrl(),
  application_name: "db:probe:draft-send",
});

let restored = false;
await client.connect();
try {
  // 1. The seeded drafts, and whether each carries its invitation. This is the census #1196's
  // acceptance asks for, read from the rows the seed wrote.
  const { rows: drafts } = await client.query(
    `SELECT r.id AS relationship_id, s.record_id AS session_record_id,
            iv.session_record_id AS invite_session
       FROM relationship r
       JOIN session s ON s.relationship_id = r.id
       LEFT JOIN session_invite iv ON iv.session_record_id = s.record_id
      WHERE r.status = 'draft' AND r.id LIKE 'relationship-%'
      ORDER BY r.id`,
  );
  if (drafts.length === 0) {
    throw new Error("no seeded draft relationship on this branch — run `pnpm db:seed` first");
  }
  const missing = drafts.filter((row) => row.invite_session === null);
  for (const row of drafts) {
    console.log(
      `  · ${row.relationship_id} (${row.session_record_id}): ${
        row.invite_session === null ? "no session_invite row" : "carries its session_invite row"
      }`,
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} of ${drafts.length} seeded draft(s) carry no session_invite row — the state Send can only answer no-invitation over: run \`pnpm db:seed\``,
    );
  }

  const target = drafts[0];
  const sessionId = target.session_record_id;

  // 2. The viewer the send authorises: the Initiator. A seeded party row carries no `user_id` (the
  // binding is written for the relationships a demo account answers, and a draft is nobody's until
  // it is sent), so one existing account is borrowed for the duration and restored below. There is
  // no other way in: the send reads cookies or `party.user_id`, and a seeded row has no token hash.
  const { rows: accounts } = await client.query(
    "SELECT user_id FROM user_profile ORDER BY user_id LIMIT 1",
  );
  const viewerUserId = accounts[0]?.user_id;
  if (viewerUserId === undefined) {
    throw new Error("no user_profile row on this branch — the probe needs one account to act as");
  }

  // 3. Snapshot the three rows, then make the send's own preconditions true.
  const before = {
    relationship: await rowJson(client, RELATIONSHIP_ROW, [target.relationship_id]),
    invite: await rowJson(client, INVITE_ROW, [sessionId]),
    party: await rowJson(client, PARTY_ROW, [sessionId]),
  };
  if (before.party === null) {
    throw new Error(`draft "${target.relationship_id}" has no initiator party row`);
  }
  await client.query(
    "UPDATE party SET user_id = $2 WHERE session_record_id = $1 AND role = 'initiator'",
    [sessionId, viewerUserId],
  );

  // 4. The send itself, through the product's own function.
  const { sendDraftInvitation } = await import("@/lib/flow/store.ts");
  const result = await sendDraftInvitation({ sessionRecordId: sessionId, viewerUserId });
  console.log(
    `  · send ${sessionId} as ${viewerUserId}: ${
      result.ok
        ? `ok: true (relationship ${result.relationshipId}, token reissued)`
        : `ok: false, code ${result.code} — ${result.reason}`
    }`,
  );

  // 5. Restore every column the two writers touched, then prove the rows are what they were.
  await client.query(`UPDATE relationship SET status = $2, published_at = $3 WHERE id = $1`, [
    target.relationship_id,
    before.relationship.status,
    before.relationship.published_at,
  ]);
  await client.query(
    `UPDATE session_invite
        SET token_hash = $2, email = $3, expires_at = $4, resent_at = $5, resent_count = $6
      WHERE session_record_id = $1`,
    [
      sessionId,
      before.invite.token_hash,
      before.invite.email,
      before.invite.expires_at,
      before.invite.resent_at,
      before.invite.resent_count,
    ],
  );
  await client.query(
    "UPDATE party SET user_id = $2 WHERE session_record_id = $1 AND role = 'initiator'",
    [sessionId, before.party.user_id],
  );
  restored = true;

  const after = {
    relationship: await rowJson(client, RELATIONSHIP_ROW, [target.relationship_id]),
    invite: await rowJson(client, INVITE_ROW, [sessionId]),
    party: await rowJson(client, PARTY_ROW, [sessionId]),
  };
  const drifted = Object.keys(before).filter(
    (name) => JSON.stringify(before[name]) !== JSON.stringify(after[name]),
  );
  if (drifted.length > 0) {
    for (const name of drifted) {
      const columns = Object.keys(before[name] ?? {}).filter(
        (column) => JSON.stringify(before[name][column]) !== JSON.stringify(after[name]?.[column]),
      );
      throw new Error(
        `the probe did not restore ${name}: ${columns.join(", ") || "the row itself"} — run \`pnpm db:seed\``,
      );
    }
  }
  console.log(
    `  · restored: relationship, session_invite and party read back identical to their pre-send snapshot`,
  );

  if (!result.ok) {
    throw new Error(
      `stage 5's Send refused a seeded draft with ${result.code} — ${result.reason}. The seeded row's invitation is present (this probe asserted it above), so the refusal is the defect #1196 names`,
    );
  }
  console.log(
    `\n✓ db:probe:draft-send — ${drafts.length} seeded draft(s), every one carrying its invitation, and "${target.relationship_id}" sent (ok: true) against this branch with nothing left changed`,
  );
} finally {
  // A failed run before the restore leaves a `published` row and a rotated token. Say so, and name
  // the one command that converges the branch — a probe that fails must not pretend it left nothing.
  if (!restored) {
    console.error(
      "  ! this run did not reach its restore: the target draft may read `published` with a reissued token — `pnpm db:seed` converges it",
    );
  }
  await client.end();
}
