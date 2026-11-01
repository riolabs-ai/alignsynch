#!/usr/bin/env node
/**
 * `pnpm db:seed` — `data/assessments.ts` → rows, idempotently (#145).
 *
 * The fixtures stay the authored source and the database is their mirror: this script imports
 * the real module (no second copy of the text) and writes 4 templates + 4 instances. It is
 * idempotent by replacement, not by counting: each record's rows are upserted and its items,
 * parties and opinions are rewritten from the fixture, so a second run converges on the same
 * rows and reports the same counts.
 *
 * Before writing anything it removes the temporary e2e user the auth proof created
 * (`neon_auth` users/sessions, id `b8bb3fe0-…`) — the prerequisite recorded on the issue. A
 * seed must not double-count or fail because a test account is present, and the acceptance is
 * that a clean run leaves only seeded rows behind.
 *
 * Everything runs in one transaction: a seed that fails halfway leaves the previous rows, not
 * a half-copied instance whose parties answer Aspects from two different templates.
 *
 * **The demo accounts (#183).** With `DEMO_AUTH=1` this script also creates the three demo
 * identities — `initiator@`, `counterparty@` and `admin@demo.alignsynch.test` — and binds the
 * first two to Avery and Rowan on `assessment-instance-avery-rowan`, so signing in as the
 * Counterparty shows that person's blind view rather than an empty dashboard. Three things
 * about how, because each one is a decision and not an accident:
 *
 *   - **The dataset is the file, not a second copy of it.** In demo mode the rows come from
 *     `data/bundles/demo-dataset.alignsynch.json` through `parseBundle` — the same reader
 *     `pnpm bundles import` runs — after asserting that the file is still the canonical export
 *     of `data/assessments.ts` (E32's rule, re-checked here because this script writes rows
 *     from the file and must not install a dataset the fixtures disagree with).
 *   - **Passwords are generated here, and only live in `demo_account`.** `randomBytes(24)` per
 *     run, printed nowhere, returned nowhere, committed nowhere. Re-seeding replaces the three
 *     accounts (fresh password each time) rather than reusing them, which is also what makes
 *     the run idempotent in counts: three accounts before, three after.
 *   - **The auth users are real.** Each demo account is created in Neon Auth through the
 *     branch's own `sign-up/email` endpoint, so `#183` part 2 signs in with the real login path
 *     and the real session — no parallel auth. The endpoint needs an `Origin` header (Better
 *     Auth's CSRF rule for a server-side sign-up); `DEMO_ORIGIN` overrides the default
 *     `http://localhost:3000`.
 *
 * With `DEMO_AUTH` unset, the three demo accounts are **removed** and none are created — the
 * flag is a switch, and a switch that only ever adds leaves a demo backdoor behind on every
 * machine that ever ran a demo.
 *
 * **The platform admins.** With `ADMIN_NN_EMAIL` / `ADMIN_NN_PASS` present, this script also
 * ensures each pair is a durable `admin` account: created through the same sign-up path when
 * absent, reconciled (role corrected in place) when present, and — when the password has changed
 * — removed in phase 1 and recreated, never duplicated and never failing. The password comes
 * from the environment and is written nowhere: no `demo_account` row, no log line, no file.
 * With no `ADMIN_*` set (CI, a fresh clone, the gate) the pass is skipped with a printed line,
 * which is the point — a platform admin is opt-in, not a default.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Client } from "pg";
import { syncBillingPlans } from "./billing-plans.mjs";
import { loadEnv, repoRoot, requireVariable, writeDatabaseUrl } from "./load-env.mjs";

/** The auth proof's throwaway account (issue #145 comment, confirmed by Jaden). */
const TEMP_E2E_USER_IDS = ["b8bb3fe0-caf3-4aa9-9344-fb62c224c215"];

const INSERT_RECORD = `
  INSERT INTO record (id, slug, record_type, status, date, title, summary)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (id) DO UPDATE SET
    slug        = EXCLUDED.slug,
    record_type = EXCLUDED.record_type,
    status      = EXCLUDED.status,
    date        = EXCLUDED.date,
    title       = EXCLUDED.title,
    summary     = EXCLUDED.summary
`;

async function upsertRecord(client, record) {
  await client.query(INSERT_RECORD, [
    record.id,
    record.slug,
    record.type,
    record.status,
    record.date,
    record.title,
    record.summary,
  ]);
}

/**
 * Rewrites a record's items from the fixture.
 *
 * `DELETE` then insert, rather than an upsert per item: the fixture is the whole truth for
 * that record, so an item removed from `data/assessments.ts` must disappear here too. The
 * cascade takes the item's `response_option` rows and any `opinion` that names it with it.
 */
async function replaceItems(client, record) {
  await client.query("DELETE FROM item WHERE record_id = $1", [record.id]);
  for (const [position, item] of record.items.entries()) {
    const score = item.scale.kind === "score";
    await client.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.id,
        item.id,
        position,
        item.prompt,
        item.scale.kind,
        score ? item.leftValue : null,
        score ? item.rightValue : null,
      ],
    );
    if (item.scale.kind === "options") {
      for (const [optionPosition, option] of item.scale.options.entries()) {
        await client.query(
          `INSERT INTO response_option (record_id, item_id, option_id, position, text)
           VALUES ($1, $2, $3, $4, $5)`,
          [record.id, item.id, option.id, optionPosition, option.text],
        );
      }
    }
  }
}

async function seedTemplate(client, template) {
  await upsertRecord(client, template);
  await replaceItems(client, template);
}

async function seedInstance(client, instance) {
  await upsertRecord(client, instance);
  await replaceItems(client, instance);
  // #340 — the relationship the instance was split into. One per instance, idempotent by the
  // same deterministic id the migration's backfill uses (`relationship-<record_id>`), so a
  // re-seed converges on the same row. The two account columns stay NULL here: the demo accounts
  // do not exist yet (they are created and bound later, in phase 2), and the relationship's
  // Initiator/Counterparty are the parties' bindings, which `bindDemoParties` writes on `party`
  // and nowhere else. `purchased_at` is NULL — no demo relationship records a purchase.
  await client.query(
    `INSERT INTO relationship
       (id, template_id, initiator_user_id, counterparty_user_id, purchased_at, plan, created_at)
     VALUES ($1, $2, NULL, NULL, NULL, NULL, $3)
     ON CONFLICT (id) DO UPDATE SET
       template_id = EXCLUDED.template_id,
       created_at  = EXCLUDED.created_at`,
    [`relationship-${instance.id}`, instance.templateId, instance.date],
  );
  await client.query(
    `INSERT INTO session (record_id, template_record_id, mode, alignment_setting, relationship_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (record_id) DO UPDATE SET template_record_id = EXCLUDED.template_record_id,
                                          mode = EXCLUDED.mode,
                                          alignment_setting = EXCLUDED.alignment_setting,
                                          relationship_id = EXCLUDED.relationship_id`,
    [
      instance.id,
      instance.templateId,
      instance.mode,
      instance.setting,
      `relationship-${instance.id}`,
    ],
  );
  await client.query("DELETE FROM party WHERE session_record_id = $1", [instance.id]);
  for (const party of instance.parties) {
    await client.query("INSERT INTO party (session_record_id, role, name) VALUES ($1, $2, $3)", [
      instance.id,
      party.role,
      party.name,
    ]);
    for (const answer of party.opinions) {
      await client.query(
        `INSERT INTO opinion (session_record_id, role, item_id, feel, wish, think, guess)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          instance.id,
          party.role,
          answer.itemId,
          answer.opinions.feel,
          answer.opinions.wish,
          answer.opinions.think ?? null,
          answer.opinions.guess ?? null,
        ],
      );
    }
  }
}

/* ------------------------------------------------------------------ *\
 * The temporary e2e user
 * ------------------------------------------------------------------ */

/**
 * Auth tables are Neon's (`neon_auth`), so the names are read from the catalogue instead of
 * assumed: Better Auth's own migration calls them `user`/`session`, Neon's console docs call
 * them `users`/`sessions`, and a hardcoded guess would fail on the one that is installed.
 */
async function authTables(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'neon_auth' ORDER BY table_name`,
  );
  const names = rows.map((row) => row.table_name);
  const pick = (candidates) => candidates.find((name) => names.includes(name));
  return {
    schema: names.length > 0,
    users: pick(["user", "users"]),
    sessions: pick(["session", "sessions"]),
  };
}

async function columnsOf(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return rows.map((row) => row.column_name);
}

/** Deletes the throwaway account and its sessions. Returns what it removed, by name only. */
async function deleteTempUsers(client) {
  const tables = await authTables(client);
  if (!tables.users) {
    console.log(
      `  · neon_auth: ${tables.schema ? "no users table" : "schema absent"} — nothing to delete`,
    );
    return { users: 0, sessions: 0 };
  }

  let sessions = 0;
  if (tables.sessions) {
    const sessionColumns = await columnsOf(client, "neon_auth", tables.sessions);
    const owner = ["user_id", "userId", "user"].find((column) => sessionColumns.includes(column));
    if (owner !== undefined) {
      const result = await client.query(
        // `::text` on both sides: the id column is `uuid` in Better Auth's schema and `text`
        // in Neon's, and comparing either one to a parameter array needs the cast.
        `DELETE FROM neon_auth."${tables.sessions}" WHERE "${owner}"::text = ANY($1::text[])`,
        [TEMP_E2E_USER_IDS],
      );
      sessions = result.rowCount ?? 0;
    }
  }

  const removed = await client.query(
    `DELETE FROM neon_auth."${tables.users}" WHERE id::text = ANY($1::text[])`,
    [TEMP_E2E_USER_IDS],
  );

  const { rows: remaining } = await client.query(
    `SELECT id::text AS id FROM neon_auth."${tables.users}" WHERE id::text = ANY($1::text[])`,
    [TEMP_E2E_USER_IDS],
  );
  if (remaining.length > 0) {
    throw new Error(
      `temp e2e user still present in neon_auth."${tables.users}": ${remaining.map((row) => row.id).join(", ")}`,
    );
  }

  return { users: removed.rowCount ?? 0, sessions };
}

/* ------------------------------------------------------------------ *\
 * The demo accounts (#183) — none of this runs without DEMO_AUTH=1
 * ------------------------------------------------------------------ */

const DEMO_DATASET_FILE = join(repoRoot, "data", "bundles", "demo-dataset.alignsynch.json");

/**
 * `DEMO_AUTH=1`, and no other spelling. Not `true`, not `yes`, not `"1 "` — a demo backdoor
 * should be a thing you have to mean, and one accepted spelling is one fewer way to mean it by
 * accident.
 */
function demoAuthEnabled() {
  return process.env.DEMO_AUTH === "1";
}

/** A repo-relative path for the messages, the way `scripts/bundles.ts` prints them. */
function displayPath(file) {
  return relative(repoRoot, file);
}

/**
 * The demo dataset — read as the bundle it is, not as a second copy of the fixtures.
 *
 * `parseBundle` is the importer's own reader (B1–B6), so a file this script accepts is a file
 * `pnpm bundles import` accepts, and the canonical-export check is E32's rule re-stated at the
 * point of use: this script writes rows from the file, so a file that has drifted from
 * `data/assessments.ts` must stop the seed rather than install a dataset the gate and the
 * database disagree about.
 */
async function readDemoDataset() {
  const { parseBundle, canonicalDemoBundle, serializeBundle, formatBundleIssue } = await import(
    "../content/bundle.ts"
  );
  const { assessments, assessmentInstances } = await import("../data/assessments.ts");

  const text = readFileSync(DEMO_DATASET_FILE, "utf8");
  const parsed = parseBundle(text);
  if (!parsed.ok) {
    throw new Error(
      `${displayPath(DEMO_DATASET_FILE)} does not parse as a bundle:\n  ${parsed.issues.map(formatBundleIssue).join("\n  ")}`,
    );
  }
  if (parsed.bundle.kind !== "dataset") {
    throw new Error(
      `${displayPath(DEMO_DATASET_FILE)} is a "${parsed.bundle.kind}" bundle; the demo dataset must be a dataset`,
    );
  }

  const canonical = serializeBundle(
    canonicalDemoBundle(assessments, assessmentInstances, parsed.bundle.appVersion),
  );
  if (canonical !== text) {
    throw new Error(
      `${displayPath(DEMO_DATASET_FILE)} is not the canonical export of data/assessments.ts — regenerate it with \`pnpm bundles export --dataset --fix\` before seeding from it`,
    );
  }

  return parsed.bundle.payload;
}

const DEMO_DOMAIN = "demo.alignsynch.test";

/** Better Auth rejects a server-side sign-up with no `Origin`; this is the app's own. */
const DEMO_ORIGIN = process.env.DEMO_ORIGIN ?? "http://localhost:3000";

/**
 * The three accounts, and the one party two of them own.
 *
 * The handles are `demo-`prefixed so a leftover row is identifiable by name, and the display
 * names are the party names the dataset carries (`Avery`, `Rowan`) so `/profile/<handle>` and
 * the instance screen agree about who is signed in.
 */
const DEMO_ACCOUNTS = [
  {
    email: `initiator@${DEMO_DOMAIN}`,
    name: "Avery",
    handle: "demo-initiator",
    role: "member",
    party: { instance: "assessment-instance-avery-rowan", role: "initiator" },
  },
  {
    email: `counterparty@${DEMO_DOMAIN}`,
    name: "Rowan",
    handle: "demo-counterparty",
    role: "member",
    party: { instance: "assessment-instance-avery-rowan", role: "counterparty" },
  },
  {
    email: `admin@${DEMO_DOMAIN}`,
    name: "Demo Admin",
    handle: "demo-admin",
    role: "admin",
    party: null,
  },
];

const DEMO_HANDLES = DEMO_ACCOUNTS.map((account) => account.handle);

/** 24 random bytes, base64url — 32 characters, and it exists only in `demo_account`. */
function randomPassword() {
  return randomBytes(24).toString("base64url");
}

/**
 * One real auth user, created through the branch's own `sign-up/email` endpoint.
 *
 * No SDK and no SQL INSERT into `neon_auth`: the endpoint is the thing the app's `/api/auth`
 * proxy calls, so an account is created exactly the way a person's is (password hashed by
 * Better Auth, `account` row and all) and signs in through the real path afterward.
 *
 * The response carries a session token. It is never read, printed or stored — only `user.id`.
 * An error is reported by status and Better Auth's code, because the message can echo the
 * request.
 */
async function createAuthUser(email, password, name) {
  const base = requireVariable(["NEON_AUTH_BASE_URL"]).replace(/\/+$/, "");
  const response = await fetch(`${base}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: DEMO_ORIGIN },
    body: JSON.stringify({ email, password, name }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `account ${email}: sign-up answered HTTP ${response.status}${body.code ? ` (${body.code})` : ""} — is NEON_AUTH_BASE_URL this branch's auth server?`,
    );
  }
  const userId = body?.user?.id;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error(`account ${email}: sign-up answered ${response.status} with no user id`);
  }
  return userId;
}

/**
 * Deletes the three demo accounts and everything that points at them — auth users (their
 * sessions and `account` rows cascade), `demo_account` rows, their `user_profile` rows, and the
 * `party.user_id` bindings — and reports what it removed, by count.
 *
 * By email **and** by stored user id: a run interrupted between the HTTP sign-up and the
 * commit leaves an auth user with no `demo_account` row, and a db where someone deleted the
 * auth user by hand leaves the reverse. Both are demo leftovers, both are removed here.
 */
async function removeDemoAccounts(client) {
  const emails = DEMO_ACCOUNTS.map((account) => account.email);
  const tables = await authTables(client);

  const stored = (
    await client.query("SELECT user_id FROM demo_account WHERE email = ANY($1::text[])", [emails])
  ).rows.map((row) => row.user_id);

  let authIds = [];
  if (tables.users) {
    authIds = (
      await client.query(
        `SELECT id::text AS id FROM neon_auth."${tables.users}" WHERE email = ANY($1::text[])`,
        [emails],
      )
    ).rows.map((row) => row.id);
  }
  const ids = [...new Set([...stored, ...authIds])];

  const unbound =
    ids.length === 0
      ? 0
      : ((
          await client.query("UPDATE party SET user_id = NULL WHERE user_id = ANY($1::text[])", [
            ids,
          ])
        ).rowCount ?? 0);

  // #coach — a membership row is an account's view into a relationship, so it dies with the demo
  // account that held it, exactly as the party binding does. A coach invite is invited by an
  // account too, so it goes the same way.
  const members =
    ids.length === 0
      ? 0
      : ((
          await client.query("DELETE FROM relationship_member WHERE user_id = ANY($1::text[])", [
            ids,
          ])
        ).rowCount ?? 0);
  const coachInvites =
    ids.length === 0
      ? 0
      : ((
          await client.query(
            "DELETE FROM coach_invite WHERE invited_by_user_id = ANY($1::text[])",
            [ids],
          )
        ).rowCount ?? 0);

  const profiles =
    ids.length === 0
      ? 0
      : ((await client.query("DELETE FROM user_profile WHERE user_id = ANY($1::text[])", [ids]))
          .rowCount ?? 0);

  // A profile can also outlive its auth user, and the demo handles are what name it then.
  const orphanHandles = (
    await client.query("DELETE FROM user_profile WHERE handle = ANY($1::text[])", [DEMO_HANDLES])
  ).rowCount;

  const credentials =
    (await client.query("DELETE FROM demo_account WHERE email = ANY($1::text[])", [emails]))
      .rowCount ?? 0;

  let authUsers = 0;
  if (tables.users) {
    authUsers =
      (
        await client.query(
          `DELETE FROM neon_auth."${tables.users}" WHERE email = ANY($1::text[])`,
          [emails],
        )
      ).rowCount ?? 0;
  }

  return {
    authUsers,
    profiles: profiles + orphanHandles,
    credentials,
    unbound,
    members,
    coachInvites,
  };
}

/**
 * The membership rows the backfilled parties hold, re-derived from `party.user_id` so a re-seed
 * converges on the same rows the migration's backfill (`0014_relationship_membership.sql`) wrote.
 * A coach is never seeded here: a coach is invited (`coach_invite`), and this only mirrors the two
 * answering parties into members. `ON CONFLICT DO NOTHING` keeps it a no-op on a converged run.
 */
async function syncRelationshipMembers(client) {
  await client.query(
    `INSERT INTO relationship_member (relationship_id, user_id, role, joined_at)
     SELECT s.relationship_id, p.user_id, p.role, COALESCE(p.submitted_at, r.date, now())
       FROM party p
       JOIN session s ON s.record_id = p.session_record_id
       JOIN record r ON r.id = s.record_id
      WHERE p.user_id IS NOT NULL AND p.role IN ('initiator', 'counterparty')
     ON CONFLICT (relationship_id, user_id) DO NOTHING`,
  );
}

/** Creates the three, from scratch: a fresh password each, stored only in `demo_account`. */
async function seedDemoAccounts(client) {
  const created = [];
  for (const account of DEMO_ACCOUNTS) {
    const password = randomPassword();
    const userId = await createAuthUser(account.email, password, account.name);

    await client.query(
      `INSERT INTO demo_account (email, user_id, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET
         user_id    = EXCLUDED.user_id,
         password   = EXCLUDED.password,
         updated_at = now()`,
      [account.email, userId, password],
    );

    // The role is written here, and nowhere else in the tree: this is the only writer that is
    // allowed to name it (`lib/db/user-profiles.ts` deliberately cannot).
    await client.query(
      `INSERT INTO user_profile (user_id, handle, display_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         handle       = EXCLUDED.handle,
         display_name = EXCLUDED.display_name,
         role         = EXCLUDED.role,
         updated_at   = now()`,
      [userId, account.handle, account.name, account.role],
    );

    created.push({ ...account, userId });
  }
  return created;
}

/**
 * Avery and Rowan are the two people on `assessment-instance-avery-rowan`, and these two
 * accounts are them. One `UPDATE` per party, and a `rowCount` of exactly 1: a binding that
 * matched nothing means the dataset did not land (or its ids moved), and a binding that matched
 * two would mean the instance has two initiators — both are refusals, not warnings.
 */
async function bindDemoParties(client, accounts) {
  const bound = [];
  for (const account of accounts) {
    if (account.party === null) continue;
    const { rows } = await client.query(
      `UPDATE party SET user_id = $1
        WHERE session_record_id = $2 AND role = $3
        RETURNING name`,
      [account.userId, account.party.instance, account.party.role],
    );
    if (rows.length !== 1) {
      throw new Error(
        `demo party ${account.party.instance}/${account.party.role}: ${rows.length} row(s) matched, expected exactly 1 — is the demo dataset imported?`,
      );
    }
    bound.push({ ...account.party, email: account.email, partyName: rows[0].name });
  }
  return bound;
}

/**
 * What the demo half wrote, read back from the rows rather than from the variables that wrote
 * them: three credentials, the roles on their profiles, and which party each one is.
 */
async function demoReport(client) {
  const { rows: accounts } = await client.query(
    `SELECT da.email,
            up.role,
            up.handle,
            p.session_record_id,
            p.role  AS party_role,
            p.name  AS party_name
       FROM demo_account da
       JOIN user_profile up ON up.user_id = da.user_id
       LEFT JOIN party p    ON p.user_id = da.user_id
      ORDER BY p.session_record_id NULLS LAST, p.role`,
  );
  const { rows: totals } = await client.query(
    `SELECT (SELECT count(*)::int FROM demo_account)                                  AS accounts,
            (SELECT count(*)::int FROM user_profile WHERE role = 'admin'
               AND user_id IN (SELECT user_id FROM demo_account))                    AS admins,
            (SELECT count(*)::int FROM user_profile WHERE role = 'admin'
               AND user_id NOT IN (SELECT user_id FROM demo_account))                AS platform_admins,
            (SELECT count(*)::int FROM user_profile WHERE role = 'member'
               AND user_id IN (SELECT user_id FROM demo_account))                    AS demo_members,
            (SELECT count(*)::int FROM party WHERE user_id IS NOT NULL)               AS bound_parties`,
  );
  return { accounts, totals: totals[0] };
}

/* ------------------------------------------------------------------ *\
 * The platform admins — ADMIN_NN_EMAIL / ADMIN_NN_PASS
 * ------------------------------------------------------------------ */

/**
 * The admin seats, read from the environment in numeric order.
 *
 * The spelling is `ADMIN_01_EMAIL` / `ADMIN_01_PASS`, `ADMIN_02_EMAIL` / `ADMIN_02_PASS`, and so
 * on — two zero-padded digits, read as a pair. Every `ADMIN_<nn>_EMAIL` / `ADMIN_<nn>_PASS` key in
 * the environment is a seat, so the count is whatever is configured — two today, one or three
 * tomorrow — and a half-configured pair (an email with no password, or the reverse) is a refusal,
 * not a silent skip: the owner clearly meant to configure a seat and broke it. With no `ADMIN_*`
 * key at all the whole pass is skipped with a printed line, which is the CI and gate state, never
 * an error. Two seats naming the same address are a refusal for the same reason: "two seats" with
 * one email is not a state the seed can converge on, and guessing which address the owner meant is
 * exactly the mistake the refusal exists to avoid.
 *
 * The password is read here and passed only to the sign-up / sign-in calls. It is never printed,
 * never stored in a table and never returned — unlike the demo accounts, which write their
 * generated password to `demo_account` precisely because theirs is *generated*, an admin password
 * is a secret that already has a home (the environment) and must not gain a second one.
 */
function readAdminAccounts() {
  const suffixes = new Set();
  for (const key of Object.keys(process.env)) {
    const match = key.match(/^ADMIN_(\d+)_(EMAIL|PASS)$/);
    if (match) suffixes.add(match[1]);
  }
  const sorted = [...suffixes].sort((a, b) => Number(a) - Number(b));
  const accounts = [];
  const seen = new Map();
  for (const suffix of sorted) {
    const email = process.env[`ADMIN_${suffix}_EMAIL`]?.trim() || "";
    const password = process.env[`ADMIN_${suffix}_PASS`]?.trim() || "";
    if (email === "" || password === "") {
      throw new Error(
        `ADMIN_${suffix}_EMAIL and ADMIN_${suffix}_PASS must both be set (or neither) — the seed found only one`,
      );
    }
    const first = seen.get(email);
    if (first !== undefined) {
      throw new Error(
        `ADMIN_${first}_EMAIL and ADMIN_${suffix}_EMAIL name the same address — two seats need two distinct emails, fix one in .env.local`,
      );
    }
    seen.set(email, suffix);
    accounts.push({ suffix, email, password });
  }
  return accounts;
}

/**
 * The profile identity for a seat. The handle carries the seat number, never the email — the
 * address is a credential and belongs in no URL, and no `ADMIN_*` value provides a name.
 */
function adminProfileFor(suffix) {
  return { handle: `admin-${suffix}`, displayName: "Platform Admin" };
}

/** The auth user id for an email, or `null` when no `neon_auth` user answers to it. */
async function findAuthUserId(client, email) {
  const tables = await authTables(client);
  if (!tables.users) return null;
  const { rows } = await client.query(
    `SELECT id::text AS id FROM neon_auth."${tables.users}" WHERE email = $1`,
    [email],
  );
  return rows[0]?.id ?? null;
}

/**
 * Is the env password the one the auth service has? Answered by signing in with it, never by
 * reading or writing a hash: a 200 means the credentials match, a 401 means they do not, and
 * anything else is a failure to report rather than a password to guess at.
 */
async function adminPasswordMatches(email, password) {
  const base = requireVariable(["NEON_AUTH_BASE_URL"]).replace(/\/+$/, "");
  const response = await fetch(`${base}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: DEMO_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (response.ok) return true;
  if (response.status === 401) return false;
  const body = await response.json().catch(() => ({}));
  throw new Error(
    `admin ${email}: sign-in answered HTTP ${response.status}${body.code ? ` (${body.code})` : ""} — cannot tell whether the password matches`,
  );
}

/**
 * An admin whose password changed since the last seed is removed here — auth user and profile —
 * so phase 2 can recreate it through the sign-up path. The removal runs in phase 1 with the other
 * removals because a sign-up cannot see an uncommitted DELETE: removing and re-creating inside one
 * transaction would answer `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. An admin with a matching
 * password is left alone (phase 2 reconciles its role in place), and an absent admin is left for
 * phase 2 to create. Returns the emails that were removed, by name only.
 */
async function removeStaleAdmins(client, accounts) {
  const removed = [];
  for (const account of accounts) {
    const userId = await findAuthUserId(client, account.email);
    if (userId === null) continue; // absent — phase 2 creates it
    if (await adminPasswordMatches(account.email, account.password)) continue; // matches — keep it

    const tables = await authTables(client);
    if (tables.users) {
      await client.query(`DELETE FROM neon_auth."${tables.users}" WHERE email = $1`, [
        account.email,
      ]);
    }
    await client.query("DELETE FROM user_profile WHERE user_id = $1", [userId]);
    removed.push(account.email);
  }
  return removed;
}

/**
 * The admin seats, converged on the environment. Runs in phase 2 after any stale admin was removed
 * in phase 1: an absent user is created through the sign-up path (the same mechanism the demo
 * accounts use), an existing one is kept and its `user_profile` reconciled to `role = 'admin'`.
 * `ON CONFLICT (user_id)` is what makes a re-run a reconciliation rather than a duplicate. The
 * password is written nowhere — no `demo_account` row, no log line, no return value.
 */
async function seedAdminAccounts(client, accounts, removedEmails) {
  if (accounts.length === 0) {
    console.log("  ○ admins: skipped (no ADMIN_* set)");
    return [];
  }

  const removed = new Set(removedEmails);
  const results = [];
  for (const account of accounts) {
    const profile = adminProfileFor(account.suffix);
    const existing = await findAuthUserId(client, account.email);
    const userId =
      existing ?? (await createAuthUser(account.email, account.password, profile.displayName));

    // The handle is the seat's alone: a stale profile that holds it under another user id (a
    // leftover from a deleted auth user, or a handle taken by hand) must not block the seat's
    // write. Deleting it here — and only the other holder, never the seat's own row — is what
    // keeps a re-run a reconciliation instead of a unique-violation.
    await client.query("DELETE FROM user_profile WHERE handle = $1 AND user_id <> $2", [
      profile.handle,
      userId,
    ]);

    // Role is written here, exactly like the demo accounts write theirs: this is the only writer
    // allowed to name it.
    await client.query(
      `INSERT INTO user_profile (user_id, handle, display_name, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (user_id) DO UPDATE SET
         handle       = EXCLUDED.handle,
         display_name = EXCLUDED.display_name,
         role         = EXCLUDED.role,
         updated_at   = now()`,
      [userId, profile.handle, profile.displayName],
    );

    const action = removed.has(account.email)
      ? "updated"
      : existing === null
        ? "created"
        : "reconciled";
    results.push({ ...account, userId, action });
  }

  console.log(
    `  · admins: ${results.length} seat(s) (${results.map((account) => `${account.email}=${account.action}`).join(", ")})`,
  );
  return results;
}

/* ------------------------------------------------------------------ *\
 * Counts
 * ------------------------------------------------------------------ */

const COUNT_SQL = {
  record: `SELECT count(*)::int AS n FROM record WHERE record_type = 'assessment'`,
  item: "SELECT count(*)::int AS n FROM item",
  response_option: "SELECT count(*)::int AS n FROM response_option",
  session: "SELECT count(*)::int AS n FROM session",
  relationship: "SELECT count(*)::int AS n FROM relationship",
  party: "SELECT count(*)::int AS n FROM party",
  opinion: "SELECT count(*)::int AS n FROM opinion",
  billing_plan: "SELECT count(*)::int AS n FROM billing_plan",
};

async function counts(client) {
  const result = {};
  for (const [table, sql] of Object.entries(COUNT_SQL)) {
    const { rows } = await client.query(sql);
    result[table] = rows[0].n;
  }
  return result;
}

async function main() {
  loadEnv();

  // The platform admins, read once before any phase so the removal and the seed share one list.
  // An absent pair is the whole pass being skipped, not a half-read account.
  const adminAccounts = readAdminAccounts();

  const demo = demoAuthEnabled();
  // With DEMO_AUTH=1 the demo dataset file is the source of the rows (asserted canonical);
  // without it, the fixtures are, exactly as before #183.
  const demoDataset = demo ? await readDemoDataset() : null;
  const { assessments, assessmentInstances } = demoDataset
    ? { assessments: demoDataset.templates, assessmentInstances: demoDataset.instances }
    : await import("../data/assessments.ts");

  // #289 — the billing plan rows come from the same fixture a pricing surface renders, so the
  // table and the page cannot hold two prices. `checkedPlanRows()` throws on a fixture that
  // contradicts itself before any SQL runs.
  const { billingPlanRows } = await import("../data/billing-plans.ts");
  const billingFixtures = billingPlanRows();

  const expected = {
    record: assessments.length + assessmentInstances.length,
    item: [...assessments, ...assessmentInstances].reduce(
      (total, record) => total + record.items.length,
      0,
    ),
    response_option: [...assessments, ...assessmentInstances].reduce(
      (total, record) =>
        total +
        record.items.reduce(
          (count, item) => count + (item.scale.kind === "options" ? item.scale.options.length : 0),
          0,
        ),
      0,
    ),
    session: assessmentInstances.length,
    relationship: assessmentInstances.length,
    party: assessmentInstances.reduce((total, instance) => total + instance.parties.length, 0),
    opinion: assessmentInstances.reduce(
      (total, instance) =>
        total + instance.parties.reduce((count, party) => count + party.opinions.length, 0),
      0,
    ),
    // #289 — one row per tier × interval, from `data/billing-plans.ts`.
    billing_plan: billingFixtures.length,
  };

  const client = new Client({ connectionString: writeDatabaseUrl(), application_name: "db:seed" });
  await client.connect();
  try {
    console.log(
      `db:seed — ${assessments.length} template(s), ${assessmentInstances.length} instance(s)` +
        (demo
          ? ` from ${displayPath(DEMO_DATASET_FILE)} (DEMO_AUTH=1)`
          : " from data/assessments.ts"),
    );

    /* Phase 1 — the removals, in their own transaction, **committed before any HTTP**.
     *
     * The demo accounts are auth users in Neon Auth, and a sign-up is an HTTP request to a
     * server with its own connection: it cannot see an uncommitted DELETE, so deleting and
     * re-creating inside one transaction answers `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` on the
     * second run (measured). Two transactions is the shape the two systems require — and the
     * one wart it leaves, an auth user created after a phase-2 rollback, is cleaned up by this
     * same phase on the next run (it deletes by email, not by remembered id). */
    await client.query("BEGIN");
    let deleted;
    let removed;
    let staleAdmins;
    try {
      deleted = await deleteTempUsers(client);
      // Removing before writing is what makes the demo accounts idempotent *and* what makes
      // DEMO_AUTH unset a real switch: the rows are gone, not merely not-created.
      removed = await removeDemoAccounts(client);
      // An admin whose password changed is removed here — committed before the phase-2 sign-up —
      // so the recreate below is a sign-up against an absent user, never a USER_ALREADY_EXISTS.
      staleAdmins = await removeStaleAdmins(client, adminAccounts);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }

    console.log(
      `  · temp e2e user: ${deleted.users} user row(s), ${deleted.sessions} session row(s) removed`,
    );
    console.log(
      `  · demo accounts: ${
        demo
          ? `${removed.credentials} credential row(s), ${removed.authUsers} auth user(s), ${removed.profiles} profile row(s), ${removed.unbound} party binding(s), ${removed.members} membership row(s), ${removed.coachInvites} coach invite(s) removed before re-seeding`
          : `${removed.credentials} credential row(s) removed, none created (DEMO_AUTH is not 1)`
      }`,
    );

    /* Phase 2 — the rows. One transaction, so a seed that fails halfway leaves the previous
     * rows and never half-copies an instance. */
    await client.query("BEGIN");

    for (const template of assessments) await seedTemplate(client, template);
    for (const instance of assessmentInstances) await seedInstance(client, instance);
    // #289 — the plan rows, from the same fixture a pricing surface renders. Seeded here and not
    // in the migration: a migration is DDL and cannot import the fixture, and a price typed into
    // SQL would be a second copy of the number the page renders.
    await syncBillingPlans(client, billingFixtures);

    // "Only seeded rows": an assessment record this seed does not author is drift, and the
    // honest move is to name it rather than to delete a row someone may have meant.
    const seededIds = [...assessments, ...assessmentInstances].map((record) => record.id);
    const { rows: extra } = await client.query(
      `SELECT id FROM record WHERE record_type = 'assessment' AND id <> ALL($1::text[]) ORDER BY id`,
      [seededIds],
    );
    if (extra.length > 0) {
      throw new Error(
        `record holds assessment row(s) this seed does not author: ${extra.map((row) => row.id).join(", ")} — inspect them before re-seeding`,
      );
    }

    if (demo) {
      const accounts = await seedDemoAccounts(client);
      const bound = await bindDemoParties(client, accounts);
      // #coach — the two bound parties become relationship members, so the relationship they
      // answer is the one they can see. A coach is never added here: a coach is invited.
      await syncRelationshipMembers(client);
      console.log(
        `  · demo accounts created: ${accounts.length} (${accounts.map((account) => `${account.email}=${account.role}`).join(", ")})`,
      );
      for (const party of bound) {
        console.log(`  · ${party.email} is ${party.partyName} — ${party.instance}/${party.role}`);
      }
    }

    // The admin seats — durable, independent of DEMO_AUTH. Runs in phase 2 (with the other
    // writes) after phase 1 committed any stale-admin removals.
    await seedAdminAccounts(client, adminAccounts, staleAdmins);

    const actual = await counts(client);
    for (const [table, count] of Object.entries(expected)) {
      if (actual[table] !== count) {
        throw new Error(
          `${table}: expected ${count} row(s) from ${demo ? displayPath(DEMO_DATASET_FILE) : "data/assessments.ts"}, found ${actual[table]}`,
        );
      }
    }

    // The demo rows are asserted the same way the content rows are: three credentials, one
    // admin, two bound parties, and the dataset the file describes.
    const report = await demoReport(client);
    const demoExpected = demo
      ? { accounts: 3, admins: 1, demo_members: 2, bound_parties: 2 }
      : { accounts: 0, admins: 0, demo_members: 0, bound_parties: 0 };
    for (const [key, count] of Object.entries(demoExpected)) {
      if (report.totals[key] !== count) {
        throw new Error(
          `demo ${key}: expected ${count} row(s) with DEMO_AUTH=${demo ? "1" : "unset"}, found ${report.totals[key]}`,
        );
      }
    }
    if (report.totals.platform_admins !== adminAccounts.length) {
      throw new Error(
        `platform admins: expected ${adminAccounts.length} seat(s) from ADMIN_*, found ${report.totals.platform_admins}`,
      );
    }

    await client.query("COMMIT");

    console.log("\n  seeded counts (identical on every run):");
    for (const [table, count] of Object.entries(actual)) {
      console.log(`    ${table.padEnd(20)} ${count}`);
    }
    console.log(`    ${"demo_account".padEnd(20)} ${report.totals.accounts}`);
    console.log(`    ${"demo admin".padEnd(20)} ${report.totals.admins}`);
    console.log(`    ${"platform admin".padEnd(20)} ${report.totals.platform_admins}`);
    console.log(`    ${"party(user bound)".padEnd(20)} ${report.totals.bound_parties}`);

    if (demo) {
      console.log("\n  demo accounts (passwords are not printed, by design):");
      for (const account of report.accounts) {
        const party =
          account.session_record_id === null
            ? "no party (the admin does not answer an instance)"
            : `${account.party_name} — ${account.session_record_id}/${account.party_role}`;
        console.log(`    ${account.email.padEnd(34)} ${account.role.padEnd(7)} ${party}`);
      }
    } else {
      console.log("\n  demo accounts: none — DEMO_AUTH is not 1");
    }

    console.log(
      `\n✓ db:seed — ${assessments.length} templates + ${assessmentInstances.length} instances mirrored from ${demo ? displayPath(DEMO_DATASET_FILE) : "data/assessments.ts"}`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:seed failed: ${error.message}`);
  process.exitCode = 1;
});
