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
 * a half-copied instance whose parties answer Aspects from two different templates. (The demo
 * identities are the one exception — their two phases are explained at the `BEGIN` below — and the
 * whole run is serialised on the branch by an advisory lock, because the demo branch is shared and
 * two overlapping seeds used to interleave into a `422`; see `scripts/db-seed-lock.mjs`.)
 *
 * **A drifted branch is swept, not refused (#865).** Phase 1 also deletes every `relationship` row
 * the source does not describe — "not in the bundle" is the whole predicate, never an email, an id
 * prefix or a guess about a test row — children first, because
 * `relationship_payment_relationship_id_fkey` has no cascade. Before #865 the seed aborted on
 * those rows (`relationship: expected 4 row(s) … found 38`) with the demo accounts already
 * rolled back, which is how the branch lost its only admin identity. The sweep lives in
 * `scripts/db-seed-sweep.mjs` with its own tests; it runs inside phase 1's transaction, after the
 * lock, and it only ever deletes rows that are *not* the bundle's, so a phase-2 failure cannot
 * have destroyed anything the seed meant to write.
 *
 * **`--check` is the safe question.** `node scripts/db-seed.mjs --check` prints what the sweep
 * would remove and exits **1** on any drift, writing nothing and taking no lock — the version of
 * this question that is safe to ask about a branch every card shares. It reads the committed
 * bundle's JSON directly (E32 keeps that equal to the fixtures), so it needs no TypeScript loader
 * and no HTTP. It is not implemented as "run the destructive path and roll back": a rollback still
 * takes locks, still runs inside another seed's window, and a mistake in it is a deleted branch.
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
 * **#1079 — the demo is a population, not four finished relationships.** `data/assessments.ts`
 * authors thirty-one relationships (and `data/assessment-population.ts` the compact rows they are built
 * from), each carrying a `lifecycle` block: the seven words `0030_relationship_lifecycle.sql` allows,
 * with the instants and reasons their own CHECK constraints require. This file does not invent any
 * of it — `content/assessment.ts::seededLifecycleOf()` turns the block into the row set (which seats
 * exist, how much of the sheet has been answered, whether an invitation was sent and claimed, which
 * terminal instant and reason), and the seed writes exactly that. `pnpm db:verify` compares the rows
 * back against the same function (V21, V31), so the dataset and the branch cannot drift apart.
 *
 * **Known limits, stated so nobody mistakes this for customer data.** The population is synthetic:
 * the names are fixtures on `demo.alignsynch.test`, the scores are authored to produce a spread of
 * Gaps (some In Synch, some Big), the void reasons were written by nobody, and the clock is
 * `DEMO_NOW_ISO` (`content/core.ts`) — every seeded instant is derived from a fixture date plus whole
 * days, never from `now()`. The three demo identities are the only credentials, and they are
 * generated per run and stored only in `demo_account`; the other thirty people are party rows, not
 * accounts. An `active` relationship needs an entitling subscription to read as live rather than
 * lapsed (`membershipOf()`), so the demo writes **one** `billing_subscription` per demo account that
 * initiates a plan-bearing relationship — two over this population (Avery and Rowan), keyed
 * `demo-${email}` so a re-seed updates rather than stacks. Which accounts those are is
 * `scripts/db-seed-subscriptions.mjs::planInitiatingAccounts()`: the seed refuses when its own
 * `relationship.plan` query disagrees with it, and `data/verify/demo-expectations.json` is held
 * equal to the same derivation by `tests/db-seed-subscriptions.test.ts`. Those two rows are the
 * reason an `active` demo is not a status lie.
 *
 * **#1081 — the console's half is part of the dataset.** A walkthrough that signs in as the Admin
 * reached `/admin/instances` and then a rail of empty lists, because nothing wrote the rows
 * `/admin/audit`, `/admin/inbox`, `/admin/broadcast`, `/admin/billing` and `/admin/review` read.
 * `scripts/db-seed-admin-surfaces.mjs` authors them — six audit entries, a worked support thread
 * with a refused reply beside an untouched one, one broadcast and the addresses it reached, a comp
 * and a charged obligation, and the review shelf's issues and to-dos — all from ids drawn from the
 * rows this same seed writes, on the fixture clock (`DEMO_NOW_ISO`), and gated on `DEMO_AUTH` so a
 * production seed never writes a synthetic audit row. `data/verify/demo-expectations.json` carries
 * the thirteen counts and `tests/db-seed-admin-surfaces.test.ts` holds them equal to the plan.
 *
 * **The platform admins.** With `ADMIN_NN_EMAIL` / `ADMIN_NN_PASS` present, this script also
 * ensures each pair is a durable `admin` account: created through the same sign-up path when
 * absent, reconciled (role corrected in place) when present, and — when the password has changed
 * — removed in phase 1 and recreated, never duplicated and never failing. A seat is a *pair*: a
 * lone `ADMIN_02_EMAIL` warns, names the missing variable and is skipped, because a platform admin
 * is opt-in and a half-copied environment must not fail a content seed. The password comes from
 * the environment and is written nowhere: no `demo_account` row, no log line, no file.
 * **Each seat is then signed in through the branch's own `/sign-in/email` with the credential the
 * run just wrote**, because a row is a grant and not an account: `-01`/`-02` once carried
 * `user_profile.role = 'admin'` on the demo while every sign-in answered
 * `401 INVALID_EMAIL_OR_PASSWORD`, and the seed printed `reconciled` throughout. A `200` is the
 * only proof; a `401`/`403` fails the run (see `db-seed-admin-proof.mjs` for what each means and
 * why any other status is printed rather than fatal), and a rotation announces that this run's
 * credential is now the only one that answers — every other copy of it, a deployment's Preview
 * scope included, is stale from that moment.
 * With no `ADMIN_*` set (CI, a fresh clone, the gate) the pass is skipped with a printed line,
 * which is the point — a platform admin is opt-in, not a default.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Client } from "pg";
import { syncBillingPlans } from "./billing-plans.mjs";
import { reconcileAllowlistedAdmins } from "./db-admin-allowlist.mjs";
import {
  rotationNotice,
  seatProofFailure,
  seatProofLine,
  seatProofSummary,
  seatProofVerdict,
} from "./db-seed-admin-proof.mjs";
import { seedAdminSurfaces } from "./db-seed-admin-surfaces.mjs";
import { DEMO_ACCOUNTS, inviteEmailFor } from "./db-seed-invite.mjs";
import {
  SEED_LOCK_ID,
  SEED_LOCK_NAMESPACE,
  SEED_LOCK_POLL_MS,
  lockAcquiredNotice,
  lockTimeoutMessage,
  lockWaitNotice,
  waitBudgetMs,
} from "./db-seed-lock.mjs";
import { planInitiatingAccounts, subscriptionIdFor } from "./db-seed-subscriptions.mjs";
import {
  assertExactCount,
  checkReport,
  inspectDrift,
  removeStrays,
  sweepLine,
} from "./db-seed-sweep.mjs";
import { loadEnv, repoRoot, requireVariable, writeDatabaseUrl } from "./load-env.mjs";
import { sessionStateOf } from "../content/assessment.ts";

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

/**
 * #962 — a template the fixtures mark `published` is published, here, with a version.
 *
 * The two statements that had parted company were `record.status = 'published'` (copied from the
 * fixture) and the absence of a `template_version` row. `lib/flow/store.ts` refuses to create a
 * relationship from a template with no version — correctly, because a relationship reads its
 * Aspects through the version it was bound to — while `/admin/templates` painted the same
 * template green. The operator was told to publish something the badge already called published.
 *
 * So: **every** record the fixture marks `published` gets version 1, and a template the fixture
 * marks `draft` stays draft with no version (the deliberate part has to stay deliberate, or the
 * seed is just a lie in the other direction). A template a seeded relationship names is published
 * regardless of status, because `relationship.template_version_id` is NOT NULL — the seed cannot
 * write the relationship without a version, so the contradiction is printed rather than crashed.
 *
 * **Written through the product's path, not through SQL (#962).** The old statement here was a
 * hand-built `jsonb_build_object` that happened to parse: a second implementation of "what a
 * version holds", and one that could drift from `zAssessment` without any check noticing. So the
 * read is `readTemplateRowsWithin()` — the same statement the console's publish uses, through the
 * connection this transaction is already holding — the parse is `assessmentTemplateFromRows()`,
 * and the write is `snapshotTemplateVersion()`. The payload is therefore a real `zAssessment`
 * because the mapper that builds it is the mapper every other reader builds one with.
 *
 * **`published_at` is the record's own `date`**, as `0026_template_version.sql`'s backfill writes
 * it: a seeded version has no publish to attribute and `now()` would claim one nobody made. That
 * is the one argument the product path takes for the seed's sake.
 *
 * **Idempotent by absence, not by version number.** A template that already has any version is
 * skipped, so a second run writes nothing — `snapshotTemplateVersion()` numbers `max + 1`, and
 * calling it on a published template would mint a v2 on every seed.
 */
async function publishTemplateVersion(client, template, reason) {
  const { rows: existing } = await client.query(
    "SELECT 1 FROM template_version WHERE template_record_id = $1 LIMIT 1",
    [template.id],
  );
  if (existing.length > 0) return 0;

  const { readTemplateRowsWithin } = await import("../lib/db/assessments.ts");
  const { assessmentTemplateFromRows } = await import("../lib/db/rows.ts");
  const { snapshotTemplateVersion } = await import("../lib/db/template-versions.ts");

  const rows = await readTemplateRowsWithin(client, template.id);
  if (rows === undefined) {
    throw new Error(
      `template "${template.slug}" has no rows to publish — the record write above did not land, and a version cannot be snapshotted from nothing`,
    );
  }
  const published = await snapshotTemplateVersion(client, {
    template: assessmentTemplateFromRows(rows),
    publishedBy: null,
    publishedAt: String(template.date),
  });
  if (published === undefined) {
    throw new Error(
      `template "${template.slug}" lost the version-number race while seeding — the seed holds the branch lock, so this is not a concurrent publish`,
    );
  }
  if (reason !== undefined) console.log(`  · ${reason}`);
  return 1;
}

/**
 * The demo invitation's plaintext token, **derived** from the instance it invites somebody to
 * (#975).
 *
 * A real invitation's token is `mintToken()` — 32 random bytes nobody can reconstruct — and the
 * row keeps only its hash. The demo cannot work that way: a seeded token nobody can reproduce is
 * a link nobody can open, which is how `/invite/<token>` ended up as the one surface in the
 * product with no reachable screen. So the demo's token is a SHA-256 of a fixed, instance-scoped
 * string, in base64url: exactly 43 characters, which is the shape `tokenIsWellFormed()` demands,
 * and still stored only as a hash.
 *
 * It is not a secret and does not need to be. Every invitation the seed writes is **claimed** —
 * it names a seat somebody already took — so the token cannot spend anything, and the branch is
 * the disposable demo (`docs/getting-started/demo.md`), not production. The seed prints the link for
 * the two parties the demo accounts own, which is what makes the invitation surface walkable.
 */
function demoInviteToken(instanceId) {
  return createHash("sha256").update(`algnsynch demo invitation:${instanceId}`).digest("base64url");
}

/**
 * #1079 — **the seeded relationship is written from the dataset's own lifecycle**, not from a
 * single-happy-path derivation.
 *
 * Before #1079 the status was inferred from one fact — "did both parties answer every Aspect" —
 * and because the model *requires* both parties to answer, that inference could only ever produce
 * `complete`. The demo branch therefore held thirty finished relationships and zero live product:
 * no draft, nothing waiting on a counterparty, nothing active, nothing lapsed. The dataset now
 * authors its lifecycle per instance (`content/assessment.ts::zSeededLifecycle`), and
 * `seededLifecycleOf()` is the one derivation of what that lifecycle writes — the same function
 * `scripts/db-verify.mjs` (V21, V31) compares the rows back to and
 * `tests/demo-dataset-coverage.test.ts` counts.
 *
 * **The row stays coherent with its own session**, which is what #975 established and V31 holds:
 * the lifecycle's `seats`, `answers`, `accepted` and `invite` decide which `party`, `opinion` and
 * `session_invite` rows exist (see `seedInstance`), so a `draft` genuinely has no invitation and a
 * `pending` one genuinely has nobody in the second seat. The SQL CHECKs are satisfied by
 * construction: `published_at` is `created_at`-or-later, `completed_at` only exists on a published
 * row and never before it, `expired_at` is at-or-after creation, and a lapse reason arrives with
 * its instant (`0032_relationship_lapse.sql`).
 *
 * **Idempotent by update, not by insert.** Every lifecycle column is in the `DO UPDATE` list, so a
 * re-seed converges a row an older seed left `complete` — or one a person changed in the app —
 * instead of leaving the branch half-converted.
 */
async function seedRelationship(client, instance, lifecycle) {
  await client.query(
    `INSERT INTO relationship
       (id, template_id, template_version_id, initiator_user_id, counterparty_user_id,
        purchased_at, plan, created_at, status, published_at, completed_at, void_reason,
        expired_at, lapse_reason)
     VALUES ($1, $2, $3, NULL, NULL, NULL, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       template_id         = EXCLUDED.template_id,
       template_version_id = EXCLUDED.template_version_id,
       plan                = EXCLUDED.plan,
       created_at          = EXCLUDED.created_at,
       status              = EXCLUDED.status,
       published_at        = EXCLUDED.published_at,
       completed_at        = EXCLUDED.completed_at,
       void_reason         = EXCLUDED.void_reason,
       expired_at          = EXCLUDED.expired_at,
       lapse_reason        = EXCLUDED.lapse_reason`,
    [
      `relationship-${instance.id}`,
      instance.templateId,
      `template-version-${instance.templateId}-v1`,
      lifecycle.plan,
      instance.date,
      lifecycle.status,
      lifecycle.publishedAt,
      lifecycle.completedAt,
      lifecycle.voidReason,
      lifecycle.expiredAt,
      lifecycle.lapseReason,
    ],
  );
  return lifecycle;
}

/**
 * The invitation that put the counterparty in their seat (#975, #1079).
 *
 * `claimInvite()` (`lib/flow/store.ts`) is the only code path that creates a Counterparty party,
 * and it does so by spending an invitation: it inserts the party and sets `claimed_at` in one
 * transaction. So a seeded instance whose lifecycle says the counterparty holds a seat must have
 * the invitation that put them there — and an instance whose lifecycle is `draft` must have **no**
 * invitation at all, because nothing has been sent yet. `pending` is the third state: the row
 * exists, `claimed_at` is NULL, and the link is still spendable — which is exactly what the demo's
 * `/invite/<token>` needs in order to show a live invitation.
 *
 * Written from the same facts as the party row, so the two cannot disagree: `created_at` is the
 * relationship's instant, `expires_at` is that instant plus `INVITE_TTL_MS` (7 days, the same
 * constant the product writes), and `claimed_at` is the acceptance instant for a claimed row.
 */
async function seedInvitation(client, instance, lifecycle) {
  const { hashToken, INVITE_TTL_MS } = await import("../lib/flow/tokens.ts");
  if (lifecycle.invite === "none") {
    // A draft never had a link. Deleting by session is the idempotent convergence: a relationship
    // that used to be `pending` and is now `draft` must lose the row, or the branch keeps an
    // invitation for something nobody sent.
    await client.query("DELETE FROM session_invite WHERE session_record_id = $1", [instance.id]);
    return null;
  }
  const token = demoInviteToken(instance.id);
  const expiresAt = new Date(new Date(instance.date).getTime() + INVITE_TTL_MS).toISOString();
  const counterparty = instance.parties.find((party) => party.role === "counterparty");

  await client.query(
    `INSERT INTO session_invite
       (session_record_id, email, counterparty_name, token_hash, created_at, expires_at, claimed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (session_record_id) DO UPDATE SET
       email             = EXCLUDED.email,
       counterparty_name = EXCLUDED.counterparty_name,
       token_hash        = EXCLUDED.token_hash,
       expires_at        = EXCLUDED.expires_at,
       claimed_at        = EXCLUDED.claimed_at`,
    [
      instance.id,
      inviteEmailFor(instance),
      counterparty?.name ?? "",
      hashToken(token),
      instance.date,
      // A claimed invitation's window is history; an unclaimed one still has to satisfy
      // `invite_expires_after_creation`, which the TTL does on its own.
      expiresAt,
      lifecycle.invite === "claimed" ? instance.date : null,
    ],
  );
  return { token, email: inviteEmailFor(instance), claimed: lifecycle.invite === "claimed" };
}

/**
 * One instance's rows: the record, its Aspects, the relationship, the session, the invitation, the
 * seats and the answers — **each written from the lifecycle** (#1079).
 *
 * Which rows exist is the lifecycle's decision, and it is what keeps the demo honest:
 *
 *   `seats`     `initiator` for `draft`/`pending` — the counterparty has not claimed a seat, so
 *               `party` holds one row and a screen that asks "is there a counterparty" answers no.
 *               `both` for everything past the claim.
 *   `answers`   `none`, `initiator` or `both`. The fixture carries the whole sheet (the model
 *               requires it); how much of it has *happened* is a lifecycle fact, and a `published`
 *               row with one side in is the demo's most important screen — the Gap cannot be drawn
 *               until both sides answered.
 *   `accepted`  `both` records `party.accepted_at` from the instance's own instant; `none` leaves it
 *               NULL, so `instanceStatusOf()` derives `answering` rather than `complete`. Without
 *               that, every relationship would read finished whatever its lifecycle said.
 */
async function seedInstance(client, instance, lifecycle) {
  await upsertRecord(client, instance);
  await replaceItems(client, instance);
  // #340 — the relationship the instance was split into. One per instance, idempotent by the
  // same deterministic id the migration's backfill uses (`relationship-<record_id>`), so a
  // re-seed converges on the same row. The two account columns stay NULL here: the demo accounts
  // do not exist yet (they are created and bound later, in phase 2), and the relationship's
  // Initiator/Counterparty are the parties' bindings, which `bindDemoParties` writes on `party`
  // and on the relationship itself. `purchased_at` is NULL — no demo relationship records a purchase.
  await seedRelationship(client, instance, lifecycle);
  await client.query(
    // #1100b — **the session's state is the lifecycle's `seats`, not a flag on the session.** A
    // `draft` or `pending` relationship carries one seat (the invitation may have gone out; nobody
    // has claimed it), so its session is a `draft` session and no count or screen reads it. From
    // the claim onward the row reads `active` — including `void` and `expired`, whose sessions are
    // live sessions that ended, not sessions that never started. Written from the same value the
    // `party` rows below are written from, so a re-seed cannot leave the two disagreeing; V33
    // (`scripts/db-verify.mjs`) compares the rows back to it.
    `INSERT INTO session (record_id, template_record_id, mode, alignment_setting, relationship_id,
                          state)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (record_id) DO UPDATE SET template_record_id = EXCLUDED.template_record_id,
                                          mode = EXCLUDED.mode,
                                          alignment_setting = EXCLUDED.alignment_setting,
                                          relationship_id = EXCLUDED.relationship_id,
                                          state = EXCLUDED.state`,
    [
      instance.id,
      instance.templateId,
      instance.mode,
      instance.setting,
      `relationship-${instance.id}`,
      sessionStateOf(lifecycle),
    ],
  );
  // The invitation that put the counterparty in this seat — written after the `session` row
  // because `session_invite.session_record_id` is a foreign key to it (0013 renamed the table and
  // the column; the constraint never went away).
  await seedInvitation(client, instance, lifecycle);
  await client.query("DELETE FROM party WHERE session_record_id = $1", [instance.id]);
  const seats = instance.parties.filter(
    (party) => lifecycle.seats === "both" || party.role === "initiator",
  );
  for (const party of seats) {
    // #427/R2 — a session is complete only when both parties have **accepted**, so the seed records
    // the acceptance at the fixture's own instant for a lifecycle that says both seats accepted.
    // The fixture carries no acceptance field — an instant the product derives, not something an
    // author writes — which is why it is stamped here rather than in `data/`.
    await client.query(
      "INSERT INTO party (session_record_id, role, name, accepted_at) VALUES ($1, $2, $3, $4)",
      [instance.id, party.role, party.name, lifecycle.accepted === "both" ? instance.date : null],
    );
    const answered =
      lifecycle.answers === "both" ||
      (lifecycle.answers === "initiator" && party.role === "initiator");
    if (!answered) continue;
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

/** Better Auth rejects a server-side sign-up with no `Origin`; this is the app's own. */
const DEMO_ORIGIN = process.env.DEMO_ORIGIN ?? "http://localhost:3000";

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

  // #1079 — the two account columns on `relationship` follow the same rule as `party.user_id`: a
  // demo account removed on purpose must not leave a relationship claiming an initiator no auth
  // user holds (V27's shape, one table over). And the demo subscription dies with the account, or
  // the next run's `provider_subscription_id` would be a row nobody owns.
  const unowned =
    ids.length === 0
      ? 0
      : ((
          await client.query(
            `UPDATE relationship SET initiator_user_id = NULL
              WHERE initiator_user_id = ANY($1::text[])`,
            [ids],
          )
        ).rowCount ?? 0) +
        ((
          await client.query(
            `UPDATE relationship SET counterparty_user_id = NULL
              WHERE counterparty_user_id = ANY($1::text[])`,
            [ids],
          )
        ).rowCount ?? 0);
  const subscriptions =
    ids.length === 0
      ? 0
      : ((
          await client.query("DELETE FROM billing_subscription WHERE user_id = ANY($1::text[])", [
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
    unowned,
    subscriptions,
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
 * Every seat a demo identity holds, plus the two account columns the relationship itself carries.
 *
 * Binding is by **party name** (#1079). It used to be one hard-coded `(instance, role)` per account,
 * which was right while the dataset had four instances and one of them belonged to Avery — but a
 * thirty-relationship demo whose demo buttons each opened one row would be a dataset nobody can
 * browse. Every row whose name is the account's display name is that person's seat, and the
 * relationship's own `initiator_user_id` / `counterparty_user_id` follow from the seats (an
 * `UPDATE … FROM`, so the two facts are written in one statement and cannot disagree).
 *
 * A binding that matches **nothing** is still a refusal, not a warning: it means the dataset did
 * not land, or a name changed in `data/assessment-population.ts` without this file following.
 */
async function bindDemoParties(client, accounts) {
  const bound = [];
  for (const account of accounts) {
    // The operator holds no seat — `holdsSeat: false` is the whole reason this loop can skip an
    // identity. Before #1083 the same skip was `if (account.party === null) continue;`: a field
    // that no longer exists, so #1083 deleted the field and the branch together and the seed then
    // demanded a `party` row named "Demo Admin" on every run.
    if (account.holdsSeat === false) continue;
    const { rows } = await client.query(
      `UPDATE party SET user_id = $1 WHERE name = $2
        RETURNING session_record_id, role, name`,
      [account.userId, account.name],
    );
    if (rows.length === 0) {
      throw new Error(
        `demo identity ${account.email}: no party row is named "${account.name}" — the names in data/assessment-population.ts and this file disagree`,
      );
    }
    for (const row of rows) {
      bound.push({
        instance: row.session_record_id,
        role: row.role,
        email: account.email,
        partyName: row.name,
      });
    }
  }

  // The relationship's account columns are the seats' bindings, read from `party` rather than kept
  // as a second list. `member` surfaces read them (`relation` → `initiator_user_id`), so a NULL here
  // is a relationship its own initiator cannot see.
  await client.query(
    `UPDATE relationship r
        SET initiator_user_id = p.user_id
       FROM session s
       JOIN party p ON p.session_record_id = s.record_id
      WHERE s.relationship_id = r.id AND p.role = 'initiator' AND p.user_id IS NOT NULL
        AND r.initiator_user_id IS DISTINCT FROM p.user_id`,
  );
  await client.query(
    `UPDATE relationship r
        SET counterparty_user_id = p.user_id
       FROM session s
       JOIN party p ON p.session_record_id = s.record_id
      WHERE s.relationship_id = r.id AND p.role = 'counterparty' AND p.user_id IS NOT NULL
        AND r.counterparty_user_id IS DISTINCT FROM p.user_id`,
  );
  return bound;
}

/**
 * **The live subscription a real `active` relationship needs** (#1079).
 *
 * `membershipOf()` reads a live status with no entitling subscription as `lapsed`, so an `active`
 * row on an account with no `billing_subscription` renders "the initiator's membership ended — the
 * subscription was cancelled … read-only for both of you". That is the trade the previous seed
 * refused to make (it wrote every row `complete` instead), and it is why this has to exist before
 * the dataset can carry an `active` word at all: a status lie is not fixed by a billing lie.
 *
 * One row per demo account that initiates a **plan-bearing** relationship, on the tier that
 * relationship was bought on (`relationship.plan`), `status: 'active'` — so the period end cannot
 * expire the demo — and the deterministic `provider_subscription_id` is the idempotency key, as a
 * provider's would be. The partial unique index (`one live subscription per account`) is what keeps
 * a re-seed from stacking a second one. Which accounts those are is
 * `db-seed-subscriptions.mjs::planInitiatingAccounts()`, derived from the dataset; the query here
 * reads the tier back from the seeded rows and refuses when the two disagree.
 */
async function seedDemoSubscriptions(client, accounts, instances) {
  const { DEMO_NOW_ISO } = await import("../content/core.ts");
  const { seededLifecycleOf } = await import("../content/assessment.ts");
  const periodEnd = new Date(Date.parse(DEMO_NOW_ISO) + 30 * 24 * 60 * 60 * 1000).toISOString();
  // Who gets a row is derived from the dataset the seed is installing, not decided here
  // (`db-seed-subscriptions.mjs`). The query below stays authoritative for **which tier** the row
  // is written on — it reads the relationship's own `plan`, the fact the product bills against —
  // and this set is the check that the query still names the same accounts the dataset authors. A
  // disagreement is a refusal: a silently smaller demo reads an `active` relationship as `lapsed`,
  // and a silently larger one bills an account that bought nothing.
  const expected = new Set(
    planInitiatingAccounts(instances, (instance) => seededLifecycleOf(instance).plan).map(
      (account) => account.email,
    ),
  );
  const written = [];
  for (const account of accounts) {
    const { rows } = await client.query(
      `SELECT rel.plan
         FROM relationship rel
        WHERE rel.initiator_user_id = $1 AND rel.plan IS NOT NULL
        ORDER BY CASE rel.status WHEN 'active' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
                 rel.created_at DESC
        LIMIT 1`,
      [account.userId],
    );
    const plan = rows[0]?.plan;
    if (expected.has(account.email) !== (plan !== undefined)) {
      throw new Error(
        plan === undefined
          ? `demo identity ${account.email} initiates a plan-bearing relationship in the dataset, but holds none in the seeded rows — the party binding and the dataset disagree (see data/assessment-population.ts)`
          : `demo identity ${account.email} holds a seeded relationship on plan "${plan}", but the dataset authors none it initiates — ${account.email} would be billed for a demo it did not buy`,
      );
    }
    if (plan === undefined) continue;
    await client.query(
      `INSERT INTO billing_subscription
         (user_id, plan_id, interval, provider, provider_subscription_id, status, current_period_end)
       VALUES ($1, $2, 'month', 'mock', $3, 'active', $4)
       ON CONFLICT (provider_subscription_id) DO UPDATE SET
         user_id            = EXCLUDED.user_id,
         plan_id            = EXCLUDED.plan_id,
         interval           = EXCLUDED.interval,
         status             = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end,
         updated_at         = now()`,
      [account.userId, plan, subscriptionIdFor(account.email), periodEnd],
    );
    written.push({ email: account.email, plan });
  }
  if (written.length !== expected.size) {
    // Every account the derivation names is one this run was given; a mismatch means an identity
    // arrived without a row (or a row arrived for an identity the dataset does not author), which
    // is exactly the drift `data/verify/demo-expectations.json` would then record as correct.
    throw new Error(
      `the dataset authors ${expected.size} plan-initiating demo account(s) (${[...expected].join(", ")}), but this run wrote ${written.length} subscription(s) — the demo would show an under- or over-entitled membership`,
    );
  }
  return written;
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
 * on — two zero-padded digits, read as a pair. Every complete pair is a seat, so the count is
 * whatever is configured — two today, one or three tomorrow. Three things about the reading,
 * because each one is a decision:
 *
 *   - **A seat is a pair.** A lone `ADMIN_02_EMAIL` or a lone `ADMIN_02_PASS` is not a seat — the
 *     address and the password both have to be there. It is not a failure either: the seed prints
 *     one warning naming the variable that is missing and carries on. A platform admin is opt-in,
 *     so a half-copied environment must not turn a content seed red, and the warning is loud
 *     enough that nobody believes a seat was created when it was not.
 *   - **One address, one seat.** Two seats naming the same email is ambiguous, so the lower number
 *     wins and the higher one warns. Deterministic by seat number, never by environment order.
 *   - **Nothing configured is the normal case.** With no `ADMIN_*` key at all (CI, a fresh clone,
 *     the gate) the pass is skipped with a printed line; that is a state, not an error.
 *
 * The password is read here and passed only to the sign-up / sign-in calls. It is never printed,
 * never stored in a table and never returned — unlike the demo accounts, whose password is
 * *generated* and written to `demo_account` because that is the only way to sign in as them, an
 * admin password already has a home (the environment) and must not gain a second one. No warning
 * below quotes a value: the variable name and the seat number are all they carry.
 *
 * `configured` is "the environment named an `ADMIN_*` key at all", which is what decides how the
 * skip line reads — `skipped (no ADMIN_* set)` would be a lie when a half pair is present.
 */
function readAdminAccounts() {
  const suffixes = new Set();
  for (const key of Object.keys(process.env)) {
    const match = key.match(/^ADMIN_(\d+)_(EMAIL|PASS)$/);
    if (match) suffixes.add(match[1]);
  }
  const sorted = [...suffixes].sort((a, b) => Number(a) - Number(b));
  const accounts = [];
  const warnings = [];
  const seen = new Map();
  for (const suffix of sorted) {
    const email = process.env[`ADMIN_${suffix}_EMAIL`]?.trim() || "";
    const password = process.env[`ADMIN_${suffix}_PASS`]?.trim() || "";
    if (email === "" || password === "") {
      const missing = email === "" ? "EMAIL" : "PASS";
      const present = missing === "EMAIL" ? "PASS" : "EMAIL";
      warnings.push(
        `ADMIN_${suffix}_${present} is set without ADMIN_${suffix}_${missing} — the seat is skipped, because a seat is a pair`,
      );
      continue;
    }
    const first = seen.get(email);
    if (first !== undefined) {
      warnings.push(
        `ADMIN_${suffix}_EMAIL names the same address as ADMIN_${first}_EMAIL — ADMIN_${first} keeps the seat and ADMIN_${suffix} is skipped`,
      );
      continue;
    }
    seen.set(email, suffix);
    accounts.push({ suffix, email, password });
  }
  return { accounts, warnings, configured: sorted.length > 0 };
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
 * The answer the auth service gives for this credential, as `{ status, code }` — `200` is the
 * password the account has, `401` is a different one, and any other status is reported rather than
 * treated as a password to guess at. The body's Better Auth `code` rides along so a refusal can be
 * named exactly (`INVALID_ORIGIN` is a different problem from `INVALID_EMAIL_OR_PASSWORD`).
 */
async function adminSignInStatus(email, password) {
  const base = requireVariable(["NEON_AUTH_BASE_URL"]).replace(/\/+$/, "");
  const response = await fetch(`${base}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: DEMO_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (response.ok) return { status: response.status, code: "" };
  const body = await response.json().catch(() => ({}));
  return { status: response.status, code: body.code ?? "" };
}

/**
 * Is the env password the one the auth service has? Answered by signing in with it, never by
 * reading or writing a hash: a 200 means the credentials match, a 401 means they do not, and
 * anything else is a failure to report rather than a password to guess at.
 */
async function adminPasswordMatches(email, password) {
  const { status, code } = await adminSignInStatus(email, password);
  if (status === 200) return true;
  if (status === 401) return false;
  throw new Error(
    `admin ${email}: sign-in answered HTTP ${status}${code ? ` (${code})` : ""} — cannot tell whether the password matches`,
  );
}

/**
 * An admin whose password changed since the last seed is removed here — auth user and profile —
 * so phase 2 can recreate it through the sign-up path. The removal runs in phase 1 with the other
 * removals because a sign-up cannot see an uncommitted DELETE: removing and re-creating inside one
 * transaction would answer `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. An admin with a matching
 * password is left alone (phase 2 reconciles its role in place), and an absent admin is left for
 * phase 2 to create. Returns the emails that were rotated, by name only.
 *
 * A rotated account keeps its id no more than a deleted demo account does, so the rows that are
 * the *account's view* of the product go with it — a party binding, a relationship membership, an
 * invite it sent — exactly the set `removeDemoAccounts` treats as account-scoped. What the account
 * *authored* (`record.author_user_id`, a subscription) is deliberately left alone: that is content
 * and history, not a claim about who is signed in.
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
    await client.query("UPDATE party SET user_id = NULL WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM relationship_member WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM coach_invite WHERE invited_by_user_id = $1", [userId]);
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
 *
 * The log is safe by construction and says one line per seat, `○ admins: <email> created` or
 * `○ admins: <email> reconciled`, then one `sign-in` line per seat and the count that signed in
 * (`seatProofLine` / `seatProofSummary`), plus the count of passwords rotated. An address is not a
 * credential (it is already in `.env.local` and in the operator's head); the password never
 * appears in any line, in whole or in part — the proof functions take an address and a status and
 * nothing else, so the shape of the call is the guarantee rather than a review of the strings.
 */
async function seedAdminAccounts(client, { accounts, warnings, configured }, rotatedEmails) {
  for (const warning of warnings) console.log(`  ! admins: ${warning}`);
  if (accounts.length === 0) {
    console.log(
      configured
        ? "  ○ admins: skipped (no complete ADMIN_* pair)"
        : "  ○ admins: skipped (no ADMIN_* set)",
    );
    return [];
  }

  const rotated = new Set(rotatedEmails);
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

    // A rotated seat is `reconciled`, not `created`: phase 1 removed it precisely because the
    // address already existed and only its password changed. The operator asked for a converged
    // seat, and that is what both words report — one line per seat, never a password.
    const wasRotated = rotated.has(account.email);
    const action = existing === null && !wasRotated ? "created" : "reconciled";
    results.push({ ...account, userId, action, rotated: wasRotated });
    console.log(`  ○ admins: ${account.email} ${action}`);
  }

  const rotatedCount = results.filter((seat) => seat.rotated).length;
  console.log(
    `  · admins: ${results.length} seat(s) converged on ADMIN_*${
      rotatedCount > 0 ? `, ${rotatedCount} password(s) rotated` : ""
    }`,
  );

  // The proof, and the reason `created` / `reconciled` is not the end of this pass: a row was
  // written, which says nothing about whether anybody can get in. Every configured seat signs in
  // through the branch's own `/sign-in/email` with the credential this run converged it on, and a
  // refusal fails the seed before phase 2 commits (`seatProofFailure` says what a 401 and a 403
  // each mean). Anything the auth service answers that is neither proof nor refusal is printed and
  // not fatal — a rate-limited probe is not evidence about a credential.
  const proofs = [];
  for (const seat of results) {
    const { status } = await adminSignInStatus(seat.email, seat.password);
    proofs.push({ email: seat.email, status });
    console.log(seatProofLine({ email: seat.email, status }));
  }
  console.log(seatProofSummary(proofs));
  if (!seatProofVerdict(proofs).ok) throw new Error(seatProofFailure(proofs));

  // A rotation is correct on a password change and its side effect is invisible: the seat now
  // answers to this run's credential only, so every other copy of it is stale from here.
  if (rotatedCount > 0) console.log(rotationNotice(rotatedEmails));

  return results;
}

/* ------------------------------------------------------------------ *\
 * The review catalogue (#667)
 * ------------------------------------------------------------------ */

/**
 * `data/review-artifacts.ts` → `review_artifact`, idempotently.
 *
 * The same rule the plans above follow: the list a surface renders is a fixture, so it is mirrored
 * into rows rather than typed into SQL, and a re-run converges instead of counting.
 *
 * **Upsert, never delete-and-reinsert.** The artifact id is the identity the checklist items and
 * the issues hang off (`ON DELETE CASCADE`), so a delete would take a reviewer's feedback with it —
 * deleting a review artifact is not a seed's decision. An entry the fixture stops authoring is left
 * alone for the same reason the seed leaves an unauthored `record`: somebody's work may be under it.
 *
 * Returns how many the fixture authors, which is what the run prints. It is **not** in `COUNT_SQL`:
 * every other count there is asserted equal to the fixture, and this table's row count is a fact
 * about the fixture rather than about the seed's fidelity — the todos and issues beside it are
 * written by people and would make "identical on every run" false.
 */
async function syncReviewArtifacts(client) {
  const { reviewArtifacts } = await import("../data/review-artifacts.ts");
  for (const artifact of reviewArtifacts) {
    await client.query(
      `INSERT INTO review_artifact (id, slug, title, kind, version, path, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         title = EXCLUDED.title,
         kind = EXCLUDED.kind,
         version = EXCLUDED.version,
         path = EXCLUDED.path,
         captured_at = EXCLUDED.captured_at`,
      [
        artifact.id,
        artifact.slug,
        artifact.title,
        artifact.kind,
        artifact.version,
        artifact.path,
        artifact.capturedAt,
      ],
    );
  }
  return reviewArtifacts.length;
}

/* ------------------------------------------------------------------ *\
 * `--check` — the read-only question about a shared branch (#865)
 * ------------------------------------------------------------------ */

/**
 * The relationship ids the bundle describes, read from the committed JSON.
 *
 * **JSON, not `data/assessments.ts`.** `--check` has to run as the card's acceptance command
 * (`node scripts/db-seed.mjs --check`, no `--import ./scripts/ts-modules.mjs`), because it asks a
 * yes/no question about a branch every other card shares and should not need the TypeScript
 * loader — or a live auth server — to answer it. The committed bundle is the seed's own source in
 * demo mode, and E32 (`pnpm data:check`) fails when it drifts from `data/assessments.ts`, so the
 * two id sets are one set; the seed re-asserts the canonical export itself before it writes a row.
 */
function bundleRelationshipIdsFromFile() {
  const bundle = JSON.parse(readFileSync(DEMO_DATASET_FILE, "utf8"));
  const instances = bundle?.payload?.instances;
  if (!Array.isArray(instances)) {
    throw new Error(
      `${displayPath(DEMO_DATASET_FILE)} carries no payload.instances — cannot tell which relationships are the bundle's`,
    );
  }
  return instances.map((instance) => `relationship-${instance.id}`);
}

/**
 * `node scripts/db-seed.mjs --check` — what the sweep would remove, and **exit 1 on any drift**.
 *
 * Three properties, and each is why this mode exists rather than a `--dry-run` flag on the seed:
 *
 *   - **It writes nothing.** `inspectDrift` issues `SELECT`s only, so there is no rollback to get
 *     wrong and no window in which a shared branch is altered.
 *   - **It takes no lock.** A check that blocked on the seed lock would be a check that hangs
 *     behind somebody else's seed; the question is worth answering at any moment, and a read
 *     cannot interleave destructively with a write.
 *   - **Exit 1 is the answer, not a failure.** `0` = every relationship row is the bundle's;
 *     `1` = drift, listed so it can be read. The seed converges it; nothing here repairs it.
 *
 * A stray that owns sessions is called out separately, because the sweep deletes those sessions
 * and leaves their `record` rows: a record this seed did not author is the one thing it still
 * refuses rather than deletes, and the operator should hear that before running the seed.
 */
async function checkOnly() {
  const source = displayPath(DEMO_DATASET_FILE);
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "db:seed --check",
  });
  await client.connect();
  try {
    const drift = await inspectDrift(client, {
      bundleRelationshipIds: bundleRelationshipIdsFromFile(),
    });
    console.log("  · read-only: no advisory lock, no write, no HTTP");
    const report = checkReport({ ...drift, source });
    for (const line of report.lines) console.log(line);
    if (drift.counts.session > 0) {
      console.log(
        "  ! a stray relationship that owns a session leaves that session's `record` row behind — the seed names such a record instead of deleting content it did not author",
      );
    }
    process.exitCode = report.exitCode;
  } finally {
    await client.end();
  }
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
  // #975/#1079 — one invitation per relationship that went out: the row that put each counterparty
  // in their seat. Counted because "the invitation exists" is a fact the seed promises and V31
  // checks — and **not** one per instance, because a draft has no link.
  session_invite: "SELECT count(*)::int AS n FROM session_invite",
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

/* ------------------------------------------------------------------ *\
 * The seed lock — one advisory lock on the branch, across both phases
 * ------------------------------------------------------------------ */

/**
 * The backend holding this branch's seed lock, or `null`.
 *
 * Read from `pg_locks` joined to `pg_stat_activity`, so the message names the tool (`db:seed`,
 * `demo:verify`) and the pid an operator can look at, and nothing else — no worktree, no person,
 * no connection string. A role that cannot see the other session gets `null`, which the message
 * reports honestly rather than guessing.
 *
 * `objsubid = 2` is the two-integer advisory-lock form: `classid` is the first key and `objid` the
 * second, which is why the pair is passed as the same two integers everywhere.
 */
async function seedLockHolder(client) {
  const { rows } = await client.query(
    `SELECT a.pid, a.application_name, a.datname, a.state
       FROM pg_locks l
       JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype  = 'advisory'
        AND l.objsubid  = 2
        AND l.classid   = $1::int::oid
        AND l.objid     = $2::int::oid
        AND l.granted
      ORDER BY a.pid
      LIMIT 1`,
    [SEED_LOCK_NAMESPACE, SEED_LOCK_ID],
  );
  return rows[0] ?? null;
}

/**
 * Takes the seed lock, waiting for a concurrent seed instead of racing it.
 *
 * The demo branch is shared fleet-wide and several cards run `db:seed` / `demo:verify` against it.
 * Without this, two overlapping runs interleave across the two phases and the loser's sign-up is
 * told `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` — a red run that describes the other process, not
 * the tree. So the wait is bounded and *announced*: a silent hang is indistinguishable from a
 * wedged seed, and the operator needs the holder's pid to tell those apart.
 *
 * `pg_try_advisory_lock` in a loop rather than a blocking `pg_advisory_lock`, because the blocking
 * form gives no way to time out: a seed left hanging by a dead-but-open session would hold a card
 * for as long as the dispatcher allows and then fail with nothing to read.
 */
async function acquireSeedLock(client) {
  const budgetMs = waitBudgetMs();
  const startedAt = Date.now();
  const tryLock = async () =>
    (
      await client.query("SELECT pg_try_advisory_lock($1::int, $2::int) AS ok", [
        SEED_LOCK_NAMESPACE,
        SEED_LOCK_ID,
      ])
    ).rows[0].ok === true;

  if (await tryLock()) return;

  console.log(lockWaitNotice({ holder: await seedLockHolder(client), budgetMs }));
  while (Date.now() - startedAt < budgetMs) {
    await new Promise((resolve) => setTimeout(resolve, SEED_LOCK_POLL_MS));
    if (await tryLock()) {
      console.log(lockAcquiredNotice({ waitedMs: Date.now() - startedAt }));
      return;
    }
  }
  throw new Error(lockTimeoutMessage({ holder: await seedLockHolder(client), budgetMs }));
}

/** Release on the way out. `false` (never held) is not an error; a dead connection is not either. */
async function releaseSeedLock(client) {
  await client
    .query("SELECT pg_advisory_unlock($1::int, $2::int)", [SEED_LOCK_NAMESPACE, SEED_LOCK_ID])
    .catch(() => {});
}

/**
 * The sentence a failed phase 2 appends to its own error (#865).
 *
 * `demo accounts created: 3` printed above a rolled-back transaction is a success that vanishes:
 * the auth users are real (a sign-up is HTTP, and it cannot see an uncommitted row), their
 * `demo_account` / `user_profile` / `party` rows are not, and the next run's phase 1 deletes the
 * users by email. Saying all three is the difference between "the seed half-worked" and "the seed
 * lost my admin".
 */
function rolledBackNotice(demoAccountsCreated) {
  const base =
    "phase 2 was ROLLED BACK — none of its writes survive this run (phase 1's removals are committed, and are the documented half-seeded state).";
  if (demoAccountsCreated === 0) return base;
  return [
    base,
    `The ${demoAccountsCreated} demo account(s) this run created are real auth users in Neon Auth, but no demo_account, user_profile or party row for them was kept — they cannot sign in.`,
    "The next successful seed removes those auth users in phase 1 (by email) and creates them again.",
  ].join("\n  ");
}

async function main() {
  loadEnv();

  // #865 — the read-only question first, and it returns without ever reaching the lock, the
  // dataset import or the auth server: `--check` must be safe to run while another card seeds.
  if (process.argv.includes("--check")) {
    await checkOnly();
    return;
  }

  /**
   * #914 — the review shelf's rows, and *only* those.
   *
   * The catalogue in `data/review-artifacts.ts` reaches `review_artifact` through this file, but the
   * full seed is all-or-nothing inside one transaction: on the shared demo branch a single
   * assessment row another card authored makes the closing drift check throw, which rolls the
   * shelf rows back with everything else. The shelf then 404s an artifact that is committed, in the
   * catalogue and in the manifest — the whole reason the `?artifact=` link was dead.
   *
   * So this is the narrow door: no lock, no content rows, no sweep, no auth server, one idempotent
   * upsert per catalogue row. It cannot damage a branch someone else is seeding, and it is the
   * command a merge needs when only the shelf moved.
   */
  if (process.argv.includes("--review")) {
    const client = new Client({
      connectionString: writeDatabaseUrl(),
      application_name: "db:seed --review",
    });
    await client.connect();
    try {
      const count = await syncReviewArtifacts(client);
      console.log(`review artifacts: ${count} row(s) upserted from data/review-artifacts.ts`);
    } finally {
      await client.end();
    }
    return;
  }

  /**
   * #914 — the demo identities, and only those.
   *
   * `seedDemoAccounts` runs at the *end* of the seed's second transaction, after the content and the
   * review shelf; phase 1 deletes the three identities at the *start*, in its own committed
   * transaction. A run that stops in between — a foreign assessment row the closing drift check
   * refuses, an auth endpoint that answers slowly — therefore leaves the branch holding the content
   * and none of the demo identities, and `db:seed` cannot be re-run while the branch still carries a
   * row another card authored. That is the state the demo buttons on `/login` are dead in, and this
   * is the narrow repair: the same three functions in the same order, no deletes, no content writes.
   */
  if (process.argv.includes("--demo-accounts")) {
    const client = new Client({
      connectionString: writeDatabaseUrl(),
      application_name: "db:seed --demo-accounts",
    });
    await client.connect();
    try {
      const accounts = await seedDemoAccounts(client);
      const bound = await bindDemoParties(client, accounts);
      await syncRelationshipMembers(client);
      // #1079 — the same subscription the full seed writes, so the narrow repair leaves an
      // `active` relationship reading entitled rather than lapsed. The derivation is read from the
      // fixtures, which `data:check` E32 holds the bundle equal to.
      const { assessmentInstances } = await import("../data/assessments.ts");
      const subscriptions = await seedDemoSubscriptions(client, accounts, assessmentInstances);
      /* #1081 — the console half is re-written here too, and the reason is the ids: every account
       * this path creates is a *new* auth user, so a repair that stopped at the subscriptions would
       * leave the audit log's `actor_user_id` (and the grant's `granted_by`) pointing at the
       * accounts the previous run deleted, and `/admin/audit` would print bare uuids. The function
       * is idempotent, so re-binding is the whole cost. */
      const { DEMO_NOW_ISO } = await import("../content/core.ts");
      const operator = accounts.find((account) => account.role === "admin");
      const adminHalf =
        operator === undefined
          ? null
          : await seedAdminSurfaces(client, { actorUserId: operator.userId, nowIso: DEMO_NOW_ISO });
      console.log(
        `demo accounts: ${accounts.length} identity(ies) restored, ${bound.length} party binding(s), ${subscriptions.length} subscription(s)` +
          (adminHalf === null ? " — no operator, the console half was not written" : ""),
      );
    } finally {
      await client.end();
    }
    return;
  }

  // The platform admins, read once before any phase so the removal and the seed share one list.
  // A half-configured pair is a printed warning, never a failure: nothing configured is the gate's
  // state, and a stray variable must not turn a content seed red.
  const admin = readAdminAccounts();

  const demo = demoAuthEnabled();
  // With DEMO_AUTH=1 the demo dataset file is the source of the rows (asserted canonical);
  // without it, the fixtures are, exactly as before #183.
  const demoDataset = demo ? await readDemoDataset() : null;
  const { assessments, assessmentInstances } = demoDataset
    ? { assessments: demoDataset.templates, assessmentInstances: demoDataset.instances }
    : await import("../data/assessments.ts");

  // One name for "where the rows came from", used by the sweep, the assertion and the closing
  // line: a message that spells the source differently from the sweep is a message that makes a
  // converged branch look like a drifted one.
  const source = demo ? displayPath(DEMO_DATASET_FILE) : "data/assessments.ts";

  // #1079 — every instance's lifecycle, derived once from the dataset itself. One function
  // (`content/assessment.ts::seededLifecycleOf`) decides which `relationship`, `party`, `opinion`
  // and `session_invite` rows exist, so the seed cannot write a state the fixtures do not author.
  const { seededLifecycleOf } = await import("../content/assessment.ts");
  const lifecycles = new Map(
    assessmentInstances.map((instance) => [instance.id, seededLifecycleOf(instance)]),
  );
  // #865 — the ids this seed is about to write, and therefore the only relationship rows the
  // branch is allowed to keep: the sweep deletes by *not being in this set*.
  const bundleRelationshipIds = assessmentInstances.map(
    (instance) => `relationship-${instance.id}`,
  );

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
    // #975 — one invitation per session, **except a draft** (#1079): a relationship that was never
    // sent has no link, so the count is the lifecycles that went out, not the instance count.
    session_invite: assessmentInstances.filter(
      (instance) => lifecycles.get(instance.id).invite !== "none",
    ).length,
    // #1079 — the seats and the answers are the lifecycle's, not the fixture's: a `pending`
    // relationship has one party row, a `published` one with one side in has one seat's answers.
    party: assessmentInstances.reduce(
      (total, instance) => total + (lifecycles.get(instance.id).seats === "both" ? 2 : 1),
      0,
    ),
    opinion: assessmentInstances.reduce((total, instance) => {
      const lifecycle = lifecycles.get(instance.id);
      const sides = lifecycle.answers === "both" ? 2 : lifecycle.answers === "initiator" ? 1 : 0;
      return total + sides * instance.items.length;
    }, 0),
    // #289 — one row per tier × interval, from `data/billing-plans.ts`.
    billing_plan: billingFixtures.length,
  };

  const client = new Client({ connectionString: writeDatabaseUrl(), application_name: "db:seed" });
  await client.connect();
  // #865 — "the accounts exist" and "the accounts were kept" are different sentences, and this
  // is what lets a failure say which one happened.
  let phaseTwoOpen = false;
  let demoAccountsCreated = 0;
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
     * same phase on the next run (it deletes by email, not by remembered id).
     *
     * **Two phases means two processes can interleave, so the branch's seed lock is held across
     * both** (taken above, released in `finally`). It has to be the database's lock: the runs come
     * from different worktrees with different pids, so a file lock would serialise nothing.
     *
     * **What a failed run leaves behind, stated because it is recoverable, not atomic.** If phase 1
     * commits and phase 2 then aborts — a sign-up the auth server refuses, a count mismatch, a
     * killed process, another seed's collision before the lock existed — the content rows stay as
     * they were and the demo identities are gone: measured on the demo branch as `33 records /
     * 172 items / 0 demo_account / 0 demo profile / 0 bound party / 0 membership`. That is
     * "half-seeded", and the recovery is the next successful seed, not a manual repair: phase 1
     * deletes by email *and* by stored id, so it removes whatever the abandoned run left.
     *
     * **#865 — the sweep runs here, with the other deletes, for that same reason.** It is the
     * destructive half, and the rows it removes are defined by *not* being the source's, so a
     * delete committed without the re-insert has destroyed nothing this seed meant to write; the
     * reverse order would put a sweep inside the transaction whose rollback is supposed to protect
     * content the seed authored. It is not a separate pre-flight step: it runs under the branch's
     * advisory lock (taken just above) and inside this transaction, so two seeds cannot sweep
     * past each other, and a killed run leaves the branch either swept or not swept — never with
     * a half-deleted subtree. Phase 2's exact-count assertion is unchanged: convergence is what
     * makes it affordable, deleting it (or weakening it) is what would make the next drift
     * invisible. */
    await acquireSeedLock(client);
    await client.query("BEGIN");
    let deleted;
    let removed;
    let staleAdmins;
    let swept;
    try {
      deleted = await deleteTempUsers(client);
      // Removing before writing is what makes the demo accounts idempotent *and* what makes
      // DEMO_AUTH unset a real switch: the rows are gone, not merely not-created.
      removed = await removeDemoAccounts(client);
      // An admin whose password changed is removed here — committed before the phase-2 sign-up —
      // so the recreate below is a sign-up against an absent user, never a USER_ALREADY_EXISTS.
      staleAdmins = await removeStaleAdmins(client, admin.accounts);
      // #865 — converge the relationship subtree: everything the source does not describe goes,
      // children first (`relationship_payment`'s FK has no cascade), and the counts are reported.
      const drift = await inspectDrift(client, { bundleRelationshipIds });
      const counts = await removeStrays(client, {
        relationshipIds: drift.strays,
        sessionRecordIds: drift.sessionRecordIds,
      });
      swept = { strays: drift.strays, counts };
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
          ? `${removed.credentials} credential row(s), ${removed.authUsers} auth user(s), ${removed.profiles} profile row(s), ${removed.unbound} party binding(s), ${removed.unowned} relationship account column(s), ${removed.subscriptions} subscription row(s), ${removed.members} membership row(s), ${removed.coachInvites} coach invite(s) removed before re-seeding`
          : `${removed.credentials} credential row(s) removed, none created (DEMO_AUTH is not 1)`
      }`,
    );
    console.log(sweepLine({ ...swept, source }));

    /* Phase 2 — the rows. One transaction, so a seed that fails halfway leaves the previous
     * rows and never half-copies an instance. `phaseTwoOpen` and `demoAccountsCreated` are what
     * make the failure honest (#865): the accounts are real auth users created over HTTP *before*
     * this transaction commits, so a rollback below must say so instead of leaving the line
     * `demo accounts created: 3` sitting above a transaction that was thrown away. */
    await client.query("BEGIN");
    phaseTwoOpen = true;

    for (const template of assessments) await seedTemplate(client, template);
    /* #962 — the versions, so a green `published` badge is a template a relationship can be
     * created from. Every record the fixture marks published gets version 1, and a template a
     * seeded relationship is bound to gets one whatever its status, because
     * `relationship.template_version_id` is NOT NULL. Written here, before the relationships
     * themselves, because the relationship names the row. */
    const relationshipTemplates = new Set(
      assessmentInstances.map((instance) => instance.templateId),
    );
    let seededVersions = 0;
    for (const template of assessments) {
      const needsVersion = relationshipTemplates.has(template.id);
      if (template.status !== "published" && !needsVersion) continue;
      seededVersions += await publishTemplateVersion(
        client,
        template,
        needsVersion && template.status !== "published"
          ? `template "${template.slug}" is ${template.status} in the fixture and still published a v1 — a seeded relationship is bound to it, and the column is NOT NULL`
          : undefined,
      );
    }
    for (const instance of assessmentInstances) {
      await seedInstance(client, instance, lifecycles.get(instance.id));
    }
    // #289 — the plan rows, from the same fixture a pricing surface renders. Seeded here and not
    // in the migration: a migration is DDL and cannot import the fixture, and a price typed into
    // SQL would be a second copy of the number the page renders.
    await syncBillingPlans(client, billingFixtures);
    // #667 — the review catalogue. After the content rows because nothing here references them; the
    // todos and issues under an artifact are written by people at runtime and are never seeded.
    const reviewArtifactCount = await syncReviewArtifacts(client);

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
      demoAccountsCreated = accounts.length;
      const bound = await bindDemoParties(client, accounts);
      // #coach — the two bound parties become relationship members, so the relationship they
      // answer is the one they can see. A coach is never added here: a coach is invited.
      await syncRelationshipMembers(client);
      // #1079 — the subscription an `active` relationship is read against, written after the
      // accounts exist and after `billing_plan` (phase 1) so the tier resolves.
      const subscriptions = await seedDemoSubscriptions(client, accounts, assessmentInstances);
      /* #1081 — the console's own half: the audit log, the support inbox, the one broadcast, the
       * comp and the charge `/admin/billing` draws, and the review shelf's issues and to-dos. Every
       * id it writes is drawn from the rows above — the operator's own account, the relationships
       * this run just wrote, the newest artifact the catalogue seeded — so an admin list cannot
       * link to a record that does not exist. Gated on `demo`, like the accounts themselves:
       * production's seed writes no synthetic console row. The refusals and the fixture clock are
       * `scripts/db-seed-admin-surfaces.mjs`'s. */
      const operator = accounts.find((account) => account.role === "admin");
      if (operator === undefined) {
        throw new Error(
          "the admin half needs the demo operator (an account at role 'admin'), and this run created none",
        );
      }
      const { DEMO_NOW_ISO } = await import("../content/core.ts");
      const adminHalf = await seedAdminSurfaces(client, {
        actorUserId: operator.userId,
        nowIso: DEMO_NOW_ISO,
      });
      console.log(
        `  · demo accounts created: ${accounts.length} (${accounts.map((account) => `${account.email}=${account.role}`).join(", ")}) — in phase 2, committed only at the end of it`,
      );
      for (const party of bound) {
        console.log(`  · ${party.email} is ${party.partyName} — ${party.instance}/${party.role}`);
      }
      // #975 — the invitation surface had no reachable address because the token was a hash nobody
      // could reconstruct. It is derived here (`demoInviteToken`), so the seed can hand the link
      // over: the demo's own `/invite/<token>`, for the relationships the demo accounts answer.
      for (const party of bound) {
        if (party.role !== "counterparty") continue;
        console.log(
          `  · invitation: /invite/${demoInviteToken(party.instance)} — ${party.partyName} (claimed)`,
        );
      }
      for (const subscription of subscriptions) {
        console.log(
          `  · subscription: ${subscription.email} on the ${subscription.plan} tier (active) — an \`active\` relationship reads entitled rather than lapsed`,
        );
      }
      // #1081 — what the console half wrote, in the tables its screens read. This is the line an
      // operator checks against `data/verify/demo-expectations.json`; the numbers are the plan's
      // (`ADMIN_SURFACE_ROWS`), not a second copy typed here.
      console.log(
        `  · admin half: ${Object.entries(adminHalf.counts)
          .map(([table, count]) => `${table} ${count}`)
          .join(", ")}`,
      );
      console.log(
        `  · admin half anchors: comp ${adminHalf.subjects.grantedRelationship}, charge ${adminHalf.subjects.paidRelationship}, review ${adminHalf.subjects.artifact}`,
      );
    }

    // The admin seats — durable, independent of DEMO_AUTH. Runs in phase 2 (with the other
    // writes) after phase 1 committed any stale-admin removals.
    const adminSeats = await seedAdminAccounts(client, admin, staleAdmins);

    // The allowlist, enforced after the accounts exist — the seed half of
    // `lib/auth/admin-allowlist.ts`, which can only promote on a *sign-in*. Without this a branch
    // whose accounts were just created has zero admins until each address happens to sign in,
    // which is how a local server and a fresh demo ended up with no operator at all.
    const allowlist = await reconcileAllowlistedAdmins(client, { mode: "apply" });
    if (allowlist.counts.total > 0) {
      console.log(
        `  ○ allowlist: ${allowlist.counts.total} address(es) on ADMIN_EMAILS — ${allowlist.counts.admin} already admin, ${allowlist.counts.changed} created or promoted, ${allowlist.counts.pending} pending first sign-in`,
      );
      for (const row of allowlist.rows) {
        if (row.status === "pending" || row.status.startsWith("failed")) {
          const mark = row.status.startsWith("failed") ? "!" : "·";
          console.log(`  ${mark} allowlist: ${row.email} ${row.status}`);
        }
      }
    }

    const actual = await counts(client);
    // #865 — the assertion is unchanged, and it is shared with `tests/db-seed-sweep.test.ts` so a
    // later change cannot quietly relax it: the sweep is what makes it affordable, not an excuse
    // to stop asking.
    for (const [table, count] of Object.entries(expected)) {
      assertExactCount({ table, expected: count, actual: actual[table], source });
    }

    // The demo rows are asserted the same way the content rows are: three credentials, one
    // admin, every seat the two demo people hold (#1079 — the dataset names them in several
    // relationships, so the count is derived from the fixtures rather than fixed at two), and the
    // dataset the file describes.
    const report = await demoReport(client);
    const demoSeatNames = new Set(DEMO_ACCOUNTS.map((account) => account.name));
    const demoSeats = assessmentInstances.reduce((total, instance) => {
      const lifecycle = lifecycles.get(instance.id);
      return (
        total +
        instance.parties.filter(
          (party) =>
            demoSeatNames.has(party.name) &&
            (lifecycle.seats === "both" || party.role === "initiator"),
        ).length
      );
    }, 0);
    const demoExpected = demo
      ? { accounts: 3, admins: 1, demo_members: 2, bound_parties: demoSeats }
      : { accounts: 0, admins: 0, demo_members: 0, bound_parties: 0 };
    for (const [key, count] of Object.entries(demoExpected)) {
      if (report.totals[key] !== count) {
        throw new Error(
          `demo ${key}: expected ${count} row(s) with DEMO_AUTH=${demo ? "1" : "unset"}, found ${report.totals[key]}`,
        );
      }
    }
    // Each configured seat carries `role = 'admin'`, read back by the id the pass just wrote —
    // not by a count over every admin profile, because an admin somebody granted by hand is not
    // this seed's business and must neither fail the run nor pass for one of its seats.
    if (adminSeats.length > 0) {
      const { rows: seatProfiles } = await client.query(
        "SELECT user_id, role FROM user_profile WHERE user_id = ANY($1::text[])",
        [adminSeats.map((seat) => seat.userId)],
      );
      const notAdmin = seatProfiles.filter((row) => row.role !== "admin").length;
      if (seatProfiles.length !== adminSeats.length || notAdmin > 0) {
        throw new Error(
          `platform admins: ${adminSeats.length} seat(s) from ADMIN_*, but ${seatProfiles.length} profile row(s) exist and ${notAdmin} of them are not 'admin'`,
        );
      }
    }

    await client.query("COMMIT");
    phaseTwoOpen = false;

    console.log("\n  seeded counts (identical on every run):");
    for (const [table, count] of Object.entries(actual)) {
      console.log(`    ${table.padEnd(20)} ${count}`);
    }
    console.log(`    ${"demo_account".padEnd(20)} ${report.totals.accounts}`);
    console.log(`    ${"template_version (new)".padEnd(20)} ${seededVersions}`);
    console.log(`    ${"review artifact".padEnd(20)} ${reviewArtifactCount}`);
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
    // Only phase 2 has anything to roll back here; phase 1's own catch already did it, and a
    // ROLLBACK issued outside a transaction is a warning the operator does not need.
    if (phaseTwoOpen) {
      await client.query("ROLLBACK").catch(() => {});
      phaseTwoOpen = false;
      throw new Error(`${error.message}\n${rolledBackNotice(demoAccountsCreated)}`);
    }
    throw error;
  } finally {
    // Both the normal path and every failure path release here; a process that is *killed* never
    // reaches it, and the backend drops a session-level lock when the connection dies — which is
    // what makes a crash unable to wedge the branch (measured: SIGKILL a seed, the next one runs).
    await releaseSeedLock(client);
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:seed failed: ${error.message}`);
  process.exitCode = 1;
});
