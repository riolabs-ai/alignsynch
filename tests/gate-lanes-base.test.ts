/**
 * The lane classifier's diff base (`scripts/gate-lanes.sh`).
 *
 * `resolve_lane` diffs `$GATE_REF...HEAD`, so a missing base is a reason to run the FULL
 * gate — that safety net does not move. What moves here is the *ability to see* the base: a
 * fresh worktree or clone usually has no `origin/main` even though the remote is one bounded
 * `git fetch` away, and a docs-only card that pays 90 s of `next build` is exactly what the
 * lanes exist to drop.
 *
 * Every case below is measured against a real throwaway git repository, because the thing
 * under test **is** git. The fetch is counted through a shell function named `git` that logs
 * `fetch` and then delegates, so "it fetched once" and "it did not fetch at all" are
 * observations, not readings of the code:
 *
 *   local ref                  -> lane=docs, 0 fetches
 *   ref absent, remote alive   -> lane=docs, 1 fetch, and the sha is printed
 *   ref absent, no remote      -> lane=code, full gate (conservative), 0 fetches
 *   ref absent, remote broken  -> lane=code, full gate (conservative), 1 failed fetch
 *   GATE_REF override absent   -> lane=code, and an override is never fetched
 *   resolve_lane twice         -> still 1 fetch (the base is cached for the run)
 *   a code path                -> lane=code with the base resolved
 *   no changes vs the base     -> lane=code, "no changed files"
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const GATE_LANES = fileURLToPath(new URL("../scripts/gate-lanes.sh", import.meta.url));

const CLEANED = new Set<string>();

function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (/^(GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_COMMON_DIR|GATE_)/.test(k)) continue;
    env[k] = v;
  }
  const merged: Record<string, string> = {
    ...env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "Gate Test",
    GIT_AUTHOR_EMAIL: "gate@test.invalid",
    GIT_COMMITTER_NAME: "Gate Test",
    GIT_COMMITTER_EMAIL: "gate@test.invalid",
    ...extra,
  };
  return merged as unknown as NodeJS.ProcessEnv;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: cleanEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

type Fixture = { root: string; work: string; fetches: string; bin: string };

const REAL_GIT = execFileSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).trim();

/**
 * A `git` on PATH that logs every `fetch` and then delegates. `timeout` execs `git` as a
 * program, so a shell function inside the sourced script cannot see the fetch — only a real
 * executable ahead of the real git can.
 */
function gitStub(root: string): string {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "git"),
    [
      "#!/usr/bin/env bash",
      'if [ "$1" = fetch ]; then printf "fetch\\n" >> "$GATE_TEST_FETCH_LOG"; fi',
      `exec ${JSON.stringify(REAL_GIT)} "$@"`,
    ].join("\n"),
    { mode: 0o755 },
  );
  return bin;
}

/** A bare `upstream` plus a clone of it on `main`, one commit deep. */
function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "gate-lanes-"));
  CLEANED.add(root);
  const upstream = join(root, "upstream.git");
  const work = join(root, "work");
  git(root, "init", "--bare", "-b", "main", upstream);
  git(root, "clone", upstream, work);
  writeFileSync(join(work, "README.md"), "# base\n");
  git(work, "add", "README.md");
  git(work, "commit", "-m", "base");
  git(work, "push", "-u", "origin", "main");
  const fetches = join(root, "fetches.log");
  return { root, work, fetches, bin: gitStub(root) };
}

function commit(work: string, path: string, body = "changed\n"): void {
  const file = join(work, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, body);
  git(work, "add", path);
  git(work, "commit", "-m", `add ${path}`);
}

function fetchCount(f: Fixture): number {
  try {
    return readFileSync(f.fetches, "utf8").split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

type Resolution = {
  lane: string;
  how: string;
  base: string;
  reason: string;
  fetches: number;
  stdout: string;
  stderr: string;
  status: number | null;
};

function resolve(
  f: Fixture,
  opts: { resolves?: number; env?: Record<string, string> } = {},
): Resolution {
  const script = [
    "set -euo pipefail",
    '. "$GATE_TEST_LANES"',
    'i=0; while [ "$i" -lt "$GATE_TEST_RESOLVES" ]; do resolve_lane; i=$((i + 1)); done',
    'printf "LANE=%s\\n" "$LANE"',
    'printf "HOW=%s\\n" "$GATE_BASE_HOW"',
    'printf "BASE=%s\\n" "${GATE_BASE_REF:-}"',
    'printf "REASON=%s\\n" "$LANE_REASON"',
  ].join("\n");

  const out = spawnSync("bash", ["-c", script], {
    cwd: f.work,
    encoding: "utf8",
    env: cleanEnv({
      PATH: `${f.bin}:${process.env.PATH ?? ""}`,
      GATE_TEST_LANES: GATE_LANES,
      GATE_TEST_FETCH_LOG: f.fetches,
      GATE_TEST_RESOLVES: String(opts.resolves ?? 1),
      ...opts.env,
    }),
  });

  const field = (name: string): string => {
    const line = (out.stdout ?? "").split("\n").find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1) : "";
  };

  return {
    lane: field("LANE"),
    how: field("HOW"),
    base: field("BASE"),
    reason: field("REASON"),
    fetches: fetchCount(f),
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
    status: out.status,
  };
}

afterAll(() => {
  for (const dir of CLEANED) rmSync(dir, { recursive: true, force: true });
});

describe("gate-lanes base resolution", () => {
  it("classifies against a local origin/main and never touches the network", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");

    const r = resolve(f);

    expect(r.status).toBe(0);
    expect(r.lane).toBe("docs");
    expect(r.how).toBe("local");
    expect(r.fetches).toBe(0);
    expect(r.reason).toMatch(/base origin\/main@[0-9a-f]{7} \(local ref\)/);
  });

  it("fetches the base once when the ref is absent, and names the sha and the fetch", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");
    git(f.work, "update-ref", "-d", "refs/remotes/origin/main");
    expect(() => git(f.work, "rev-parse", "--verify", "origin/main")).toThrow();

    const r = resolve(f);

    expect(r.status).toBe(0);
    expect(r.lane).toBe("docs");
    expect(r.how).toBe("fetched");
    expect(r.fetches).toBe(1);
    expect(r.reason).toMatch(/base origin\/main@[0-9a-f]{7} \(fetched in \d+\.\ds\)/);
    // The ref is back, so the next step in the same run (and the next card) sees it.
    expect(git(f.work, "rev-parse", "--verify", "origin/main")).toMatch(/[0-9a-f]{40}/);
  });

  it("does not move the working tree or the branch when it fetches", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");
    git(f.work, "update-ref", "-d", "refs/remotes/origin/main");

    const before = {
      branch: git(f.work, "rev-parse", "--abbrev-ref", "HEAD").trim(),
      head: git(f.work, "rev-parse", "HEAD").trim(),
      status: git(f.work, "status", "--porcelain", "-uall"),
    };

    expect(resolve(f).how).toBe("fetched");

    expect(git(f.work, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe(before.branch);
    expect(git(f.work, "rev-parse", "HEAD").trim()).toBe(before.head);
    expect(git(f.work, "status", "--porcelain", "-uall")).toBe(before.status);
  });

  it("falls back to the full gate, out loud, when there is no remote to fetch from", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");
    git(f.work, "update-ref", "-d", "refs/remotes/origin/main");
    git(f.work, "remote", "remove", "origin");

    const r = resolve(f);

    expect(r.status).toBe(0);
    expect(r.lane).toBe("code");
    expect(r.how).toBe("");
    expect(r.fetches).toBe(0);
    expect(r.reason).toMatch(/no writable 'origin' remote to fetch origin\/main from/);
    expect(r.reason).toMatch(/full gate \(conservative\)/);
  });

  it("falls back to the full gate when the remote exists but the fetch fails", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");
    git(f.work, "update-ref", "-d", "refs/remotes/origin/main");
    git(f.work, "remote", "set-url", "origin", join(f.root, "gone.git"));

    const r = resolve(f);

    expect(r.status).toBe(0);
    expect(r.lane).toBe("code");
    expect(r.how).toBe("");
    expect(r.fetches).toBe(1);
    expect(r.reason).toMatch(/fetching origin\/main failed \(git exit \d+\)/);
    expect(r.reason).toMatch(/full gate \(conservative\)/);
  });

  it("never fetches a ref the caller named", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");

    const r = resolve(f, { env: { GATE_REF: "origin/does-not-exist" } });

    expect(r.lane).toBe("code");
    expect(r.fetches).toBe(0);
    expect(r.reason).toMatch(/GATE_REF=origin\/does-not-exist is an override and is never fetched/);
    expect(r.reason).toMatch(/full gate \(conservative\)/);
  });

  it("resolves the base once for the life of a run", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");
    git(f.work, "update-ref", "-d", "refs/remotes/origin/main");

    const r = resolve(f, { resolves: 3 });

    expect(r.lane).toBe("docs");
    expect(r.fetches).toBe(1);
  });

  it("still runs the full gate for a code path", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "code-only");
    commit(f.work, "components/thing.tsx", "export const thing = 1;\n");

    const r = resolve(f);

    expect(r.lane).toBe("code");
    expect(r.how).toBe("local");
    expect(r.reason).toMatch(/1 changed file\(s\) · base origin\/main@[0-9a-f]{7}/);
  });

  it("still runs the full gate when nothing differs from the base", () => {
    const f = fixture();

    const r = resolve(f);

    expect(r.lane).toBe("code");
    expect(r.reason).toMatch(
      /no changed files vs origin\/main@[0-9a-f]{7} \(local ref\) — full gate/,
    );
  });

  it("does not fetch the base for GATE_LANE=full", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");
    git(f.work, "update-ref", "-d", "refs/remotes/origin/main");

    const r = resolve(f, { env: { GATE_LANE: "full" } });

    expect(r.lane).toBe("code");
    expect(r.how).toBe("forced");
    expect(r.base).toBe("");
    expect(r.fetches).toBe(0);
  });

  it("hands GATE_LANE=full the local base for the whitespace check, without a fetch", () => {
    const f = fixture();
    git(f.work, "switch", "-c", "docs-only");
    commit(f.work, "docs/note.md");

    const r = resolve(f, { env: { GATE_LANE: "full" } });

    expect(r.lane).toBe("code");
    expect(r.how).toBe("forced");
    expect(r.base).toBe("origin/main");
    expect(r.fetches).toBe(0);
  });
});
