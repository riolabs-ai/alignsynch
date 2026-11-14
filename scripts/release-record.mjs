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
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RECORD_PATH = join(ROOT, "data", "health", "platform-health.json");

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

function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function check(argv) {
  const [version, tagSha] = argv;
  if (version === undefined || tagSha === undefined) {
    console.error("release-record: check needs <version> <tag-sha>");
    return 2;
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

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const mode = argv.shift();
  if (mode !== "check") {
    console.error(`release-record: unknown mode '${String(mode)}' — the modes are: check`);
    process.exit(2);
  }
  process.exit(check(argv));
}
