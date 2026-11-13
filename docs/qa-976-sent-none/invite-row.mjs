/**
 * #976 — put one `session_invite` row aside and put it back, verbatim.
 *
 *   node q976-invite-row.mjs save  <instanceId> <file>   # dump the row (JSON), then delete it
 *   node q976-invite-row.mjs restore <file>              # re-insert the dumped row
 *   node q976-invite-row.mjs show <instanceId>           # count + the row, for the record
 *
 * The state this card fixes is a relationship whose invitation was never written, and the demo
 * branch carries no such instance: every seeded one has its row. The row is removed for the
 * length of one capture and restored with every column it had — same primary key, same token
 * hash, same `claimed_at` — so the branch is back where it started.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { Client } = require("pg");

const env = {};
for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const [mode, first, second] = process.argv.slice(2);
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

if (mode === "save") {
  const found = await db.query("select * from session_invite where session_record_id = $1", [
    first,
  ]);
  if (found.rows.length !== 1)
    throw new Error(`expected 1 row for ${first}, found ${String(found.rows.length)}`);
  writeFileSync(second, `${JSON.stringify(found.rows, null, 2)}\n`);
  await db.query("delete from session_invite where session_record_id = $1", [first]);
  const after = await db.query(
    "select count(*)::int as n from session_invite where session_record_id = $1",
    [first],
  );
  console.log(JSON.stringify({ saved: second, rowsAfterDelete: after.rows[0].n }));
} else if (mode === "restore") {
  const rows = JSON.parse(readFileSync(first, "utf8"));
  for (const row of rows) {
    const keys = Object.keys(row);
    const columns = keys.map((key) => `"${key}"`).join(", ");
    const placeholders = keys.map((_, index) => `$${String(index + 1)}`).join(", ");
    await db.query(
      `insert into session_invite (${columns}) values (${placeholders}) on conflict (session_record_id) do nothing`,
      keys.map((key) => row[key]),
    );
  }
  const back = await db.query(
    "select count(*)::int as n from session_invite where session_record_id = $1",
    [rows[0].session_record_id],
  );
  console.log(JSON.stringify({ restored: rows[0].session_record_id, rows: back.rows[0].n }));
} else if (mode === "show") {
  const found = await db.query("select * from session_invite where session_record_id = $1", [
    first,
  ]);
  console.log(JSON.stringify(found.rows, null, 2));
} else {
  throw new Error("usage: save <instanceId> <file> | restore <file> | show <instanceId>");
}

await db.end();
