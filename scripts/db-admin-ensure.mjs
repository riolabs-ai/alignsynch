/**
 * `pnpm admin:ensure` — make every address on `ADMIN_EMAILS` an `admin` wherever an account exists.
 *
 * Run against whatever the environment points at, so the same command covers local, demo and
 * production:
 *
 *     pnpm admin:ensure              # .env.local (demo, the branch a local server reads)
 *     pnpm admin:ensure --prod       # .env        (production)
 *
 * It prints one line per address and a count line, and it exits 1 only on a hard failure (a
 * database error, or a handle collision that stopped a grant) — a `pending` address is not a
 * failure, it is an account that does not exist yet.
 *
 * **Why this exists beside `lib/auth/admin-allowlist.ts`.** That module promotes on sign-in. This
 * one is the seed half: the role has to be true before anyone signs in, or a fresh demo branch (and
 * a local server reading it) has no admin at all — which is exactly the state this was written in.
 * The rule itself is imported, not copied, so the two cannot drift.
 */
import { Client } from "pg";
import { loadEnv, writeDatabaseUrl } from "./load-env.mjs";
import { reconcileAllowlistedAdmins } from "./db-admin-allowlist.mjs";

async function main() {
  // `--prod` reads `.env` alone (production, and the file wins over `.env.local` which is demo), so
  // the same command can never seed the wrong branch by forgetting a flag's worth of precedence.
  const production = process.argv.includes("--prod");
  loadEnv(production ? { files: [".env"], override: true } : {});

  const target = production ? "production (.env)" : "demo/local (.env.local)";
  const connectionString = writeDatabaseUrl();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows, counts } = await reconcileAllowlistedAdmins(client, { mode: "apply" });

    if (counts.total === 0) {
      console.log("○ admin:ensure — ADMIN_EMAILS is unset, so there is no allowlist to enforce");
      return;
    }
    console.log(`admin:ensure — ${counts.total} address(es) on ADMIN_EMAILS, target ${target}`);
    for (const row of rows) {
      const mark = row.status === "admin" ? "✓" : row.status.startsWith("failed") ? "✗" : "·";
      console.log(`  ${mark} ${row.email.padEnd(32)} ${row.status}`);
    }
    console.log(
      `  ${counts.admin} already admin, ${counts.changed} created or promoted, ${counts.pending} pending first sign-in, ${counts.failed} failed`,
    );
    if (counts.pending > 0) {
      console.log(
        "  · a pending address has no account on this branch yet: the allowlist promotes it on first sign-in,",
      );
      console.log(
        "    and ADMIN_NN_EMAIL / ADMIN_NN_PASS is how a durable seat is seeded now (`pnpm db:seed`)",
      );
    }
    if (counts.failed > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ admin:ensure failed: ${error.message}`);
  process.exitCode = 1;
});
