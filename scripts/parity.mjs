#!/usr/bin/env node
/**
 * `pnpm parity` — the brand-parity gate, once per brand, over hashes instead of HTML (#171).
 *
 * A brand is a build constant (`data/brand.ts` resolves `process.env.BRAND` once at import, the
 * same way `next.config.mjs` inlines it), so the two brands cannot share a module registry: each
 * gets its own vitest process, and this script is what runs them in order, merges what they
 * computed and reports both.
 *
 *   pnpm parity                         compare both brands against tests/parity/manifest.txt
 *   pnpm parity:update --reason "…"     rewrite the manifest and the summaries — see README.md
 *
 * ## Why this script owns the manifest
 *
 * Each vitest process can only speak for its own brand, and both would otherwise write the same
 * file. So a process writes a **fragment** (`tests/parity/artifacts/manifest.<brand>.txt`, inside
 * the gitignored artifact dir) and this script merges the fragments into the one committed file
 * after both legs have reported. A leg that failed leaves no fragment — the merge refuses rather
 * than shipping half a manifest that happens to look green next time.
 *
 * ## The reason, and why it is an argument
 *
 * `--update` is the only way to change a hash, and a hash change is a review event: the PR says
 * which routes moved and why. Requiring the sentence here (`--reason`, or `PARITY_REASON`) makes
 * the cheapest path through a red parity step the honest one, and the script prints it back so the
 * line in the PR is the line that was used.
 *
 * ## `TZ=UTC`, and the clock
 *
 * `TZ=UTC` is not cosmetic: `content/core.ts` formats with an explicit `timeZone: "UTC"`, but
 * anything that falls back to the host zone would render differently on a developer's machine and
 * on a UTC runner, and a hash that only matches on one box is a coin-flip gate. The render clock is
 * frozen separately, inside the suite (`harness.ts::freezeClock`), at `DEMO_NOW_ISO`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VITEST = join(ROOT, "node_modules", "vitest", "vitest.mjs");
const PARITY = join(ROOT, "tests", "parity");
const MANIFEST = join(PARITY, "manifest.txt");
/** Where a failed render's full HTML lands; gitignored, uploaded by CI on failure. */
const ARTIFACTS = process.env.PARITY_ARTIFACT_DIR ?? join(PARITY, "artifacts");
const BRANDS = ["quizhub", "alignsynch"];
/** Short enough to be a word, long enough not to be "fix". */
const MIN_REASON = 15;

const ARGS = process.argv.slice(2);
const UPDATE = ARGS.includes("--update");

/** `--reason "…"`, `--reason=…`, or `PARITY_REASON` — one sentence, required for `--update`. */
function statedReason() {
  const index = ARGS.indexOf("--reason");
  if (index >= 0) return (ARGS[index + 1] ?? "").trim();
  const inline = ARGS.find((arg) => arg.startsWith("--reason="));
  if (inline !== undefined) return inline.slice("--reason=".length).trim();
  return (process.env.PARITY_REASON ?? "").trim();
}

/** `route | brand | sha256` lines of a manifest file, or [] when it does not exist yet. */
function manifestLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

function split(line) {
  const [route, brand, sha] = line.split("|").map((part) => part.trim());
  return route === undefined || brand === undefined || sha === undefined
    ? undefined
    : { route, brand, sha };
}

const HEADER = [
  "# tests/parity/manifest.txt — generated; do not edit by hand (#171).",
  "#",
  "# One line per route per brand: route | brand | sha256 of the normalised render",
  "# (tests/parity/harness.ts). `pnpm parity` recomputes every line and fails on any difference;",
  '# `pnpm parity:update --reason "…"` rewrites them, prints which routes moved, and the PR that',
  "# carries it says which routes moved and why. tests/parity/summaries/ is the reviewer-facing",
  "# half of the same render; the full HTML is only ever written to tests/parity/artifacts/.",
  "#",
  "# route | brand | sha256",
].join("\n");

if (UPDATE) {
  const reason = statedReason();
  if (reason.length < MIN_REASON) {
    process.stderr.write(
      "\n✗ parity:update needs a stated reason — it is the sentence the PR has to carry.\n\n" +
        '    pnpm parity:update --reason "branded header copy changed on /news"\n' +
        "    PARITY_REASON='…' pnpm parity:update\n\n" +
        "If you cannot say which routes moved and why, the change is not intended yet: find out\n" +
        "what moved it first, rather than rewriting the detector.\n",
    );
    process.exit(2);
  }
}

// A stale fragment from a previous run must never be merged, and a red run's artifacts should
// describe *this* render, not an older one.
rmSync(ARTIFACTS, { recursive: true, force: true });
mkdirSync(ARTIFACTS, { recursive: true });

const results = [];

for (const brand of BRANDS) {
  const started = Date.now();
  process.stdout.write(
    `\n${UPDATE ? "updating" : "parity"}: BRAND=${brand} (${BRANDS.indexOf(brand) + 1}/${BRANDS.length})\n`,
  );
  // `--config vitest.parity.mts`, not the shared `vitest.config.mts`: this is the only suite that
  // renders pages, so it is the only one that needs `next/headers` answered (there is no request
  // in a node render). The file is `*.check.ts`, so `pnpm test` never collects it.
  const run = spawnSync(process.execPath, [VITEST, "run", "--config", "vitest.parity.mts"], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      // `BRAND` is what `data/brand.ts` reads; `PARITY_BRAND` is what the test believes it is.
      // Setting both from one variable is what makes "this run is the brand it claims" true.
      BRAND: brand,
      PARITY_BRAND: brand,
      PARITY_UPDATE: UPDATE ? "1" : "",
      PARITY_ARTIFACT_DIR: ARTIFACTS,
      // `TZ` and the locale are both pinned because both reach the render. `content/core.ts`
      // formats with an explicit `timeZone: "UTC"`, but the pages also call bare
      // `toLocaleString()` on counts, which reads the *default* locale: on a box with
      // `LANG=de_DE.UTF-8` the same fixture renders `1.234.567`, on a runner with no `LANG` the
      // resolved locale is `und`, and on a developer's `en_US` it is `en-US`. A hash that only
      // matches on one of those is a coin-flip gate, so the suite is given the same locale
      // everywhere instead of inheriting one.
      TZ: "UTC",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
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

if (failed.length > 0) {
  process.stderr.write(
    `\n✗ parity failed for ${failed.map((result) => result.brand).join(", ")} — a rendered route no longer ` +
      `matches the manifest. The failure above names the route and brand; the render it produced is in ` +
      `${ARTIFACTS}/<brand>/. If the change is intended, run \`pnpm parity:update --reason "…"\` and say in ` +
      "the PR which routes moved and why.\n",
  );
  process.exit(1);
}

if (!UPDATE) {
  process.stdout.write("\n✓ parity: both brands match the manifest and their summaries\n");
  process.exit(0);
}

// --- update: merge the fragments, one line per route per brand ------------------------------
const fragments = new Map();
for (const brand of BRANDS) {
  const file = join(ARTIFACTS, `manifest.${brand}.txt`);
  if (!existsSync(file)) {
    process.stderr.write(
      `\n✗ parity:update: ${brand} produced no manifest fragment (${file}) — the manifest was not rewritten.\n`,
    );
    process.exit(1);
  }
  const entries = manifestLines(file)
    .map(split)
    .filter((entry) => entry !== undefined);
  fragments.set(brand, new Map(entries.map((entry) => [entry.route, entry.sha])));
}

// Route order comes from the first brand's fragment (it is `routes.ts` order), so a new route
// lands at the end of the block it belongs to instead of wherever a hash sorts.
const routeOrder = [];
for (const brand of BRANDS) {
  for (const route of fragments.get(brand).keys())
    if (!routeOrder.includes(route)) routeOrder.push(route);
}

const before = new Map();
for (const line of manifestLines(MANIFEST)) {
  const entry = split(line);
  if (entry !== undefined) before.set(`${entry.route}\u0000${entry.brand}`, entry.sha);
}

const merged = [];
const mergedKeys = new Set();
const moved = [];
for (const route of routeOrder) {
  for (const brand of BRANDS) {
    const sha = fragments.get(brand).get(route);
    if (sha === undefined) continue;
    merged.push(`${route} | ${brand} | ${sha}`);
    const key = `${route}\u0000${brand}`;
    mergedKeys.add(key);
    const previous = before.get(key);
    if (previous === undefined)
      moved.push(`  added    ${brand.padEnd(10)} ${route}  ${sha.slice(0, 12)}`);
    else if (previous !== sha)
      moved.push(
        `  changed  ${brand.padEnd(10)} ${route}  ${previous.slice(0, 12)} → ${sha.slice(0, 12)}`,
      );
  }
}
for (const [key, sha] of before) {
  if (mergedKeys.has(key)) continue;
  const [route, brand] = key.split("\u0000");
  moved.push(`  removed  ${brand.padEnd(10)} ${route}  was ${sha.slice(0, 12)}`);
}

writeFileSync(MANIFEST, `${HEADER}\n${merged.join("\n")}\n`, "utf8");

process.stdout.write(
  moved.length === 0
    ? "\nmanifest: no hash moved (summaries rewritten)\n"
    : `\nmanifest rewritten — put this in the PR:\n${moved.join("\n")}\n\n  reason: ${statedReason()}\n`,
);
process.stdout.write(
  `\n✓ parity:update: ${merged.length} route/brand pairs in tests/parity/manifest.txt, summaries in tests/parity/summaries/\n` +
    `  state the reason in the PR: ${statedReason()}\n`,
);
