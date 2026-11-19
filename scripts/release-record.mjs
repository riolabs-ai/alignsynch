#!/usr/bin/env node
/**
 * `node scripts/release-record.mjs check <version> <tag-sha> [--since <iso>] [--record <path>]`
 *
 * The postcondition `bash scripts/release.sh --tag-only` holds the platform record to (#961).
 *
 * Why this exists: a tag is immutable, so the record *on* the tag is a snapshot of whatever the last
 * `pnpm health:record` measured. v1.17.0 was cut with `--tag-only` and the file on the tag read
 * `tree.packageVersion 1.15.0 · latestTag v1.15.0`, while `/admin/health` reads the *committed*
 * record and named the previous release as current until a separate re-record landed — a step that
 * was skipped, and cost three cards and one duplicate. So `--tag-only` now ends by re-recording, and
 * asks this module whether the artifact it wrote names the release it just cut. A cut that exits 0
 * over a stale record is worse than one that fails.
 *
 * Four facts, each naming the field and the disagreement:
 *
 *   `tree.packageVersion`  this version, not the previous one
 *   `tree.latestTag`       `v<version>` — the tag describe now finds, because the tag exists
 *   `tree.headSha`         the commit the tag sits on (the recorder measures `HEAD`, and nothing in
 *                          a `--tag-only` cut advances it)
 *   `recordedAt`           this run's instant, not a carried one: a recorder that exited 0 without
 *                          writing must not pass for a record that was written
 *
 * It reads `data/health/platform-health.json` and nothing else — no network, no database, no git —
 * so it is a pure function of a file and three arguments, and the cut runs it in a second.
 *
 * `<version>` may be written either way (#1248): `2.0.0-rc1.3` or `v2.0.0-rc1.3`. The strip is
 * `release-version.mjs::stripV`, the same normaliser the preflight, the cut and `release.sh` use, and
 * `tree.latestTag` is always compared as `v<version>` — one prefix, never two.
 *
 * ---------------------------------------------------------------------------------------------
 * The approval ledger — the second record this module owns
 * ---------------------------------------------------------------------------------------------
 * A pre-approved cut (`scripts/release-cut.mjs --execute` with no TTY) tags on the strength of a
 * committed approval artifact. Printing the banner is not a record: the next reader asks *which*
 * approval covered *which* tag, and a transcript is not an answer. So this module also owns
 * `data/health/release-approvals.json`, appended by `recordApproval()` once the tag exists:
 *
 *     { "schemaVersion": 1,
 *       "approvals": [ { version, commit, approved_by, approved_at, url, reason?, tag, recorded_at } ] }
 *
 * It is a separate file rather than a block in `platform-health.json` for two measured reasons: that
 * record's schema is `strict()`, so an unknown key is a red build (`content/platform-health.ts`),
 * and the recorder rewrites the file whole on every `--tag-only` — an approval stored there would be
 * deleted by the very step that follows it. The tag itself is created *before* this write, so the
 * ledger can never dirty the tree the gate checks.
 *
 * The published release note is the `CHANGELOG.md` entry byte for byte (`release.sh`,
 * `gh release create --notes-file`), so a post-hoc approval cannot ride in it without changing the
 * tag/publish path — which this mechanism deliberately does not touch. The ledger plus the printed
 * banner is the audit trail; `pnpm release:approvals` prints it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compareVersions, normalizeVersion, stripV } from "./release-version.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RECORD_PATH = join(ROOT, "data", "health", "platform-health.json");

/** The approval ledger this module also owns: one row per pre-approved cut, newest version first. */
const APPROVALS_RELATIVE = join("data", "health", "release-approvals.json");
export const APPROVAL_LEDGER_SCHEMA = 1;

/** Where the ledger lives, for a tree other than this one (a test, a scratch checkout). */
export function approvalLedgerPath(root = ROOT) {
  return join(root, APPROVALS_RELATIVE);
}

const short = (sha) => (/^[0-9a-f]{12,}$/.test(sha) ? sha.slice(0, 7) : sha);

/**
 * Every way the record fails to name the release just cut, as one line per fact.
 *
 * Exported so a test can ask the question without a repository: the module is the rule, and the
 * CLI below is only how `release.sh` reaches it.
 */
export function recordProblems(record, { version, tagSha, since }) {
  const problems = [];
  const tree = record?.tree;

  if (tree === undefined || tree === null || typeof tree !== "object") {
    return ["tree — the record has no tree block, so it names no version at all"];
  }

  if (tree.packageVersion !== version) {
    problems.push(
      `tree.packageVersion — the record names ${String(tree.packageVersion)}, not ${version}`,
    );
  }
  const tag = `v${version}`;
  if (tree.latestTag !== tag) {
    problems.push(`tree.latestTag — the record names ${String(tree.latestTag)}, not ${tag}`);
  }
  if (tree.headSha !== tagSha) {
    problems.push(
      `tree.headSha — the record was measured at ${short(String(tree.headSha))}; ${tag} sits on ${short(tagSha)}`,
    );
  }

  if (since !== undefined) {
    const written = Date.parse(String(record?.recordedAt ?? ""));
    const began = Date.parse(since);
    if (!Number.isFinite(written)) {
      problems.push(
        `recordedAt — the record carries no readable instant (${String(record?.recordedAt)})`,
      );
    } else if (Number.isFinite(began) && written < began) {
      problems.push(
        `recordedAt — ${record.recordedAt} is older than the record step (${since}); the file was carried, not written`,
      );
    }
  }

  return problems;
}

/** The four facts as they stand, in the order this file documents them. */
export function recordFacts(record, { version, tagSha, since }) {
  const facts = [
    { field: "tree.packageVersion", value: record?.tree?.packageVersion, want: version },
    { field: "tree.latestTag", value: record?.tree?.latestTag, want: `v${version}` },
    { field: "tree.headSha", value: record?.tree?.headSha, want: tagSha },
  ];
  if (since !== undefined)
    facts.push({ field: "recordedAt", value: record?.recordedAt, want: since });
  return facts;
}

/* ------------------------------------------------------------------ *
 * The approval ledger — which approval covered which tag
 * ------------------------------------------------------------------ */

/** An empty ledger, and the one shape a reader may assume. */
export function emptyLedger() {
  return { schemaVersion: APPROVAL_LEDGER_SCHEMA, approvals: [] };
}

/**
 * The ledger at `path`, or an empty one when the file does not exist yet.
 *
 * A malformed file is an error rather than a reset: silently starting from `approvals: []` would
 * delete the record of every earlier pre-approved cut on the next write.
 *
 * @param {string} [path]
 * @returns {{ ok: true, ledger: { schemaVersion?: number, approvals: Array<Record<string, string>> }, created: boolean } | { ok: false, problem: string }}
 */
export function readApprovalLedger(path = approvalLedgerPath()) {
  if (!existsSync(path)) return { ok: true, ledger: emptyLedger(), created: true };

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { ok: false, problem: `${path} is not readable as JSON (${error.message})` };
  }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.approvals)) {
    return { ok: false, problem: `${path} carries no 'approvals' array` };
  }
  return { ok: true, ledger: parsed, created: false };
}

/**
 * Append one approval to the ledger, replacing any earlier row for the same version (a re-run of a
 * failed cut must not leave two rows for one release). Returns the path written.
 *
 * `recorded_at` is the write's own instant, passed in rather than read here so the function stays a
 * pure write of the values it is given.
 *
 * @param {Record<string, string | undefined>} approval
 * @param {{ path?: string, recordedAt?: string | null }} [options]
 * @returns {string} the path written
 */
export function recordApproval(approval, { path = approvalLedgerPath(), recordedAt = null } = {}) {
  const version = stripV(String(approval?.version ?? "").trim());
  for (const key of ["commit", "approved_by", "url"]) {
    if (typeof approval?.[key] !== "string" || approval[key].trim() === "") {
      throw new Error(`recordApproval: '${key}' is required — the ledger names who approved what`);
    }
  }

  const current = readApprovalLedger(path);
  if (!current.ok) throw new Error(`recordApproval: ${current.problem}`);

  const entry = {
    version,
    commit: String(approval.commit).trim(),
    approved_by: String(approval.approved_by).trim(),
    approved_at: String(approval.approved_at ?? "").trim(),
    url: String(approval.url).trim(),
    ...(typeof approval.reason === "string" && approval.reason.trim() !== ""
      ? { reason: approval.reason.trim() }
      : {}),
    tag: typeof approval.tag === "string" ? approval.tag.trim() : `v${version}`,
    recorded_at: recordedAt ?? new Date().toISOString(),
  };

  const others = current.ledger.approvals.filter((row) => String(row?.version) !== version);
  const approvals = [...others, entry].sort((left, right) => {
    const byVersion = compareVersions(left?.version, right?.version);
    return byVersion === null ? 0 : -byVersion;
  });

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ ...current.ledger, schemaVersion: APPROVAL_LEDGER_SCHEMA, approvals }, null, 2)}\n`,
  );
  return path;
}

function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function check(argv) {
  const [versionGiven, tagSha] = argv;
  if (versionGiven === undefined || tagSha === undefined) {
    console.error("release-record: check needs <version> <tag-sha>");
    return 2;
  }
  // **Either spelling, one tag name (#1248).** `tree.latestTag` is compared as `v<version>`, so a
  // caller that passed the tagged spelling used to be told the record named `vv2.0.0-rc1.3` — two
  // false ✗ against a record that was right. The strip is the shared normaliser, not a local one.
  const version = normalizeVersion(versionGiven);
  if (version === null) {
    console.error(`release-record: '${versionGiven}' is not a semantic version (x.y.z)`);
    return 2;
  }
  if (version !== versionGiven) {
    console.log(`  · version ${version} (given '${versionGiven}'; the tag is v${version})`);
  }
  const since = flagValue(argv, "--since");
  const path = flagValue(argv, "--record") ?? RECORD_PATH;

  let record;
  try {
    record = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`  ✗ record — ${path} is not readable as JSON (${error.message})`);
    return 1;
  }

  const facts = recordFacts(record, { version, tagSha, since });
  const problems = recordProblems(record, { version, tagSha, since });

  for (const fact of facts) {
    const ok = !problems.some((problem) => problem.startsWith(`${fact.field} —`));
    if (ok) {
      const shown = fact.field === "tree.headSha" ? short(String(fact.value)) : String(fact.value);
      console.log(`  ✓ ${fact.field} — ${shown}`);
    }
  }
  for (const problem of problems) console.error(`  ✗ ${problem}`);

  if (problems.length > 0) {
    console.error(
      `\nrelease-record: ${path} does not name ${version} at ${short(tagSha)} — ${problems.length} disagreement(s) above.`,
    );
    return 1;
  }
  console.log(`release-record: the record names v${version} at ${short(tagSha)}`);
  return 0;
}

/** `approval <version> <commit> --approved-by <login> --url <url> [--approved-at <iso>] …` */
function approval(argv) {
  const [versionGiven, commit] = argv;
  const approvedBy = flagValue(argv, "--approved-by");
  const url = flagValue(argv, "--url");
  if (!versionGiven || !commit || !approvedBy || !url) {
    console.error(
      "release-record: approval needs <version> <commit> --approved-by <login> --url <url>",
    );
    return 2;
  }
  // The ledger stores the bare version and the tag is `v<version>` (#1248): one normaliser, so a
  // pre-approved cut recorded as `v1.21.0` and one recorded as `1.21.0` are the same row.
  const version = normalizeVersion(versionGiven);
  if (version === null) {
    console.error(`release-record: '${versionGiven}' is not a semantic version (x.y.z)`);
    return 2;
  }
  const path = flagValue(argv, "--ledger") ?? approvalLedgerPath();
  try {
    const written = recordApproval(
      {
        version,
        commit,
        approved_by: approvedBy,
        approved_at: flagValue(argv, "--approved-at") ?? new Date().toISOString(),
        url,
        reason: flagValue(argv, "--reason"),
        tag: `v${version}`,
      },
      { path },
    );
    console.log(`release-record: recorded the approval for ${version} in ${written}`);
    return 0;
  } catch (error) {
    console.error(`  ✗ ${error.message}`);
    return 1;
  }
}

/** `approvals [--ledger <path>]` — the ledger as it stands, newest version first. */
function approvals(argv) {
  const path = flagValue(argv, "--ledger") ?? approvalLedgerPath();
  const ledger = readApprovalLedger(path);
  if (!ledger.ok) {
    console.error(`  ✗ ${ledger.problem}`);
    return 1;
  }
  if (ledger.ledger.approvals.length === 0) {
    console.log(`release-record: no pre-approved cut is recorded in ${path}`);
    return 0;
  }
  for (const row of ledger.ledger.approvals) {
    console.log(
      `  ${row.tag ?? `v${row.version}`}  ${short(String(row.commit))}  ${row.approved_by}  ${row.url}`,
    );
  }
  console.log(`release-record: ${ledger.ledger.approvals.length} approval(s) in ${path}`);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const mode = argv.shift();
  if (mode === "check") process.exit(check(argv));
  if (mode === "approval") process.exit(approval(argv));
  if (mode === "approvals") process.exit(approvals(argv));
  console.error(
    `release-record: unknown mode '${String(mode)}' — the modes are: check, approval, approvals`,
  );
  process.exit(2);
}
