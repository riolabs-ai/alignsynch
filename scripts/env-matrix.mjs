#!/usr/bin/env node
/**
 * env-matrix — the store-by-store census behind `.env.example`, generated and never hand-typed.
 *
 * `.env.example` was the third copy of the environment: a hand-maintained list while the code read
 * 82 names and the stores held more. A list nobody generates cannot say which scope a name is bound
 * in, so the questions that actually bite have no answer in the repository:
 *
 *   - a name a preview needs that only production and the `demo` branch carry, so every other PR
 *     preview refuses checkout — invisible until somebody reads a build refusal;
 *   - an empty Vercel `development` scope, so `vercel env pull` and local `vercel dev` get nothing;
 *   - one name with two Preview entries (all-branches and `demo`-scoped) and no record of which is
 *     authoritative.
 *
 * This script answers all three, from the stores themselves: it reads each local env file, the
 * manifest template, the Bitwarden project `alignsynch-web`, and **every Vercel scope**, and writes
 * one matrix — name × store, `+` present, `o` present-but-empty, `·` absent.
 *
 *   node scripts/env-matrix.mjs --write       # regenerate docs/operations/env-stores.md
 *   node scripts/env-matrix.mjs --check       # diff the live stores against the committed matrix
 *   node scripts/env-matrix.mjs --dir <tree>  # read another tree's .env* (a worktree has none)
 *   node scripts/env-matrix.mjs --json        # the census, for another tool
 *
 * ## Never a value
 *
 * Every mark is presence. Nothing here prints, logs or writes a value: a value is read in exactly
 * one place — the fingerprint that decides whether two Preview entries are the same secret — and a
 * fingerprint is `sha256(value)` truncated to twelve hex characters. An entry Vercel will not
 * decrypt reports `hidden` instead, because a masked secret cannot be compared and pretending
 * otherwise is how a demo branch gets pointed at production data.
 *
 * ## Two axes, because a vault key is not an env name
 *
 * The vault's keys are `ALIGNSYNCH_PROD_DATABASE_URL`; the app's name is `DATABASE_URL`. So the
 * `BWS` column is **projected through the table**: a `+` means a vault key the row names exists in
 * project `alignsynch-web`. Vault keys no row names are listed separately, which is the drift that
 * survives forever otherwise (`RIO_GITHUB_KEY` sat in the vault belonging to no surface).
 *
 * ## Why `--check` is local-only
 *
 * It needs the vault token and the Vercel CLI's session, and CI has neither — a gate step that
 * needs a credential fails on someone else's laptop. So the committed matrix is a dated snapshot
 * and the gate holds `.env.example` against the *table* (`pnpm env:check`), which is the half that
 * can be proven without a network. `--check` is what an operator runs before a release, and it
 * exits 1 on drift.
 *
 * Exit codes: 0 in agreement (or --write succeeded) · 1 drift · 2 the census itself could not run.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = "prj_jvt3U5GpGv5TnmWfyqkQ5kbbou5k";
const TEAM = "team_kA2uEuTmRU2RhACF1Len0GES";
const API = "https://api.vercel.com";
/** Bitwarden Secrets Manager project `alignsynch-web` — the vault every `vault` row names. */
const VAULT_PROJECT_ID = "e2b8d242-ebc6-4c79-8298-b3f7012a06fa";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_FILE = "docs/operations/env-stores.md";

/* --- flags ---------------------------------------------------------------------------------- */
function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const write = arg("write", false) === true;
const check = arg("check", false) === true;
const json = arg("json", false) === true;
const dir = arg("dir", null);
const envDir = dir && dir !== true ? path.resolve(dir) : ROOT;

/** Local env files, in the order the matrix columns print. */
const LOCAL_FILES = [".env", ".env.local", ".env.demo", ".env.example"];

function fail(message) {
  console.error(`env-matrix: ${message}`);
  process.exit(2);
}

/* --- local files ---------------------------------------------------------------------------- */

/**
 * `NAME=` pairs in one file: the name and whether it carries a value.
 *
 * The value itself is never returned. `o` in the matrix means the file declares the name and holds
 * nothing for it — the honest state of `.env.example`, and the state that silently shadows a
 * working value in a file that outranks it under the repo's loader.
 */
function readEnvKeys(file) {
  const entries = new Map();
  if (!fs.existsSync(file)) return entries;
  const keyShape = /^[A-Za-z_][A-Za-z0-9_]*$/;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const name = line.slice(0, eq).trim();
    if (!keyShape.test(name)) continue;
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    entries.set(name, value === "" ? "empty" : "full");
  }
  return entries;
}

function readLocal() {
  const columns = new Map();
  for (const file of LOCAL_FILES) columns.set(file, readEnvKeys(path.join(envDir, file)));
  return columns;
}

/* --- the manifest table --------------------------------------------------------------------- */

/** The rows, read through the manifest's own `--json` so there is one table, not a copy of one. */
function readManifest() {
  const child = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      path.join(HERE, "env-manifest.ts"),
      "--json",
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (child.status !== 0) {
    fail(`the manifest could not be read (${(child.stderr ?? "").split("\n")[0] || "no output"})`);
  }
  return JSON.parse(child.stdout);
}

/** Every vault key a row names, in any of its environments. */
function vaultKeysOf(row) {
  const sources = [row.source, ...Object.values(row.sources ?? {})];
  const keys = new Set();
  for (const source of sources) {
    if (source && typeof source === "object" && typeof source.vault === "string") {
      keys.add(source.vault);
    }
  }
  return [...keys];
}

/* --- the vault ------------------------------------------------------------------------------ */

/**
 * The vault's **key names**, from `bws secret list`. A missing token is reported as unavailable
 * rather than as absent: an unreadable store and an empty one are different findings, and printing
 * `·` for the first would invent an absence.
 */
function readVault() {
  const token = (process.env.BWS_ACCESS_TOKEN ?? "").trim();
  if (token === "") {
    return { names: null, note: "BWS_ACCESS_TOKEN not set in this shell — column unread" };
  }
  const child = spawnSync("bws", ["secret", "list", VAULT_PROJECT_ID, "-o", "json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env },
  });
  if (child.status !== 0) {
    return {
      names: null,
      note: `the vault could not be read (${(child.stderr ?? "").split("\n")[0] || "no output"})`,
    };
  }
  try {
    const parsed = JSON.parse(child.stdout);
    const names = new Set();
    for (const entry of parsed) {
      if (typeof entry.key === "string") names.add(entry.key);
    }
    return { names, note: `${names.size} secret(s) readable in project alignsynch-web` };
  } catch {
    return { names: null, note: "the vault answered something that is not JSON — column unread" };
  }
}

/* --- Vercel --------------------------------------------------------------------------------- */

function token() {
  const file = path.join(os.homedir(), ".local/share/com.vercel.cli/auth.json");
  if (!fs.existsSync(file)) fail("no Vercel CLI session — run `vercel login`");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!parsed.token) fail("no token in the Vercel CLI auth file — run `vercel login`");
  return parsed.token;
}

async function listProjectEnv(tok) {
  const res = await fetch(`${API}/v9/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=true`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  if (!res.ok) fail(`the project's env could not be read (HTTP ${res.status} ${res.statusText})`);
  const body = await res.json();
  return body.envs ?? [];
}

/**
 * One entry's fingerprint: twelve hex characters of the value, or `hidden`.
 *
 * Vercel decrypts nothing it stored as `sensitive`, so a secret answers without a value. That is
 * the finding, not an error: two entries can only be *proven* identical when both decrypt, and a
 * deletion decided on an unprovable pair is the failure this card exists to stop.
 */
function fingerprint(entry) {
  if (typeof entry.value !== "string" || entry.value === "") return "hidden";
  return createHash("sha256").update(entry.value).digest("hex").slice(0, 12);
}

/**
 * The scopes a name is bound in. Vercel models a preview as two scopes, not one: an all-branches
 * entry every preview inherits, and a branch entry that overrides it for that branch only.
 */
function readScopes(entries) {
  const scopes = { production: new Map(), preview: new Map(), development: new Map() };
  const branchScopes = new Map();
  for (const entry of entries) {
    const targets = entry.target ?? [];
    if (targets.includes("production")) scopes.production.set(entry.key, entry);
    if (targets.includes("development")) scopes.development.set(entry.key, entry);
    if (targets.includes("preview")) {
      if (entry.gitBranch) {
        const branch = branchScopes.get(entry.gitBranch) ?? new Map();
        branch.set(entry.key, entry);
        branchScopes.set(entry.gitBranch, branch);
      } else {
        scopes.preview.set(entry.key, entry);
      }
    }
  }
  return { scopes, branchScopes };
}

/* --- the matrix ----------------------------------------------------------------------------- */

const MARK = { full: "+", empty: "o", absent: "·" };

function mark(column, name) {
  if (column === null) return "?";
  if (!column.has(name)) return MARK.absent;
  const value = column.get(name);
  return typeof value === "string" ? (MARK[value] ?? MARK.full) : MARK.full;
}

/** The nav block `pnpm docs:nav` owns. Preserved across a regeneration and ignored by `--check`. */
const NAV_BLOCK = "<!-- docs-nav:begin -->\n\n<!-- docs-nav:end -->";

/**
 * The `BWS` column, projected through the table: one mark per *row*, `+` when any vault key that
 * row names exists in the vault. A name with no vault source is `·` here and says why in the table
 * — `literal`, `carried`, `derived` or the app's own default.
 */
function vaultColumn(rows, vaultNames) {
  if (vaultNames === null) return null;
  const column = new Map();
  for (const row of rows) {
    const keys = vaultKeysOf(row);
    if (keys.length === 0) continue;
    if (keys.some((key) => vaultNames.has(key))) column.set(row.name, "full");
  }
  return column;
}

/** Every env name the stores or the table mention: rows first, then undeclared names sorted. */
function buildMatrix({ local, scopes, branchScopes, rows, outOfScope }) {
  const names = new Set();
  for (const column of local.values()) for (const name of column.keys()) names.add(name);
  for (const scope of [...Object.values(scopes), ...branchScopes.values()]) {
    for (const name of scope.keys()) names.add(name);
  }
  const declared = rows.map((row) => row.name);
  const known = new Set([...declared, ...outOfScope.map((entry) => entry.name)]);
  for (const name of known) names.add(name);

  // Manifest order first — the matrix reads as a review of `.env.example` — then the names neither
  // a row nor an exemption declares, alphabetically, which is the finding list.
  const order = declared.filter((name) => names.has(name));
  const undeclared = [...names].filter((name) => !known.has(name)).sort();
  return [...order, ...undeclared];
}

function columnsFor(local, vaultNames, rows, scopes, branchScopes) {
  const columns = [];
  for (const file of LOCAL_FILES) columns.push({ id: file, column: local.get(file) });
  columns.push({ id: "BWS", column: vaultColumn(rows, vaultNames) });
  columns.push({ id: "vercel:production", column: scopes.production });
  columns.push({ id: "vercel:preview", column: scopes.preview });
  for (const branch of [...branchScopes.keys()].sort()) {
    columns.push({ id: `vercel:preview@${branch}`, column: branchScopes.get(branch) });
  }
  columns.push({ id: "vercel:development", column: scopes.development });
  return columns;
}

/* --- the report ----------------------------------------------------------------------------- */

function duplicateDecisions(scopes, branchScopes) {
  const duplicated = [...scopes.preview.keys()]
    .filter((name) => [...branchScopes.values()].some((branch) => branch.has(name)))
    .sort();
  const decisions = [];
  for (const name of duplicated) {
    const base = scopes.preview.get(name);
    for (const [branch, entries] of [...branchScopes.entries()].sort()) {
      const scoped = entries.get(name);
      if (!scoped) continue;
      const basePrint = fingerprint(base);
      const branchPrint = fingerprint(scoped);
      const same = basePrint !== "hidden" && basePrint === branchPrint;
      const masked = [basePrint, branchPrint].filter((print) => print === "hidden").length;
      decisions.push({
        name,
        branch,
        baseType: base.type ?? "unknown",
        branchType: scoped.type ?? "unknown",
        baseFingerprint: basePrint,
        branchFingerprint: branchPrint,
        same,
        masked,
        decision: same
          ? "identical value, proven — the all-branches entry is authoritative and the branch copy is redundant"
          : masked === 2
            ? "unprovable (both masked) — the branch entry stays authoritative on that branch by precedence"
            : masked === 1
              ? "unprovable (one side masked) — the branch entry stays authoritative there by precedence"
              : "the two values differ — the branch entry is authoritative there, the all-branches entry elsewhere",
      });
    }
  }
  return decisions;
}

function buildReport(input) {
  const { names, columns, rows, outOfScope, vault, scopes, branchScopes, local } = input;
  const declared = new Set(rows.map((row) => row.name));
  const exempt = new Set(outOfScope.map((entry) => entry.name));
  const example = local.get(".env.example") ?? new Map();
  const storeColumns = columns.filter((column) => column.id !== ".env.example");

  const inAnyStore = (name) =>
    storeColumns.some((column) => column.column !== null && column.column.has(name));

  const undeclared = names.filter((name) => !declared.has(name) && !exempt.has(name));
  const declaredAbsent = rows
    .map((row) => row.name)
    .filter((name) => !inAnyStore(name))
    .sort();
  const undeclaredInExample = [...example.keys()].filter((name) => !declared.has(name)).sort();
  const declaredMissingFromExample = rows
    .map((row) => row.name)
    .filter((name) => !example.has(name))
    .sort();
  const vaultUnclaimed =
    vault.names === null
      ? []
      : [...vault.names]
          .filter((key) => !rows.some((row) => vaultKeysOf(row).includes(key)))
          .sort();
  const decisions = duplicateDecisions(scopes, branchScopes);

  const lines = [];
  const push = (line = "") => lines.push(line);

  push("# The stores behind `.env.example`: one matrix, generated");
  push();
  push(NAV_BLOCK);
  push();
  push(
    "Generated by `pnpm env:matrix --write` from the local env files, the Bitwarden project " +
      "`alignsynch-web` and every Vercel scope of the `alignsynch` project. **It is a census, not a " +
      "configuration**: no value appears anywhere in this page, and nothing here writes to a store. " +
      "The row set is `scripts/env-manifest.ts`; this page says where each row actually lands.",
  );
  push();
  push("<!-- volatile:begin -->");
  push(
    `Generated ${new Date().toISOString().slice(0, 10)} from the tree's \`.env*\` files, Bitwarden ` +
      `project \`alignsynch-web\` and the Vercel project \`alignsynch\` — ${names.length} name(s) ` +
      `across ${columns.length} store(s).`,
  );
  push(`Vault: ${vault.note}.`);
  push("<!-- volatile:end -->");

  push();
  push("## What the stores disagree about");
  push();
  push("| finding | number |");
  push("| --- | --- |");
  push(`| names in a store that neither a row nor an exemption declares | ${undeclared.length} |`);
  push(`| manifest rows absent from every store | ${declaredAbsent.length} |`);
  push(`| names in \`.env.example\` that no row declares | ${undeclaredInExample.length} |`);
  push(`| rows missing from \`.env.example\` | ${declaredMissingFromExample.length} |`);
  push(`| Vercel \`development\` entries | ${scopes.development.size} |`);
  push(`| names with two Preview entries (all-branches + branch) | ${decisions.length} |`);
  push(`| vault keys no row names | ${vault.names === null ? "unread" : vaultUnclaimed.length} |`);
  push();

  push("## The matrix");
  push();
  push("`+` present · `o` present but empty · `·` absent · `?` store unread");
  push();
  push("| # | name | " + columns.map((column) => column.id).join(" | ") + " | row |");
  push("| --- | --- | " + columns.map(() => "---").join(" | ") + " | --- |");
  names.forEach((name, index) => {
    const marks = columns.map((column) => mark(column.column, name)).join(" | ");
    const row = declared.has(name) ? "yes" : exempt.has(name) ? "exempt" : "—";
    push(`| ${index + 1} | \`${name}\` | ${marks} | ${row} |`);
  });
  push();

  push("## Two Preview entries, and which one is authoritative");
  push();
  push(
    "Vercel resolves a preview in two scopes: the **all-branches** entry, which every preview " +
      "inherits, and a **branch** entry, which overrides it for deployments from that branch. So " +
      '"one answer per scope" is decided by precedence, not by deleting a row: the branch entry ' +
      "wins on that branch and the all-branches entry answers every other preview.",
  );
  push();
  push(
    "A branch entry is only justified when that branch must *differ*. The fingerprint columns " +
      "decide it: an identical pair is a proven duplicate, and `hidden` means Vercel stored the " +
      "value as a secret and will not decrypt it, so the pair cannot be proven equal and neither " +
      "entry may be removed on a guess.",
  );
  push();
  push("| name | scope types | fp(all-branches) | fp(branch) | decision |");
  push("| --- | --- | --- | --- | --- |");
  for (const decision of decisions) {
    push(
      `| \`${decision.name}\` | ${decision.baseType} / ${decision.branchType} ` +
        `(\`${decision.branch}\`) | ${decision.baseFingerprint} | ` +
        `${decision.branchFingerprint} | ${decision.decision} |`,
    );
  }
  push();

  push("## Names a store holds that no row declares");
  push();
  if (undeclared.length === 0) {
    push("None: every name in a store is declared by a row or exempted by name.");
  } else {
    push("| name | " + storeColumns.map((column) => column.id).join(" | ") + " |");
    push("| --- | " + storeColumns.map(() => "---").join(" | ") + " |");
    for (const name of undeclared) {
      const marks = storeColumns.map((column) => mark(column.column, name)).join(" | ");
      push(`| \`${name}\` | ${marks} |`);
    }
    push();
    push(
      "Each is either an app variable missing from the table (add the row) or a local tool " +
        "credential (add it to `OUT_OF_SCOPE` with its reason) — `pnpm env:check` decides which, " +
        "because it reads the code and this file does not.",
    );
  }
  push();

  push("## Manifest rows no store carries");
  push();
  push(
    declaredAbsent.length === 0
      ? "None."
      : `${declaredAbsent.map((name) => `\`${name}\``).join(", ")} — optional rows the app ` +
          "defaults, or rows an environment genuinely does not hold.",
  );
  push();

  push("## Vault keys no row names");
  push();
  push(
    vault.names === null
      ? "The vault could not be read on this run, so this is unknown — not empty."
      : vaultUnclaimed.length === 0
        ? "None: every secret in the project is named by a row."
        : `${vaultUnclaimed.map((key) => `\`${key}\``).join(", ")} — a secret nothing reads. ` +
          "Either a row is missing or the key should be retired.",
  );
  push();

  // The nav block appears twice — above and below the body — and `pnpm docs:nav` owns both.
  push(NAV_BLOCK);
  push();

  return {
    text: tidy(lines.join("\n")),
    decisions,
    undeclared,
    declaredAbsent,
    vaultUnclaimed,
  };
}

/* --- compare, write, print ------------------------------------------------------------------ */

/** Blank-line hygiene: MD012 refuses two consecutive blank lines, and a generator is not exempt. */
function tidy(text) {
  return `${text.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/**
 * Biome pads a markdown table's pipes, and `pnpm lint` runs it — so the generator formats through
 * the same binary instead of re-implementing cell padding. A tree without an install still writes
 * the page, and says so rather than silently emitting something the gate will reject.
 */
function canonical(text) {
  const bin = path.join(ROOT, "node_modules/.bin/biome");
  if (!fs.existsSync(bin)) {
    console.error("env-matrix: biome is not installed in this tree — writing unformatted markdown");
    return tidy(text);
  }
  const child = spawnSync(bin, ["format", "--stdin-file-path", OUT_FILE], {
    input: text,
    encoding: "utf8",
  });
  const formatted = typeof child.stdout === "string" ? child.stdout : "";
  return formatted.trim() === "" ? tidy(text) : formatted;
}

/** Everything `--check` holds the live stores against: not the census date, not the nav blocks. */
function stablePart(text) {
  return text
    .replace(/<!-- volatile:begin -->[\s\S]*?<!-- volatile:end -->\n/g, "")
    .replace(/<!-- docs-nav:begin -->[\s\S]*?<!-- docs-nav:end -->\n/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** The nav blocks `pnpm docs:nav` wrote last time, so a regeneration does not wipe them. */
function preserveNav(generated, previous) {
  const blocks = [
    ...previous.matchAll(/<!-- docs-nav:begin -->[\s\S]*?<!-- docs-nav:end -->/g),
  ].map((match) => match[0]);
  if (blocks.length === 0) return generated;
  let index = 0;
  return generated.replace(/<!-- docs-nav:begin -->[\s\S]*?<!-- docs-nav:end -->/g, (match) =>
    index < blocks.length ? blocks[index++] : match,
  );
}

function diffLines(expected, actual) {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      out.push(
        `  line ${i + 1}: committed ${JSON.stringify(a[i] ?? "")}\n` +
          `            live      ${JSON.stringify(b[i] ?? "")}`,
      );
    }
  }
  return out;
}

async function main() {
  const { rows, outOfScope } = readManifest();
  const local = readLocal();
  const vault = readVault();
  const entries = await listProjectEnv(token());
  const { scopes, branchScopes } = readScopes(entries);
  const names = buildMatrix({ local, scopes, branchScopes, rows, outOfScope });
  const columns = columnsFor(local, vault.names, rows, scopes, branchScopes);

  const report = buildReport({
    names,
    columns,
    rows,
    outOfScope,
    vault,
    scopes,
    branchScopes,
    local,
  });

  if (json) {
    console.log(
      JSON.stringify(
        {
          names,
          columns: columns.map((column) => ({
            id: column.id,
            marks: Object.fromEntries(names.map((name) => [name, mark(column.column, name)])),
          })),
          counts: {
            names: names.length,
            undeclared: report.undeclared.length,
            declaredAbsent: report.declaredAbsent.length,
            development: scopes.development.size,
            duplicatedPreview: report.decisions.length,
            vaultUnclaimed: report.vaultUnclaimed.length,
          },
          duplicateDecisions: report.decisions,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const target = path.join(ROOT, OUT_FILE);
  const summary =
    `${names.length} name(s) × ${columns.length} store(s) · ` +
    `${report.undeclared.length} undeclared · ${report.declaredAbsent.length} absent from every ` +
    `store · ${scopes.development.size} in development · ${report.decisions.length} preview ` +
    `duplicate(s) · ${report.vaultUnclaimed.length} unclaimed vault key(s)`;

  if (write) {
    const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    fs.writeFileSync(target, canonical(preserveNav(report.text, previous)));
    console.log(`env-matrix: wrote ${OUT_FILE} — ${summary}. Values were never printed.`);
    return 0;
  }

  if (check) {
    if (!fs.existsSync(target))
      fail(`${OUT_FILE} does not exist — run \`pnpm env:matrix --write\``);
    const committed = fs.readFileSync(target, "utf8");
    const drift = diffLines(
      stablePart(committed),
      stablePart(canonical(preserveNav(report.text, committed))),
    );
    console.log(`env-matrix: ${summary}`);
    if (drift.length > 0) {
      console.error(
        `\nenv-matrix: DRIFT — the committed matrix no longer matches the stores ` +
          `(${drift.length} line(s) differ):`,
      );
      for (const line of drift.slice(0, 40)) console.error(line);
      console.error(
        "\nRe-run `pnpm env:matrix --write` and commit the result, with the decision for any new " +
          "duplicate recorded in the same change.",
      );
      return 1;
    }
    console.log(`env-matrix: PASS — ${OUT_FILE} matches every store it reads`);
    return 0;
  }

  console.log(`env-matrix: ${summary}. Nothing was written — pass --write or --check.`);
  for (const name of report.undeclared) console.log(`  undeclared  ${name}`);
  for (const name of report.declaredAbsent) console.log(`  absent      ${name}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error("env-matrix: the census itself failed", error);
    process.exit(2);
  },
);
