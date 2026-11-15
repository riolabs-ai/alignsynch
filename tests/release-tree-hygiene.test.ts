/**
 * A cut leaves the checkout it ran in as it found it — proved by running the script, not by reading it.
 *
 * Measured 2026-11-14: the primary checkout was found **detached** at `7a531b43`
 * (`chore(release): 1.16.0`) with `origin/main` three commits ahead. From that tree `git push`
 * moved nothing, `release_boundary.py` read "0 commits since the tag" and labelled the next cut a
 * patch, and `package.json` carried `1.16.0` while production served `1.18.0`. The reflog's newest
 * two lines were `checkout: moving from main to HEAD` and `main: Reset to origin/main` — a cut that
 * detached a working tree and never put the branch back.
 *
 * So this file asks the only question that matters about the fix: after the script has run — to
 * success, to a red gate, and through Ctrl-C — is the checkout still on the branch it started on?
 * Each case builds a throwaway tree (the real `release.sh`, the real classifier, a `package.json`,
 * a `CHANGELOG.md`, a bare origin, and a `verify.sh` and `gh` the case controls) and runs it.
 *
 *   1. the three refusals fire by name — detached HEAD, a dirty tree, a release commit that does
 *      not contain `origin/main` — and each leaves the checkout exactly where it was;
 *   2. a completed cut is still on `main` and clean afterwards, and it did land its commit;
 *   3. a red gate leaves `main` and a clean tree behind;
 *   4. a step that detaches the tree (the shape that produced the defect) is put back by the trap;
 *   5. SIGINT mid-run leaves the same state, which is the case no `git switch` at the end covers.
 *
 * `verify.sh` is stubbed — the gate is not what this file tests, and one case below detaches the
 * tree on purpose. `gh` is a shim on `PATH`. Nothing here touches the repository's own
 * `package.json`, `CHANGELOG.md` or tags.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERSION = "1.1.0";
const NEXT = "1.1.1";

/**
 * Every child runs without the caller's `GIT_*` variables: the pre-push hook runs this suite with
 * `GIT_DIR` exported (this checkout is a linked worktree), and an inherited `GIT_DIR` would point
 * the probe's `git init` — and the script's own `git tag`/`git push` — at the real repository.
 */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}

const ENTRY = `## [${VERSION}] - 2026-11-13

### Added

- \`feat(release)\` — the probe cuts a version

### Known limits

- the probe is the whole tree`;

const CHANGELOG = `# Changelog

${ENTRY}

[${VERSION}]: https://example.test/releases/tag/v${VERSION}
`;

/** What the stubbed gate does. `detach` is the defect this file exists to prevent. */
type Gate = "green" | "red" | "detach" | "sleep";

interface Probe {
  root: string;
  repo: string;
  bin: string;
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

/** `main`, or `HEAD` when the checkout is detached. */
const branchOf = (repo: string) => gitOut(repo, "rev-parse", "--abbrev-ref", "HEAD");
const shaOf = (repo: string) => gitOut(repo, "rev-parse", "HEAD");
const porcelain = (repo: string) => gitOut(repo, "status", "--porcelain");

const GATE_BODIES: Record<Gate, string> = {
  green: "exit 0\n",
  red: "exit 1\n",
  // The historical shape: something in the run switches the checkout to a floating commit.
  detach: "git switch --quiet --detach HEAD >/dev/null 2>&1 || true\nexit 1\n",
  sleep: "sleep 30\n",
};

/**
 * A tree shaped like a release candidate: `main` at the version `package.json` carries, a green
 * (or not) gate, and a bare `origin` the cut can push a commit and a tag to.
 */
function probe({ gate = "green" }: { gate?: Gate } = {}): Probe {
  const root = mkdtempSync(join(tmpdir(), "release-hygiene-"));
  probes.push(root);

  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const limits = join(root, "limits.md");

  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(bin);
  for (const file of ["release.sh", "release-version.mjs"]) {
    cpSync(join(ROOT, "scripts", file), join(repo, "scripts", file));
  }
  writeFileSync(join(repo, "scripts", "verify.sh"), `#!/usr/bin/env bash\n${GATE_BODIES[gate]}`, {
    mode: 0o755,
  });
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify({ name: "probe", version: VERSION }, null, 2)}\n`,
  );
  writeFileSync(join(repo, "CHANGELOG.md"), CHANGELOG);
  writeFileSync(limits, "- nothing is stored: the probe serves fixtures.\n");

  // A prepended script, not a wrapper: it has to be what `gh` resolves to on PATH, and it answers
  // `release view` in the four-field form the script reads (`tag|draft|prerelease|url`).
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
  chmodSync(join(repo, "scripts", "release.sh"), 0o755);

  git(repo, "init", "-q", "-b", "main", ".");
  git(repo, "config", "user.email", "probe@example.test");
  git(repo, "config", "user.name", "probe");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "probe init");

  const origin = join(root, "origin.git");
  git(root, "init", "-q", "--bare", origin);
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-q", "-u", "origin", "main");

  return { root, repo, bin, limits };
}

function envFor(p: Probe): NodeJS.ProcessEnv {
  return { ...CHILD_ENV, PATH: `${p.bin}${delimiter}${process.env.PATH ?? ""}` };
}

function release(p: Probe, args: string[]) {
  return spawnSync("bash", ["scripts/release.sh", ...args], {
    cwd: p.repo,
    env: envFor(p),
    encoding: "utf8",
  });
}

/** Push a commit to `origin/main` that local `main` does not have: HEAD stops containing it. */
function pushRemoteOnlyCommit(p: Probe): void {
  const other = join(p.root, "other");
  git(p.root, "clone", "-q", "-b", "main", join(p.root, "origin.git"), other);
  git(other, "config", "user.email", "probe@example.test");
  git(other, "config", "user.name", "probe");
  writeFileSync(join(other, "remote-only.txt"), "only on origin\n");
  git(other, "add", "-A");
  git(other, "commit", "-qm", "chore: only on origin");
  git(other, "push", "-q", "origin", "main");
}

describe("the cut refuses a checkout it cannot cut from, and leaves it alone", () => {
  it("refuses a detached HEAD, naming the command that fixes it", () => {
    const p = probe();
    git(p.repo, "switch", "--quiet", "--detach", "HEAD");

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("HEAD is detached at");
    expect(run.stderr).toContain("git switch main");
    // Refused before anything was written: still detached, still clean, no tag.
    expect(branchOf(p.repo)).toBe("HEAD");
    expect(porcelain(p.repo)).toBe("");
    expect(gitOut(p.repo, "tag", "--list")).toBe("");
  });

  it("refuses a dirty tree, and names the paths", () => {
    const p = probe();
    writeFileSync(join(p.repo, "wip.txt"), "work in progress\n");

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("the tree is dirty");
    expect(run.stderr).toContain("wip.txt");
    expect(run.stderr).toContain("git stash");
    expect(branchOf(p.repo)).toBe("main");
    expect(porcelain(p.repo)).toBe("?? wip.txt"); // the file is still there, never discarded
    expect(gitOut(p.repo, "tag", "--list")).toBe("");
  });

  it("still refuses with more dirty paths than it lists, rather than dying on SIGPIPE", () => {
    // `printf … | head -5` under `pipefail` is how a gate in this repo once failed at random: head
    // exits, the upstream printf dies of SIGPIPE, and the pipeline's 141 becomes the exit status —
    // so a tree with six dirty paths would leave half a refusal behind and an unreadable code.
    const p = probe();
    for (let i = 0; i < 8; i += 1) writeFileSync(join(p.repo, `wip-${i}.txt`), "work\n");

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("the tree is dirty");
    expect(run.stderr).toContain("commit or 'git stash' those paths");
    const listed = run.stderr.match(/^ {2}\?\? wip-\d\.txt$/gm) ?? [];
    expect(listed.length).toBe(10); // five in the refusal, five in the exit report — never all eight
    expect(branchOf(p.repo)).toBe("main");
    expect(gitOut(p.repo, "tag", "--list")).toBe("");
  });

  it("refuses a commit that does not contain origin/main", () => {
    const p = probe();
    pushRemoteOnlyCommit(p);
    const before = shaOf(p.repo);

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("does not contain origin/main");
    expect(run.stderr).toContain("pull --ff-only");
    expect(branchOf(p.repo)).toBe("main");
    expect(shaOf(p.repo)).toBe(before);
    expect(porcelain(p.repo)).toBe("");
    expect(gitOut(p.repo, "tag", "--list")).toBe("");
  });
});

describe("the cut leaves the checkout as it found it", () => {
  it("ends on the branch it started on, clean, with the release commit landed", () => {
    const p = probe();
    const before = shaOf(p.repo);

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.stderr).not.toContain("release: ");
    expect(run.status).toBe(0);
    expect(branchOf(p.repo)).toBe("main");
    expect(porcelain(p.repo)).toBe("");
    expect(shaOf(p.repo)).not.toBe(before);
    expect(gitOut(p.repo, "log", "-1", "--format=%s")).toBe(`chore(release): ${NEXT}`);
    expect(run.stdout).toContain(`the checkout is on main at ${shaOf(p.repo).slice(0, 7)}`);
    expect(run.stdout).toContain("advanced it from");
  });

  it("still ends on main when the gate is red", () => {
    const p = probe({ gate: "red" });
    const before = shaOf(p.repo);

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("the gate is red");
    expect(branchOf(p.repo)).toBe("main");
    expect(shaOf(p.repo)).toBe(before);
    expect(porcelain(p.repo)).toBe("");
    expect(run.stdout).toContain("as it was found");
  });

  it("puts the branch back when a step inside the run detaches it", () => {
    const p = probe({ gate: "detach" });

    const run = release(p, [NEXT, "--limits", p.limits]);

    expect(run.status).toBe(1);
    expect(branchOf(p.repo)).toBe("main");
    expect(run.stdout).toContain("put back on main");
    expect(porcelain(p.repo)).toBe("");
  });

  it("puts the branch back when the run is interrupted (SIGINT)", async () => {
    const p = probe({ gate: "sleep" });
    const child = spawn("bash", ["scripts/release.sh", NEXT, "--limits", p.limits], {
      cwd: p.repo,
      env: envFor(p),
      detached: true, // its own process group, so the signal reaches the gate stub too
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (out += d.toString()));

    await new Promise((r) => setTimeout(r, 1500));
    process.kill(-(child.pid as number), "SIGINT");
    const code = await new Promise<number | null>((r) => child.on("close", r));

    expect(code).toBe(130);
    expect(branchOf(p.repo)).toBe("main");
    expect(porcelain(p.repo)).toBe("");
    expect(gitOut(p.repo, "tag", "--list")).toBe("");
    expect(out).toContain("the checkout is on main");
  }, 20_000);
});
