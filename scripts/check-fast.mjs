#!/usr/bin/env node
/**
 * `pnpm check:fast` — the inner loop for a UI/React cohort.
 *
 * The full gate is 176 s, and 108 s of that is `next build`. That is the right price to pay once,
 * at a cohort boundary, before a push. It is the wrong price to pay between two edits to a
 * component, and paying it there is what makes an hour of UI work feel like a day.
 *
 * What this runs, and why each earns its place:
 *
 *   typecheck   `next typegen && tsc --noEmit` — hot reload lies about types, and a broken import
 *               surfaces as a blank screen rather than an error. ~7 s warm.
 *   data:check  the E-tests, including E10 (dead href and asset literals), E21 (pasted fixtures),
 *               E34 (a client module reaching `lib/db`) and E36 (surface registry). E34 is the one
 *               that catches a 500 that `next build` happily ships. ~15 s.
 *   vitest      only the tests that import a module you changed — found by import path, not by
 *               filename convention, because the convention here is loose.
 *
 * What it deliberately does NOT run: `next build`, the full suite, parity. Those belong at the
 * boundary (`bash scripts/verify.sh`), and the pre-push hook runs the gate for you when you push
 * the cohort.
 *
 * It is not a replacement for looking at the page. For a UI change the screenshot is the gate that
 * catches what none of this can: a design that satisfies every string assertion and still renders
 * six identical boxes.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BASE = process.env.CHECK_FAST_BASE ?? "origin/main";

/** Run a command in the repo root, streaming nothing unless it fails. */
function run(label, command, args) {
  const started = Date.now();
  try {
    execFileSync(command, args, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`  ✓ ${label} ${seconds}s`);
    return true;
  } catch (error) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`  ✗ ${label} ${seconds}s`);
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    if (output !== "") console.log(output.split("\n").slice(-40).join("\n"));
    return false;
  }
}

/** Every path this branch touches: committed against the base, plus anything not yet committed. */
function changedFiles() {
  const paths = new Set();
  const add = (output) => {
    for (const line of output.split("\n")) {
      const path = line.trim();
      if (path !== "") paths.add(path);
    }
  };
  try {
    add(
      execFileSync("git", ["diff", "--name-only", `${BASE}...HEAD`], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
  } catch {
    console.log(`  ! could not diff against ${BASE} — is the remote fetched?`);
  }
  try {
    add(
      execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).replace(
        /^.../gm,
        "",
      ),
    );
  } catch {
    /* a status failure is not worth failing the check over */
  }
  return [...paths].filter((path) => !path.startsWith("tests/parity/"));
}

/** Every test file in the tree, so a changed module can be traced to the tests that import it. */
function testFiles() {
  const found = [];
  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry);
      if (entry === "node_modules" || entry === ".git" || entry.startsWith(".")) continue;
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (/\.test\.(ts|tsx|mts)$/.test(entry)) found.push(path);
    }
  };
  walk(join(ROOT, "tests"));
  walk(join(ROOT, "scripts", "__tests__"));
  return found;
}

/** The module specifiers a changed file would be imported by. */
function specifiersOf(path) {
  const withoutExtension = path.replace(/\.(tsx|ts|mts|jsx|js)$/, "");
  const basename = withoutExtension.split("/").pop() ?? "";
  const specifiers = new Set([`@/${withoutExtension}`]);
  // A short import (`@/components/ui/button`) and a suffixed one (`…/button.tsx`) both appear here.
  if (basename !== "") specifiers.add(basename);
  return [...specifiers].filter((specifier) => specifier.length > 3);
}

/** Tests whose source mentions any changed module — the import-path signal, not the filename. */
function relatedTests(changed) {
  const specifiers = changed.flatMap(specifiersOf);
  if (specifiers.length === 0) return [];
  const matches = [];
  for (const path of testFiles()) {
    const source = readFileSync(path, "utf8");
    if (specifiers.some((specifier) => source.includes(specifier))) {
      matches.push(relative(ROOT, path));
    }
  }
  return matches;
}

const changed = changedFiles();
console.log(`\ncheck:fast — ${changed.length} changed file(s) against ${BASE}\n`);

let failed = false;
if (!run("typecheck", "pnpm", ["exec", "next", "typegen"])) failed = true;
if (!run("tsc", "node", ["scripts/build-cache.mjs", "tsc"])) failed = true;
if (!run("data:check", "pnpm", ["run", "data:check"])) failed = true;

const tests = relatedTests(changed);
if (tests.length === 0) {
  console.log("  ○ tests — no test imports a changed module (the full suite runs at the boundary)");
} else if (!run(`tests (${tests.length} file(s))`, "pnpm", ["exec", "vitest", "run", ...tests])) {
  failed = true;
}

console.log(
  failed
    ? "\n✗ check:fast — fix the step above. A cohort cannot be pushed until it is clean.\n"
    : "\n✓ check:fast — now look at the page. Screenshot the change before you trust it.\n",
);
process.exit(failed ? 1 : 0);
