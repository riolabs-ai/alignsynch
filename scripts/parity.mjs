#!/usr/bin/env node
/**
 * `pnpm parity` — the brand-parity snapshot, once per brand.
 *
 * A brand is a build constant (`data/brand.ts` resolves `process.env.BRAND` once at import, the
 * same way `next.config.mjs` inlines it), so the two brands cannot share a module registry: each
 * gets its own vitest process, and this script is what runs them in order and reports both.
 *
 *   pnpm parity               compare both brands against the committed snapshots
 *   pnpm parity:update        rewrite them — see tests/parity/README.md before you do
 *
 * It is a gate step (`scripts/verify.sh`) and a CI step for the same reason every other check is:
 * a check that only one of the two callers runs is a red push or a red CI run.
 *
 * `TZ=UTC` is not cosmetic. `content/core.ts` formats dates with an explicit `timeZone: "UTC"`,
 * but anything else that falls back to the host zone would render differently on a developer's
 * machine and on a UTC runner — a snapshot that only matches on one box is a coin-flip gate.
 *
 * In update mode the script prints what it rewrote, by comparing the snapshot tree's fingerprints
 * before and after: "which routes changed" is the sentence the PR has to carry, and it should not
 * depend on reading vitest's captured stdout.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VITEST = join(ROOT, "node_modules", "vitest", "vitest.mjs");
const SNAPSHOTS = join(ROOT, "tests", "parity", "snapshots");
const BRANDS = ["quizhub", "alignsynch"];
const UPDATE = process.argv.includes("--update");

/** `brand/file.html` -> sha256, for every committed snapshot. */
function fingerprints() {
  const map = new Map();
  if (!existsSync(SNAPSHOTS)) return map;
  for (const brand of readdirSync(SNAPSHOTS)) {
    const dir = join(SNAPSHOTS, brand);
    for (const file of readdirSync(dir)) {
      const sha = createHash("sha256")
        .update(readFileSync(join(dir, file)))
        .digest("hex");
      map.set(`${brand}/${file}`, sha);
    }
  }
  return map;
}

const before = UPDATE ? fingerprints() : new Map();
const results = [];

for (const brand of BRANDS) {
  const started = Date.now();
  process.stdout.write(
    `\n${UPDATE ? "updating" : "parity"}: BRAND=${brand} (${BRANDS.indexOf(brand) + 1}/${BRANDS.length})\n`,
  );
  const run = spawnSync(process.execPath, [VITEST, "run", "tests/parity/parity.test.ts"], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      // `BRAND` is what `data/brand.ts` reads; `PARITY_BRAND` is what the test believes it is.
      // Setting both from one variable is what makes "this run is the brand it claims" true.
      BRAND: brand,
      PARITY_BRAND: brand,
      PARITY_UPDATE: UPDATE ? "1" : "",
      TZ: "UTC",
    },
  });
  results.push({ brand, code: run.status ?? 1, ms: Date.now() - started });
}

const failed = results.filter((result) => result.code !== 0);

for (const result of results) {
  process.stdout.write(
    `${result.code === 0 ? "✓" : "✗"} parity ${result.brand.padEnd(10)} ${(result.ms / 1000).toFixed(1)}s\n`,
  );
}

if (UPDATE) {
  const after = fingerprints();
  const moved = [];
  for (const [file, sha] of after) {
    if (!before.has(file)) moved.push(`  added    ${file}`);
    else if (before.get(file) !== sha) moved.push(`  changed  ${file}`);
  }
  for (const file of before.keys()) {
    if (!after.has(file)) moved.push(`  removed  ${file}`);
  }
  process.stdout.write(
    moved.length === 0
      ? "\nsnapshots: none changed\n"
      : `\nsnapshots rewritten — say which routes moved and why in the PR:\n${moved.join("\n")}\n`,
  );
}

if (failed.length > 0) {
  process.stderr.write(
    `\n✗ parity failed for ${failed.map((result) => result.brand).join(", ")} — a rendered route no longer matches its snapshot. If the change is intended, run \`pnpm parity:update\` and say in the PR which routes moved and why.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `\n✓ parity: both brands match their snapshots${UPDATE ? " (snapshots rewritten)" : ""}\n`,
);
