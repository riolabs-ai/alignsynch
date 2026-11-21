#!/usr/bin/env node
/**
 * `pnpm demo:simulate-activity` — the **explicit** action that writes the feed's `simulate` rows.
 *
 * The activity feed has two writers and no third (`db/migrations/0044_activity_event.sql` says why):
 * `scripts/db-seed.mjs` writes the dataset's own timeline as `source = 'seed'`, and this command
 * plays a live one as `source = 'simulate'`. **Nothing schedules either of them.** Measured on this
 * tree: `vercel.json` carries no `crons` block, no route in the app is scheduled, and a Vercel cron
 * entry runs on production deployments only — while the demo is a branch deployment on the `demo`
 * ref, so a declared cron would fire against production. A person runs this; the demo runbook says
 * when.
 *
 * **It replaces, it does not accumulate.** Every press deletes `source = 'simulate'` and writes the
 * batch below, in one transaction, so pressing it twice leaves the same rows once instead of a
 * doubled timeline — the same shape the seed uses for its own source, and the reason the
 * `idempotency_key` UNIQUE constraint is a second guard rather than the only one.
 *
 * **What it writes.** One `answers.submitted` per seat of the `SIMULATE_MAX_RELATIONSHIPS` most
 * recently created relationships that are **live** (`published`, `active`, `complete`) — a sheet
 * cannot be filled in on a draft or one that lapsed, so writing that event would be a timeline of
 * something the product cannot do. Instants are `now` minus a minute per row, so the feed reads
 * newest-first; that is the one clock read in this path, which is why `pnpm demo:verify` bounds this
 * source rather than counting it.
 *
 *   pnpm demo:simulate-activity              # play the timeline
 *   pnpm demo:simulate-activity --dry-run    # print what it would write, change nothing
 *
 * Exit: 0 wrote (or dry-ran) · 1 could not run · 2 refused (production)
 */
import { Client } from "pg";
import { SIMULATE_MAX_EVENTS, simulateActivityEvents } from "../lib/activity/events.ts";
import { countActivityBySource, replaceSourceActivity } from "../lib/db/activity-events.ts";
import { loadEnv, writeDatabaseUrl } from "./load-env.mjs";
import { productionRefusal } from "./demo-verify-rules.mjs";

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes("--dry-run");

function refused(message) {
  console.error(`\n✗ demo:simulate-activity — refused.\n\n${message}\n`);
  process.exit(2);
}

/**
 * The seats a played timeline can name: one row per party on a session of a **live** relationship.
 *
 * Read in newest-relationship-first order because `simulateActivityEvents()` takes the first
 * `SIMULATE_MAX_RELATIONSHIPS` it has not seen — the demo's aim is the relationships a visitor just
 * looked at, not an arbitrary twelve.
 */
const SEAT_SQL = `
  SELECT r.id        AS "relationshipId",
         s.record_id AS "sessionRecordId",
         p.role      AS "partyRole",
         p.name      AS "partyName"
    FROM party p
    JOIN session s      ON s.record_id = p.session_record_id
    JOIN relationship r ON r.id = s.relationship_id
   WHERE r.status IN ('published', 'active', 'complete')
   ORDER BY r.created_at DESC, r.id, p.role`;

async function main() {
  const connectionUrls = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value !== "");

  // A demo writer pointed at production leaves simulated acts on real relationships. Always a
  // refusal, never a warning — the same rule and the same sentences `demo:verify` uses.
  const refusal = productionRefusal({
    databaseUrls: connectionUrls,
    neonBranch: process.env.NEON_BRANCH,
  });
  if (refusal !== null) refused(refusal);

  loadEnv();
  if (
    (process.env.DATABASE_URL ?? "").trim() === "" &&
    (process.env.DATABASE_URL_UNPOOLED ?? "").trim() === ""
  ) {
    console.error(
      [
        "",
        "✗ demo:simulate-activity — no connection string.",
        "",
        "This command writes rows, so it needs a branch: `neon env pull` in the repo root, or export",
        "the demo branch's DATABASE_URL.",
        "",
      ].join("\n"),
    );
    return 1;
  }

  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "demo:simulate-activity",
  });
  await client.connect();
  let committed = false;
  try {
    const { rows: seats } = await client.query(SEAT_SQL);
    const nowIso = new Date().toISOString();
    const events = simulateActivityEvents(seats, nowIso);
    const relationshipIds = [...new Set(events.map((event) => event.relationshipId))];

    console.log(
      `demo:simulate-activity — ${seats.length} seat(s) on ${new Set(seats.map((seat) => seat.relationship_id)).size} live relationship(s) · ${
        DRY_RUN ? "dry run, nothing will be written" : "writing"
      }`,
    );

    if (events.length === 0) {
      console.log(
        "  · no live relationship with a counterparty seat — nothing to simulate (a seeded demo branch has some; `pnpm db:seed` writes them)",
      );
    }

    if (DRY_RUN) {
      for (const event of events) {
        console.log(
          `  · would write ${event.occurredAt}  ${event.relationshipId}  ${event.summary}`,
        );
      }
      console.log(
        `\n✓ demo:simulate-activity — ${events.length} event(s) across ${relationshipIds.length} relationship(s), nothing written (ceiling ${SIMULATE_MAX_EVENTS})`,
      );
      return 0;
    }

    if (events.length > 0) {
      await client.query("BEGIN");
      const replaced = await replaceSourceActivity(client, "simulate", events);
      await client.query("COMMIT");
      committed = true;
      console.log(
        `  · simulate: ${replaced.written} row(s) written, ${replaced.removed} replaced — the previous press's timeline is gone, and a re-press writes the same rows once`,
      );
    }

    const counts = await countActivityBySource(client);
    console.log(
      `\n✓ demo:simulate-activity — source=seed ${counts.seed}, source=simulate ${counts.simulate} (ceiling ${SIMULATE_MAX_EVENTS} per run); invoked by a person, never by a scheduler`,
    );
    return 0;
  } catch (error) {
    if (!committed) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`\n✗ demo:simulate-activity failed: ${error.message}`);
    process.exitCode = 1;
  });
