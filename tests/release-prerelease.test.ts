/**
 * A pre-release passes the release gate and publishes as one, proved by running the script.
 *
 * `scripts/release.sh` is the procedure (`docs/RELEASING.md`), so the question "can we cut an RC?"
 * is not answered by reading it. Each case below builds a throwaway tree — `release.sh`, the
 * classifier, a `package.json`, a `CHANGELOG.md`, and a one-line `verify.sh` stub — and runs the
 * real script against it:
 *
 *   1. `--check` is green when the newest entry is `## [1.1.0-rc1]`, and red when that entry is
 *      gone, with the message naming the disagreement rather than the check being skipped;
 *   2. `--dry-run 1.1.0-rc1` exits 0, prints the entry, and its command block carries
 *      `--prerelease` and the line the entry would be inserted at;
 *   3. `--tag-only` hands `--prerelease` to `gh release create` and reads `isPrerelease` back —
 *      and fails when the flag did not take;
 *   4. the footer (`[1.1.0-rc1]: <url>`) never becomes part of the entry above it, so it is never
 *      part of the release notes;
 *   5. a final version is published as a final release, not marked pre-release.
 *
 * The gate step and `gh` are the two pieces a probe tree cannot have: `verify.sh` is stubbed to
 * exit 0 (the gate is not what this file tests) and `gh` is a shim on `PATH` that records its
 * argv and its notes file. Nothing here touches the repository's own `package.json`, `CHANGELOG.md`
 * or tags.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
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
const RC = "1.1.0-rc1";

/**
 * Every child runs without the caller's `GIT_*` variables.
 *
 * A probe is a *standalone* repository, and a `GIT_DIR` inherited from the caller would point the
 * probe's `git init`/`commit` — but also the script's own `git tag` and `git push` — at the
 * repository being pushed from. That is not hypothetical: the pre-push hook runs this suite with
 * `GIT_DIR` exported (this checkout is a linked worktree), so the probe and the script would both
 * have committed and tagged the real repository instead of the throwaway one.
 */
const CHILD_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "test",
};
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}

/** The entry as `release.sh` writes it: heading, sections, and a Known limits block with bullets. */
const RC_ENTRY = `## [1.1.0-rc1] - 2026-10-31

### Added

- \`feat(release)\` — the script cuts a pre-release

### Known limits

- the probe is the whole tree`;

const FINAL_ENTRY = RC_ENTRY.replace(`[${RC}]`, "[1.1.0]");

const FOOTER = `[${RC}]: https://example.test/compare/v1.0.0...v${RC}
[1.0.0]: https://example.test/releases/tag/v1.0.0`;

const CHANGELOG = `# Changelog

${RC_ENTRY}

## [1.0.0] - 2026-10-30

### Known limits

- nothing here is real

${FOOTER}
`;

/** The same tree with the pre-release entry never written: the version and the file disagree. */
const CHANGELOG_WITHOUT_RC = `# Changelog

## [1.0.0] - 2026-10-30

### Known limits

- nothing here is real

[1.0.0]: https://example.test/releases/tag/v1.0.0
`;

interface Probe {
  root: string;
  repo: string;
  bin: string;
  ghLog: string;
  ghNotes: string;
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

/**
 * A tree shaped like the RC commit, with `gh` replaced by a shim that records its argv and the
 * notes file it was handed. `remote: true` adds the bare origin `--tag-only` fetches from.
 */
function probe({
  version = RC,
  changelog = CHANGELOG,
  entry = RC_ENTRY,
  remote = false,
}: {
  version?: string;
  changelog?: string;
  entry?: string;
  remote?: boolean;
} = {}): Probe {
  const root = mkdtempSync(join(tmpdir(), "release-probe-"));
  probes.push(root);

  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const ghLog = join(root, "gh-argv.log");
  const ghNotes = join(root, "gh-notes.md");
  const limits = join(root, "limits.md");

  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(bin);
  for (const file of ["release.sh", "release-version.mjs"]) {
    cpSync(join(ROOT, "scripts", file), join(repo, "scripts", file));
  }
  writeFileSync(join(repo, "scripts", "verify.sh"), "#!/usr/bin/env bash\nexit 0\n", {
    mode: 0o755,
  });
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify({ name: "probe", version }, null, 2)}\n`,
  );
  writeFileSync(join(repo, "CHANGELOG.md"), changelog);
  writeFileSync(limits, "- nothing is stored: the probe serves fixtures.\n");

  // A prepended script, not a wrapper: the shim has to be what `gh` resolves to on PATH, and it
  // answers `release view` in the four-field form the script reads (`tag|draft|prerelease|url`).
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$GH_FAKE_LOG"
case "$1 $2" in
  "release create")
    shift 2
    while [ $# -gt 0 ]; do
      case "$1" in --notes-file) cp "$2" "$GH_FAKE_NOTES" ;; esac
      shift
    done
    ;;
  "release view")
    printf '%s|false|%s|https://example.test/releases/tag/%s\\n' "$3" "$GH_FAKE_PRERELEASE" "$3"
    ;;
esac
`,
    { mode: 0o755 },
  );
  chmodSync(join(repo, "scripts", "release.sh"), 0o755);

  git(repo, "init", "-q", "-b", "main", ".");
  git(repo, "config", "user.email", "probe@example.test");
  git(repo, "config", "user.name", "probe");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", `probe ${version}`);

  if (remote) {
    const origin = join(root, "origin.git");
    git(root, "init", "-q", "--bare", origin);
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "-u", "origin", "main");
  }

  expect(entry).toContain("Known limits"); // the constants above stay in step with each other
  return { root, repo, bin, ghLog, ghNotes, limits };
}

/** Run the real script in the probe tree, with the `gh` shim first on PATH. */
function release(p: Probe, args: string[], prerelease = "true") {
  const env: NodeJS.ProcessEnv = {
    ...CHILD_ENV,
    PATH: `${p.bin}${delimiter}${process.env.PATH ?? ""}`,
    GH_FAKE_LOG: p.ghLog,
    GH_FAKE_NOTES: p.ghNotes,
    GH_FAKE_PRERELEASE: prerelease,
  };
  return spawnSync("bash", ["scripts/release.sh", ...args], { cwd: p.repo, env, encoding: "utf8" });
}

describe("--check on a tree that carries a pre-release", () => {
  it("is green when the newest entry is the pre-release package.json carries", () => {
    const run = release(probe(), ["--check"]);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("package.json version 1.1.0-rc1 is the newest CHANGELOG entry");
  });

  it("is red — and says which two things disagree — when the entry is not there", () => {
    const run = release(probe({ changelog: CHANGELOG_WITHOUT_RC }), ["--check"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      "package.json is at 1.1.0-rc1 but the newest CHANGELOG entry is [1.0.0]",
    );
  });

  it("still refuses an entry that lost its Known limits block", () => {
    const run = release(
      probe({ changelog: `# Changelog\n\n${RC_ENTRY.split("### Known")[0]}\n` }),
      ["--check"],
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("entry [1.1.0-rc1] has no '### Known limits' bullets");
  });
});

describe("--dry-run for a pre-release", () => {
  it("exits 0, prints the entry, and would publish it with --prerelease", () => {
    const p = probe();
    const run = release(p, ["--dry-run", RC, "--limits", p.limits]);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`## [${RC}] - `);
    expect(run.stdout).toContain("- nothing is stored: the probe serves fixtures.");
    expect(run.stderr).toContain("--prerelease");
    // The entry goes in above the pre-release, which is the newest one — not above 1.0.0.
    expect(run.stderr).toContain("at line 3, above [1.1.0-rc1]");
  });

  it("refuses the malformed versions a looser pattern would let through", () => {
    const p = probe();
    for (const version of ["1.1.0.0", "1.1", "v1.1.0"]) {
      const run = release(p, ["--dry-run", version, "--limits", p.limits]);
      expect(run.status, version).toBe(2);
      expect(run.stderr).toContain(`'${version}' is not a semantic version`);
    }
  });
});

describe("--tag-only for a pre-release", () => {
  it("publishes with --prerelease and reads the flag back", () => {
    const p = probe({ remote: true });
    const run = release(p, ["--tag-only", RC]);

    expect(run.status).toBe(0);
    expect(run.stderr).not.toContain("release:");
    const argv = readFileSync(p.ghLog, "utf8");
    expect(argv).toMatch(/^release create v1\.1\.0-rc1 .*--prerelease$/m);
    expect(argv).toContain("--json tagName,isDraft,isPrerelease,url");
    expect(run.stdout).toContain("prerelease=true");

    // The notes are the entry, byte for byte: heading, sections, limits — and no footer, no `## [1.0.0]`.
    const notes = readFileSync(p.ghNotes, "utf8");
    expect(notes).toBe(`${RC_ENTRY}\n`);
    expect(notes).not.toContain("example.test");
  });

  it("fails when the flag did not take, instead of calling the cut done", () => {
    const run = release(probe({ remote: true }), ["--tag-only", RC], "false");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("isPrerelease=false, expected true");
  });

  it("keeps the pre-release footer out of the notes of the entry above it", () => {
    // The last entry in the file is the one a footer can leak into: `[1.1.0-rc1]: <url>` right
    // below it. A parser that only understood `[x.y.z]: ` would append it to the notes.
    const changelog = `# Changelog\n\n${RC_ENTRY}\n\n[${RC}]: https://example.test/releases/tag/v${RC}\n`;
    const p = probe({ changelog, remote: true });
    const run = release(p, ["--tag-only", RC]);

    expect(run.status).toBe(0);
    expect(readFileSync(p.ghNotes, "utf8")).toBe(`${RC_ENTRY}\n`);
  });

  it("publishes a final version as a final release", () => {
    const changelog = `# Changelog\n\n${FINAL_ENTRY}\n\n[1.1.0]: https://example.test/releases/tag/v1.1.0\n`;
    const p = probe({ version: "1.1.0", changelog, entry: FINAL_ENTRY, remote: true });
    const run = release(p, ["--tag-only", "1.1.0"], "false");

    expect(run.status).toBe(0);
    const argv = readFileSync(p.ghLog, "utf8");
    expect(argv).toMatch(/^release create v1\.1\.0 .*$/m);
    expect(argv).not.toContain("--prerelease");
  });
});
