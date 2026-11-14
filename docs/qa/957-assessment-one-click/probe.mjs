#!/usr/bin/env node
/**
 * A read-only probe of the demo branch: what is there before this card touches anything.
 *
 * Run through the profile's `withenv.sh` (never a bare shell — no secrets reach a spawned shell):
 *
 *   withenv.sh <main checkout> bash -c 'cd <worktree> && node24.sh node docs/qa-957-assessment-one-click/probe.mjs'
 */
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

console.log("demo_account:", JSON.stringify(await q("SELECT email FROM demo_account")));
console.log(
  "published templates:",
  JSON.stringify(
    await q(
      `SELECT id, slug, title FROM record
        WHERE record_type = 'assessment' AND status = 'published'
        ORDER BY title LIMIT 6`,
    ),
  ),
);

// Step 4 of the card: a relationship that is published with no plan and no captured payment is
// a row this bypass already wrote. Counted, never deleted.
console.log(
  "published relationships with plan NULL:",
  JSON.stringify(
    await q(
      `SELECT count(*)::int AS n FROM relationship WHERE status = 'published' AND plan IS NULL`,
    ),
  ),
);
console.log(
  "relationship statuses:",
  JSON.stringify(
    await q(
      `SELECT status, (plan IS NULL) AS plan_null, count(*)::int AS n
         FROM relationship GROUP BY 1, 2 ORDER BY 1, 2`,
    ),
  ),
);
console.log(
  "party rows:",
  JSON.stringify(await q("SELECT role, count(*)::int AS n FROM party GROUP BY 1 ORDER BY 1")),
);
console.log(
  "payment obligations:",
  JSON.stringify(
    await q(
      `SELECT (method_captured_at IS NOT NULL) AS method_captured, count(*)::int AS n
         FROM relationship_payment GROUP BY 1 ORDER BY 1`,
    ),
  ),
);
await client.end();
