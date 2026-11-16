#!/usr/bin/env node
/**
 * scripts/routes-check.mjs — the route tree, judged by Next's own router.
 *
 * `next start` refuses to boot a build whose dynamic routes cannot be sorted. The refusal is
 * `sortDynamicRoutes()` in `next/dist/server/lib/router-utils/filesystem.js`, which calls
 * `getSortedRoutes()` over `.next/routes-manifest.json`'s `dynamicRoutes[].page` and throws on
 * two different dynamic segment names at one level — `/dashboard/templates/[id]` beside
 * `/dashboard/templates/[slug]/create` is the pair that cost a boot (#1113). `next build`
 * cannot see it: `validateAppPaths()` validates within a single route, so the tree compiles,
 * the gate goes green, and the first request to the deployment is a 500.
 *
 * This step is one function call on an artifact the build already wrote: the same function,
 * over the same input set, in ~0.3 ms. No server is started, no port is opened. It runs in
 * `scripts/verify.sh` immediately after `build (next build)`, in the code lane and nowhere
 * else, because a route-tree change is `app/**` and that is what the classifier calls the
 * code lane. `--manifest <path>` points the same check at a fixture, so a verdict costs no
 * build.
 *
 * The verdict is Next's, never this file's: `checkRoutes()` returns the thrown message
 * verbatim — the sentence `next start` prints — and only appends a hint after it. The rule is
 * not re-implemented here on purpose: route groups and interception routes make a hand-rolled
 * segment walker wrong in both directions, since `/(a)/x/[id]` beside `/(b)/x/[slug]` is
 * legal to Next and would read as a conflict to a walker.
 *
 * Usage:
 *   node scripts/routes-check.mjs                     # .next/routes-manifest.json
 *   node scripts/routes-check.mjs --manifest f.json   # a fixture, no build needed
 *
 * Exit: 0 = every dynamic route sorts; 1 = they do not, or the manifest could not be read.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = resolve(ROOT, ".next", "routes-manifest.json");

// Next's own copy, resolved from this file so the repo's `node_modules/next` is the one that
// judges — the version a build just ran under, not a second one installed somewhere above.
const require = createRequire(import.meta.url);
const { getSortedRoutes } = require("next/dist/shared/lib/router/utils/sorted-routes");

/**
 * Run Next's router validation over a path list.
 *
 * Pure: no `fs`, no process, no build. The CLI below is a thin wrapper over it so the tests
 * exercise the verdict itself rather than a subprocess.
 *
 * @param {readonly string[]} pages route paths as the manifest spells them, groups included
 * @returns {{ ok: true } | { ok: false, message: string, hint: string | null }}
 */
export function checkRoutes(pages) {
  try {
    getSortedRoutes(pages);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      hint: conflictHint(pages),
    };
  }
}

/**
 * The unique `dynamicRoutes[].page` values, in manifest order — exactly the set
 * `sortDynamicRoutes()` hands to `getSortedRoutes()`.
 *
 * @param {unknown} manifest the parsed routes manifest
 * @returns {string[]}
 */
export function pagesFromManifest(manifest) {
  const rows = Array.isArray(manifest?.dynamicRoutes) ? manifest.dynamicRoutes : [];
  const pages = rows.map((row) => (typeof row?.page === "string" ? row.page : null));
  return [...new Set(pages.filter((page) => page !== null))];
}

/**
 * Where the conflict is, for a reader who has to go and fix it. Only a hint: it names the
 * level and the two routes the first time two pages put different dynamic names at one
 * prefix, and it stays silent when it cannot see the pair (a catch-all, a duplicate slug in
 * one path) — the verdict upstream is still Next's.
 */
function conflictHint(pages) {
  const seen = new Map(); // "<prefix>" -> { name, page }
  for (const page of pages) {
    const segments = page.split("/").filter(Boolean);
    for (let index = 0; index < segments.length; index++) {
      const match = /^\[([^.[\]]+)\]$/.exec(segments[index]);
      if (!match) continue;
      const prefix = `/${segments.slice(0, index).join("/")}`;
      const earlier = seen.get(prefix);
      if (earlier && earlier.name !== match[1]) {
        return `hint: ${earlier.page} and ${page} both sit at ${prefix || "/"} with different dynamic segment names (${JSON.stringify(earlier.name)} and ${JSON.stringify(match[1])})`;
      }
      if (!earlier) seen.set(prefix, { name: match[1], page });
    }
  }
  return null;
}

function readManifest(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      error: `no routes manifest at ${path} (${reason}) — the build step writes it, so a missing manifest after a successful build is a defect, not a skip`,
    };
  }
  try {
    return { manifest: JSON.parse(text) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { error: `${path} is not JSON (${reason})` };
  }
}

function parseArgs(argv) {
  let manifest = DEFAULT_MANIFEST;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true, manifest };
    if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value) return { error: "--manifest needs a path" };
      manifest = resolve(process.cwd(), value);
      index++;
      continue;
    }
    return {
      error: `unknown argument ${JSON.stringify(arg)} — usage: routes-check.mjs [--manifest <path>]`,
    };
  }
  return { manifest };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("usage: routes-check.mjs [--manifest <path>]");
    return 0;
  }
  if (args.error) {
    console.error(`routes:check: ${args.error}`);
    return 1;
  }

  const read = readManifest(args.manifest);
  if (read.error) {
    console.error(`routes:check: ${read.error}`);
    return 1;
  }
  if (!Array.isArray(read.manifest?.dynamicRoutes)) {
    console.error(`routes:check: ${args.manifest} has no dynamicRoutes array`);
    return 1;
  }
  const pages = pagesFromManifest(read.manifest);
  if (pages.length === 0) {
    console.error(
      `routes:check: ${args.manifest} lists 0 dynamic routes — an empty manifest is a defect, not a clean pass`,
    );
    return 1;
  }

  const verdict = checkRoutes(pages);
  if (!verdict.ok) {
    console.error(`routes:check: ${verdict.message}`);
    if (verdict.hint) console.error(`  ${verdict.hint}`);
    return 1;
  }
  console.log(`routes:check: ${pages.length} dynamic routes, 0 conflicts`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
