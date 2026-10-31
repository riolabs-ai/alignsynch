#!/usr/bin/env node
/**
 * lint-brand-classes — the gate step that keeps the brand palette in one place (#187 stage 4).
 *
 * This is not a second lint pipeline: it runs *inside* `pnpm lint` (`biome check && node
 * scripts/lint-brand-classes.mjs`), so `bash scripts/verify.sh` runs it as its existing `lint`
 * step, and `next lint`/CI never grew a job. `scripts/brand-classes.mjs` holds the rule itself;
 * this file is the walk, the report and the rule's own self-test.
 *
 * Usage:
 *   node scripts/lint-brand-classes.mjs             # scan components/ and app/, exit 1 on a hit
 *   node scripts/lint-brand-classes.mjs <dir>…      # scan other roots (the self-test does this)
 *
 * Why a self-test runs on every invocation: a rule whose matcher silently stopped matching
 * reports a clean tree, which is worse than no rule at all — the gate would then be green on
 * a red tree and nobody would know. So before scanning anything it feeds the rule four
 * fixtures that must trip and four that must not, and fails loudly if either side is wrong.
 * It costs microseconds because it parses eight one-line files.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { formatViolation, scanSource } from "./brand-classes.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_ROOTS = ["components", "app"];
const SKIP = new Set(["node_modules", ".next", ".datacheck", ".git"]);

const MUST_FLAG = [
  ["x.tsx", 'export const a = <div className="bg-purple-600 p-2" />;'],
  // `${` is written in two pieces so no string *literal* here reads as an un-interpolated
  // template (biome's `noTemplateCurlyInString`); the fixture still holds it once joined, and
  // the hit lands in a template span, which is the case the rule has to read.
  ["x.ts", "const s = `flex text-indigo-500 " + String.fromCharCode(36) + "{label} items-center`;"],
  ["x.tsx", 'export const b = <i className={"bg-gradient-to-r from-a to-b"} />;'],
  ["x.ts", 'const c = "bg-[linear-gradient(red,blue)]";'],
];
const MUST_PASS = [
  ["x.tsx", 'export const d = <div className="bg-action text-action-foreground" />;'],
  ["x.tsx", 'export const e = <div className="bg-blue-500 border-amber-200" />;'],
  ["x.ts", "// bg-purple-600 was here once; the record owns the hue now."],
  ["x.ts", 'const f = "bg-action/10 hover:bg-action/90";'],
];

function selfTest() {
  const missed = MUST_FLAG.filter(([file, source]) => scanSource(file, source).length === 0);
  const falsePositives = MUST_PASS.filter(([file, source]) => scanSource(file, source).length > 0);
  if (missed.length > 0 || falsePositives.length > 0) {
    console.error("✗ brand classes: the rule's own self-test failed — do not trust this run.");
    for (const [file, source] of missed) console.error(`  missed a violation: ${file}  ${source}`);
    for (const [file, source] of falsePositives)
      console.error(`  false positive: ${file}  ${source}`);
    process.exit(2);
  }
  return `${MUST_FLAG.length} flagged / ${MUST_PASS.length} clean`;
}

/** Every `.ts`/`.tsx` under `dir`, depth-first, skipping build output. */
function* sources(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* sources(path);
    else if (/\.(?:ts|tsx)$/.test(entry)) yield path;
  }
}

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_ROOTS;
const selfTestReport = selfTest();

let files = 0;
const violations = [];
for (const root of roots) {
  for (const path of sources(join(ROOT, root))) {
    files++;
    const file = relative(ROOT, path);
    violations.push(...scanSource(file, readFileSync(path, "utf8")));
  }
}

console.log(
  `  brand classes: ${files} file(s) under ${roots.map((r) => `${r}/`).join(", ")} ` +
    `— palette steps (indigo/purple/violet) and bg-gradient-* utilities banned, no allowlist`,
);
console.log(`  rule self-test: ${selfTestReport}`);

if (violations.length > 0) {
  console.error("");
  for (const violation of violations) console.error(formatViolation(violation));
  console.error(
    `\n✗ brand classes: ${violations.length} violation(s). The palette has one home — ` +
      `data/brand.ts. Use bg-action / text-action / border-action (and their /opacity forms), ` +
      `or add a token to the record; do not exempt the line.`,
  );
  process.exit(1);
}

console.log(
  "  ✓ brand classes: 0 palette steps, 0 gradient utilities — the record is the only home",
);
