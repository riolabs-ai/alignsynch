#!/usr/bin/env node
/**
 * noun-check — the retired noun is not in the code.
 *
 * `instance` was this product's word for **session** and it is retired: `scripts/vocabulary.ts`
 * (E41) already fails a *reader-visible* string that spells it, and `tests/terminology.test.ts`
 * holds the copy fixtures. Neither can see an identifier, a comment or a file name, because a
 * type name is not prose — so a `createInstanceFromTemplate` could come back the day after the
 * rename and every other check would stay green. This is the check at the layer identifiers live
 * in, and it is the ratchet #1103 phase 2 installed.
 *
 * ## What it reads
 *
 * Every `.ts`/`.tsx`/`.mjs`/`.js`/`.jsx`/`.sql` file under `app`, `components`, `lib`, `content`
 * and `scripts` — the five directories the noun lived in. `tests/` is deliberately outside: a test
 * names the behaviour it pins, and the assertions that must keep spelling a handle (a copy-item id,
 * an audit key) are written there. `data/` is outside too: it holds the fixture ids, the bundle
 * document and the copy a reader sees, and E41 + `terminology.test.ts` are its ratchets.
 *
 * ## A handle is not the noun
 *
 * The mask table below is the whole exception list, and it is code rather than a path list because
 * a handle is recognisable by its shape. Each row is one thing this repo cannot rename, and each
 * row says why:
 *
 *   - the JavaScript operator `instanceof` — the language's word, not the product's;
 *   - the route paths `/assessment/instances` and `/admin/instances`, which `content/routes.ts`
 *     spells and a redirect in `next.config.mjs` answers;
 *   - the route param `[instanceId]`, which is a directory name, so the page reads it by that name;
 *   - `assessment-instance-<who>` row ids, which are keys in the database and in the bundle;
 *   - the copy-item ids `no-such-instance`, `record-is-an-instance` and `instance-complete`, which
 *     are `id` keys in `data/pages/**` — E41 skips an id on purpose;
 *   - the audit and permission keys `instance.delete`, `instance.force-close` and `instance-voided`,
 *     which are rows already written (`audit_log.action`, `role.permission`);
 *   - the `?instance=` query parameter, which is part of a URL the flow hands around;
 *   - the bundle and platform-package documents (`payload.instances`, `content.instances`,
 *     `kind: "instance"`), which phase 3 retires with a version bump, not with a rename;
 *   - the fixture module paths `data/pages/assessment-instance*`, whose files this card did not
 *     move;
 *   - the fixture's view key `"instances"`, the token `{instances}` and the `instances:` fill that
 *     feeds it — a view key, not a sentence (E41 says the same in its own header).
 *
 * What is left after the masks is the noun. A word `instance`/`instances` fails, and so does any
 * identifier-shaped token carrying it (`instanceId`, `AssessmentInstance`, `listMyInstances`),
 * because the second is the one that quietly grows back.
 *
 * ## The allowlist only shrinks
 *
 * `scripts/noun-allowlist.txt` names a path per line, one comment above it saying why the file
 * keeps the word. Two of them are structural — the demo seed path, which this card may not touch,
 * and the two bundle documents, whose keys are the format — and the rest are the ratchets that
 * quote the retired noun in order to forbid it. **A listed path that no longer carries the word is
 * a failure**, so the list cannot be pre-widened and cannot go stale: retiring an entry is the same
 * edit as removing the last occurrence.
 *
 * Exit: 0 = the noun is gone; 1 = a file outside the allowlist still carries it (or a listed path
 * no longer does).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components", "lib", "content", "scripts"];
const EXT = /\.(ts|tsx|mjs|js|jsx|sql)$/;
const ALLOWLIST = "scripts/noun-allowlist.txt";

/** One thing this repo cannot rename, the shape that recognises it, and the reason. */
const MASKS = [
  { pattern: /\binstanceof\b/g, reason: "the JavaScript operator, not the product's noun" },
  { pattern: /assessment\/instances/g, reason: "a route path content/routes.ts spells" },
  { pattern: /admin\/instances/g, reason: "a route path content/routes.ts spells" },
  { pattern: /\[instanceId\]/g, reason: "the route param, which is a directory name" },
  { pattern: /assessment-instance-/g, reason: "a row id written into the database and the bundle" },
  {
    pattern: /no-such-instance|record-is-an-instance|instance-complete/g,
    reason: "a copy-item id in data/pages/**, which E41 skips on purpose",
  },
  {
    pattern: /instance\.(?:delete|force-close)|instance-voided/g,
    reason: "an audit action or permission key already stored in rows",
  },
  { pattern: /[?&]instance=/g, reason: "the query parameter the flow hands around" },
  {
    pattern: /(?:\bpayload|\brecords|\bcontent|demoDataset|\bactive)\??\.instances\b/g,
    reason: "the bundle and platform-package documents, retired by phase 3",
  },
  { pattern: /\binstances\s*:/g, reason: "the bundle document's own key" },
  { pattern: /kind:\s*"instance"/g, reason: "the platform package's own kind tag" },
  {
    pattern: /data\/pages\/(?:assessment-instance|assessment-instances|admin-instances)/g,
    reason: "a fixture module path this card did not move",
  },
  { pattern: /"instances"/g, reason: "the fixture's view key and the code that selects it" },
  { pattern: /\{\s*instances\s*\}/g, reason: "a copy token a view fills" },
];

const NOUN = /\binstances?\b/i;
const TOKEN = /[A-Za-z0-9_$]*[Ii]nstance[A-Za-z0-9_$]*/g;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const rel = join(dir, entry);
    const stat = statSync(join(ROOT, rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (EXT.test(entry)) out.push(rel);
  }
  return out;
}

/** The allowlist: one path per line, `#` for the reason. */
function readAllowlist() {
  let text;
  try {
    text = readFileSync(join(ROOT, ALLOWLIST), "utf8");
  } catch {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** A file's text with every sanction blanked, so only the noun is left to find. */
function masked(text) {
  let next = text;
  const used = new Set();
  for (const { pattern, reason } of MASKS) {
    next = next.replace(pattern, () => {
      used.add(reason);
      return " ";
    });
  }
  // A file that declares the route param reads it by name, so the local cannot move either.
  if (/params:\s*Promise<\{[^}]*\binstanceId\b/.test(text) || /\{\s*instanceId\s*\}/.test(text)) {
    next = next.replace(/\binstanceId\b/g, " ");
  }
  return next;
}

/** The findings in one file: the noun as a word, and the noun inside an identifier. */
function findingsIn(text) {
  const clean = masked(text);
  const out = new Set();
  for (const match of clean.matchAll(TOKEN)) {
    const token = match[0];
    if (NOUN.test(token)) out.add(token);
    else if (token !== "" && /[Ii]nstance/.test(token)) out.add(token);
  }
  for (const line of clean.split("\n")) {
    const word = line.match(/\binstances?\b/i);
    if (word !== null) out.add(`the word "${word[0]}"`);
  }
  return [...out].sort();
}

const allowed = new Set(readAllowlist());
let walked = 0;
let listing = 0;
let exempt = 0;
const problems = [];
const usedRows = new Set();

for (const dir of DIRS) {
  for (const file of walk(dir)) {
    walked++;
    const text = readFileSync(join(ROOT, file), "utf8");
    if (!/[Ii]nstance/.test(text)) continue;
    const findings = findingsIn(text);
    const isAllowed = allowed.has(file);
    if (isAllowed) usedRows.add(file);
    if (findings.length > 0) {
      listing++;
      if (isAllowed) exempt++;
      else problems.push({ file, findings });
    }
  }
}

for (const path of allowed) {
  if (!usedRows.has(path)) {
    problems.push({ file: path, findings: ["listed, but carries no retired noun — drop the row"] });
  }
}

const census = `${walked} files walked across ${DIRS.join(", ")} · ${listing} carrying the word · ${exempt} allowlisted · ${MASKS.length} sanctioned handles`;

if (problems.length > 0) {
  for (const { file, findings } of problems) {
    console.error(`✗ ${file}: ${findings.join(", ")}`);
  }
  console.error(
    `\n✗ noun-check: ${problems.length} finding(s) — the retired noun is instance; the word is session`,
  );
  console.error(`  ${census}`);
  process.exit(1);
}

console.log(`✓ noun-check: no retired noun — ${census}`);
