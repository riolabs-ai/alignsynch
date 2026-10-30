/**
 * `.env.local` → `process.env`, for the node scripts (#145).
 *
 * Next loads `.env*` itself; a plain `node scripts/x.mjs` does not. The file is gitignored and
 * is written by `neon env pull`, so this reader is the only thing that has to know its shape —
 * it is deliberately not a dotenv: no expansion, no `export` keywords, no quoting rules beyond
 * the two quote characters. A value is taken literally, which is what a connection string and a
 * signing secret need.
 *
 * Nothing here prints a value. A missing variable is reported by name only.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root — every path in a `db:*` script is relative to this. */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseEnv(text) {
  const entries = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!KEY.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    entries.set(key, value);
  }
  return entries;
}

/**
 * Loads `.env.local` then `.env`, in that order. An already-set variable wins unless
 * `override` is true, so `DATABASE_URL=… pnpm db:migrate` tests one branch without editing the
 * file.
 */
export function loadEnv({ files = [".env.local", ".env"], override = false } = {}) {
  const loaded = [];
  for (const file of files) {
    const path = join(repoRoot, file);
    if (!existsSync(path)) continue;
    for (const [key, value] of parseEnv(readFileSync(path, "utf8"))) {
      const current = process.env[key];
      if (!override && current !== undefined && current !== "") continue;
      process.env[key] = value;
    }
    loaded.push(file);
  }
  return loaded;
}

/** The first of these variables that is set and non-empty; otherwise a named error. */
export function requireVariable(names) {
  for (const name of [names].flat()) {
    const value = process.env[name]?.trim();
    if (value !== undefined && value !== "") return value;
  }
  throw new Error(
    `${[names].flat().join(" / ")} is not set — run \`neon env pull\` in the repo root, or export it`,
  );
}

/**
 * The connection string for a write path.
 *
 * `db:migrate` and `db:seed` want the **unpooled** (direct) URL: a migration is a transaction
 * over DDL and a seed wants plain `INSERT … ON CONFLICT`, neither of which belongs behind a
 * transaction-mode pooler. The runtime pool uses the pooled one.
 */
export function writeDatabaseUrl() {
  return requireVariable(["DATABASE_URL_UNPOOLED", "DATABASE_URL"]);
}
