/**
 * `--tag-only` ends by holding the platform record to the release it just cut — proved by running it.
 *
 * The defect this file exists for (#961): a tag is immutable, so the record *on* the tag is a
 * snapshot of whenever the tree was last measured. v1.17.0 was cut with `--tag-only`, the file on the
 * tag read `tree.packageVersion 1.15.0`, and `/admin/health` — which renders the *committed* record —
 * named the previous release as current until a separate re-record landed. That step was skipped and
 * cost three cards and one duplicate, so the script now runs it and refuses to call the cut done when
 * the record it wrote disagrees.
 *
 * Each case builds a throwaway repository — the real `release.sh`, the real classifier, the real
 * `release-record.mjs`, a `package.json`, a `CHANGELOG.md`, a bare `origin`, a `gh` shim and a `pnpm`
 * shim that plays the recorder — and runs the real script. Nothing here touches the repository's own
 * `package.json`, `CHANGELOG.md`, health record or tags, and nothing reaches the network.
 *
 *   1. the stale case: the recorder writes the *previous* version's record — the cut publishes the
 *      tag and then exits non-zero, naming the disagreement;
 *   2. the record that names this version, this tag and the tagged commit — exit 0, and the lines
 *      that say the record is owed as its own pull request;
 *   3. a recorder that exits 0 without writing anything is not a record: the cut fails;
 *   4. a recorder that fails fails the cut, naming the command to re-run;
 *   5. `--no-record`: publishes the tag, runs no recorder, prints the exact command, exits 0;
 *   6. no demo credentials and no `--no-record`: refuses before the recorder, naming both ways out;
 *   7. `--no-record` on a mode with no record step is a usage error, not a silent no-op.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERSION = "1.1.1";
const PREVIOUS = "1.1.0";

/**
 * Every child runs without the caller's `GIT_*` variables: the pre-push hook runs this suite with
 * `GIT_DIR` exported (this checkout is a linked worktree), and an inherited `GIT_DIR` would point the
 * probe's `git init` — and the script's own `git tag`/`git push` — at the real repository.
 */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}
// The record step refuses a shell with no database credentials, and this suite must not inherit a
// real branch's. Cases that want the recorder opt in explicitly.
for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "NEON_BRANCH", "RELEASE_CI_WINDOW"]) {
  delete CHILD_ENV[key];
}

const ENTRY = `## [${VERSION}] - 2026-11-14

### Added

- \`chore(release)\` — the cut re-records the platform health

### Known limits

- the probe is the whole tree`;

const CHANGELOG = `# Changelog

${ENTRY}

[${VERSION}]: https://example.test/releases/tag/v${VERSION}
`;

/**
 * The recorder, played by a shim: it logs its argv and writes the record the case wants.
 *
 * `PNPM_FAKE_WRITE=0` is the recorder that exits 0 having written nothing — the failure mode that a
 * "did the command exit 0?" check cannot see.
 */
const PNPM_SHIM = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$PNPM_FAKE_LOG"
if [ "$PNPM_FAKE_EXIT" != "0" ]; then
  printf 'fake recorder: db:verify could not reach the branch\\n' >&2
  exit "$PNPM_FAKE_EXIT"
fi
if [ "$PNPM_FAKE_WRITE" = "1" ]; then
  mkdir -p data/health
  cat > data/health/platform-health.json <<JSON
{
  "schemaVersion": 1,
  "recordedAt": "$(date -u +%FT%TZ)",
  "recorder": "pnpm health:record",
  "dbVerify": { "database": "demo branch (probe)", "result": "pass", "violations": [] },
  "gate": { "lane": "code", "seconds": 1 },
  "production": { "state": "answering", "version": "$PNPM_FAKE_VERSION" },
  "tree": {
    "packageVersion": "$PNPM_FAKE_VERSION",
    "latestTag": "$PNPM_FAKE_TAG",
    "headSha": "$PNPM_FAKE_SHA",
    "mainSha": "$PNPM_FAKE_SHA",
    "measuredAt": "$(date -u +%FT%TZ)"
  }
}
JSON
fi
exit 0
`;

interface Probe {
  root: string;
  repo: string;
  bin: string;
  pnpmLog: string;
  sha: string;
  limits: string;
}

const probes: string[] = [];

afterEach(() => {
  while (probes.length > 0) {
    const root = probes.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function git(repo: string, ...args: string[]): void {
  execFileSync("git", args, { cwd: repo, stdio: "ignore", env: CHILD_ENV });
}

function gitOut(repo: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, env: CHILD_ENV, encoding: "utf8" }).trim();
}

/** A tree shaped like a prepared release: `main` at the version `package.json` carries, plus an origin. */
function probe(): Probe {
  const root = mkdtempSync(join(tmpdir(), "release-record-step-"));
  probes.push(root);

  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const pnpmLog = join(root, "pnpm-argv.log");
  const limits = join(root, "limits.md");

  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(bin);
  for (const file of ["release.sh", "release-version.mjs", "release-record.mjs"]) {
    cpSync(join(ROOT, "scripts", file), join(repo, "scripts", file));
  }
  writeFileSync(join(repo, "scripts", "verify.sh"), "#!/usr/bin/env bash\nexit 0\n", {
    mode: 0o755,
  });
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify({ name: "probe", version: VERSION }, null, 2)}\n`,
  );
  writeFileSync(join(repo, "CHANGELOG.md"), CHANGELOG);
  writeFileSync(limits, "- nothing is stored: the probe serves fixtures.\n");
  chmodSync(join(repo, "scripts", "release.sh"), 0o755);

  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env bash
case "$1 $2" in
  "release create") ;;
  "release view") printf '%s|false|false|https://example.test/releases/tag/%s\\n' "$3" "$3" ;;
esac
`,
    { mode: 0o755 },
  );
  writeFileSync(join(bin, "pnpm"), PNPM_SHIM, { mode: 0o755 });

  git(repo, "init", "-q", "-b", "main", ".");
  git(repo, "config", "user.email", "probe@example.test");
  git(repo, "config", "user.name", "probe");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", `probe ${VERSION}`);

  const origin = join(root, "origin.git");
  git(root, "init", "-q", "--bare", origin);
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-q", "-u", "origin", "main");

  return { root, repo, bin, pnpmLog, sha: gitOut(repo, "rev-parse", "HEAD"), limits };
}

interface Fake {
  version?: string;
  tag?: string;
  sha?: string;
  exit?: number;
  write?: boolean;
  credentials?: boolean;
}

/** Run the real script in the probe tree, with the `gh` and `pnpm` shims first on PATH. */
function release(p: Probe, args: string[], fake: Fake = {}) {
  const env: NodeJS.ProcessEnv = {
    ...CHILD_ENV,
    PATH: `${p.bin}${delimiter}${process.env.PATH ?? ""}`,
    PNPM_FAKE_LOG: p.pnpmLog,
    PNPM_FAKE_VERSION: fake.version ?? VERSION,
    PNPM_FAKE_TAG: fake.tag ?? `v${VERSION}`,
    PNPM_FAKE_SHA: fake.sha ?? p.sha,
    PNPM_FAKE_EXIT: String(fake.exit ?? 0),
    PNPM_FAKE_WRITE: fake.write === false ? "0" : "1",
  };
  if (fake.credentials === true) env.DATABASE_URL = "postgres://demo@example.test/neondb";
  return spawnSync("bash", ["scripts/release.sh", ...args], { cwd: p.repo, env, encoding: "utf8" });
}

const pnpmCalls = (p: Probe): string =>
  existsSync(p.pnpmLog) ? readFileSync(p.pnpmLog, "utf8") : "";

const healthRecord = (p: Probe) => join(p.repo, "data", "health", "platform-health.json");

const tagsOnOrigin = (p: Probe): string => gitOut(p.repo, "ls-remote", "--tags", "origin");

describe("--tag-only holds the platform record to the version it tagged", () => {
  it("fails the cut when the recorder writes a record naming the previous version", () => {
    const p = probe();

    const run = release(p, ["--tag-only", VERSION], {
      credentials: true,
      version: PREVIOUS,
      tag: `v${PREVIOUS}`,
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      `tree.packageVersion — the record names ${PREVIOUS}, not ${VERSION}`,
    );
    expect(run.stderr).toContain(`tree.latestTag — the record names v${PREVIOUS}, not v${VERSION}`);
    expect(run.stderr).toContain(`the record this cut wrote does not name v${VERSION}`);
    // The tag was published before the record step ran: this is not a pre-tag check (#961).
    expect(tagsOnOrigin(p)).toContain(`refs/tags/v${VERSION}`);
    // And the script never edits the record itself — the recorder is the only writer.
    expect(JSON.parse(readFileSync(healthRecord(p), "utf8")).tree.packageVersion).toBe(PREVIOUS);
  });

  it("passes when the record names this version, its tag, and the commit the tag sits on", () => {
    const p = probe();

    const run = release(p, ["--tag-only", VERSION], { credentials: true });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      `the record names v${VERSION} at ${p.sha.slice(0, 7)} — land it as its own pull request`,
    );
    expect(run.stdout).toContain("chore(health): re-record platform health at v1.1.1");
    expect(pnpmCalls(p)).toMatch(/^health:record --db --gate --carry --ci \d{4}-\d{2}-\d{2}$/m);
    expect(JSON.parse(readFileSync(healthRecord(p), "utf8")).tree.packageVersion).toBe(VERSION);
  });

  it("fails when the recorder exits 0 without writing a record", () => {
    const p = probe();

    const run = release(p, ["--tag-only", VERSION], { credentials: true, write: false });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("is not readable as JSON");
    expect(run.stderr).toContain(`the record this cut wrote does not name v${VERSION}`);
    expect(existsSync(healthRecord(p))).toBe(false);
  });

  it("fails when the recorder itself fails, naming the command to re-run", () => {
    const p = probe();

    const run = release(p, ["--tag-only", VERSION], { credentials: true, exit: 1 });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("the recorder exited non-zero");
    expect(run.stderr).toContain("pnpm health:record --db --gate --carry --ci");
  });
});

describe("--no-record is an escape that is not silent", () => {
  it("publishes the tag, runs no recorder, prints the command, and exits 0", () => {
    const p = probe();

    const run = release(p, ["--tag-only", VERSION, "--no-record"]);

    expect(run.status).toBe(0);
    expect(pnpmCalls(p)).toBe(""); // the recorder never ran: no credentials in this shell
    expect(run.stdout).toContain("record (skipped by --no-record — the cut is published");
    expect(run.stdout).toContain("pnpm health:record --db --gate --carry --ci");
    expect(run.stdout).toContain(
      'git commit -m "chore(health): re-record platform health at v1.1.1"',
    );
    expect(run.stdout).toContain("names the previous release as current");
    expect(tagsOnOrigin(p)).toContain(`refs/tags/v${VERSION}`);
  });

  it("refuses to run the recorder with no demo credentials, naming both ways out", () => {
    const p = probe();

    const run = release(p, ["--tag-only", VERSION]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("carries no DATABASE_URL");
    expect(run.stderr).toContain("withenv.sh");
    expect(run.stderr).toContain("--no-record");
    expect(pnpmCalls(p)).toBe("");
    expect(tagsOnOrigin(p)).toContain(`refs/tags/v${VERSION}`);
  });

  it("is a usage error on a mode that has no record step", () => {
    const p = probe();

    const run = release(p, ["--check", "--no-record"]);

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("--no-record belongs to --tag-only");
  });
});
