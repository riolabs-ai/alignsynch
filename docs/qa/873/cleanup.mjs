/**
 * #873 QA cleanup — leave the shared demo branch as it was found.
 *
 * `rig.mjs` creates two throwaway accounts through the app's own sign-up proxy and the rows their
 * journeys would have written (`qa873-*`). This removes both, in dependency order, and prints what
 * it removed so the reader can confirm the branch is back to `4 relationships / 2 extra users`.
 */
import pg from "pg";

const EMAILS = ["qa873-initiator@alignsynch.test", "qa873-counterparty@alignsynch.test"];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await c.connect();

const ids = await c.query('select id from neon_auth."user" where email = any($1)', [EMAILS]);
const userIds = ids.rows.map((r) => r.id);
console.log("accounts to remove:", userIds.length);

for (const [label, sql, params] of [
  ["party", "delete from party where session_record_id = 'qa873-session-record'", []],
  [
    "session_invite",
    "delete from session_invite where session_record_id = 'qa873-session-record'",
    [],
  ],
  ["session", "delete from session where relationship_id like 'qa873-%'", []],
  [
    "relationship_payment",
    "delete from relationship_payment where relationship_id like 'qa873-%'",
    [],
  ],
  ["relationship", "delete from relationship where id like 'qa873-%'", []],
  ["record", "delete from record where id = 'qa873-session-record'", []],
  ["user_profile", "delete from user_profile where user_id = any($1)", [userIds]],
  ["auth session", 'delete from neon_auth.session where "userId" = any($1)', [userIds]],
  ["auth account", 'delete from neon_auth.account where "userId" = any($1)', [userIds]],
  ["auth user", 'delete from neon_auth."user" where id = any($1)', [userIds]],
]) {
  try {
    const res = await c.query(sql, params);
    console.log(`${label}: ${res.rowCount ?? 0} removed`);
  } catch (error) {
    console.log(`${label}: skipped — ${error.message}`);
  }
}

const left = await c.query("select count(*)::int as n from relationship where id like 'qa873-%'");
const users = await c.query(
  'select count(*)::int as n from neon_auth."user" where email = any($1)',
  [EMAILS],
);
console.log("qa873 relationships left:", left.rows[0].n, "qa873 accounts left:", users.rows[0].n);

await c.end();
