/**
 * `scripts/tree-hygiene.mjs` — the writer table, the porcelain parser and the report, pinned.
 *
 * Why a test rather than a demo: the script's whole claim is *"this path was written by a tool, and
 * here is the command that clears it"*. A wrong row is worse than no row — it sends an operator to
 * `git checkout --` a file a human was editing — so each group below holds one half of that claim:
 *
 *   1. **the table** — every path the brief names resolves to a writer and a clearing command, and
 *      the matching is exact where it must be: `AGENTS.md` at the root is a tool's file, while
 *      `docs/AGENTS.md` is somebody's work and must stay unknown.
 *   2. **the unknown verdict** — a path no rule owns prints `unknown writer` and no clearing
 *      command. Never a guess, never an empty cell that reads like "nothing to do".
 *   3. **the porcelain parser** — `git status --porcelain -z`'s four shapes the brief names (`M`,
 *      `A`, `??`, `D`) plus a rename (which is two records, not an arrow) and a path with a space in
 *      it. The parser is also what proves `M ` and ` M` are one word, not two.
 *   4. **the real script, end to end, against a sandbox repository** — the exact defect state
 *      (`M AGENTS.md` + `?? CLAUDE.md`) exits **0**, names both writers, and answers `--json` with
 *      one object per path and `--count` with `2`; a clean repository reports clean and still exits
 *      0. A reporter that failed on dirt would fail every card's gate, so the exit code is a
 *      contract here and not an implementation detail.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  attribute,
  describeCode,
  lookupWriter,
  normalisePath,
  parsePorcelain,
  renderTable,
  UNKNOWN_WRITER,
  WRITER_RULES,
} from "../scripts/tree-hygiene.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = join(REPO, "scripts", "tree-hygiene.mjs");

/**
 * A probe child never inherits the caller's `GIT_*` variables. The pre-push hook exports `GIT_DIR`
 * (this checkout is a linked worktree), and an inherited one points a sandbox's `git init` and
 * `git add` at the repository being pushed from instead of at the throwaway tree — which is not a
 * hypothetical: this file's first run under the hook committed a stub `AGENTS.md` over the real one.
 * `tests/md-normalised.test.ts` carries the same guard, added for the same hook.
 */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}

const sandboxes: string[] = [];

afterEach(() => {
  for (const dir of sandboxes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync(
    "git",
    ["-c", "user.email=test@local", "-c", "user.name=test", ...args],
    {
      cwd,
      encoding: "utf8",
      env: CHILD_ENV,
    },
  );
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

/** A repository with this script in it, so the script's own ROOT is the sandbox. */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "tree-hygiene-"));
  sandboxes.push(dir);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  copyFileSync(SCRIPT, join(dir, "scripts", "tree-hygiene.mjs"));
  git(dir, "init", "-q");
  writeFileSync(join(dir, "AGENTS.md"), "# AGENTS.md\n");
  // The script is committed too: the sandbox must be clean before a test dirties it, or the
  // report would carry the script's own untracked directory as a third path.
  git(dir, "add", "AGENTS.md", "scripts/tree-hygiene.mjs");
  git(dir, "commit", "-qm", "base");
  return dir;
}

function run(dir: string, ...flags: string[]) {
  const result = spawnSync("node", [join(dir, "scripts", "tree-hygiene.mjs"), ...flags], {
    cwd: dir,
    encoding: "utf8",
    env: CHILD_ENV,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("the writer table", () => {
  it("names a writer and a clearing command for every path the brief lists", () => {
    const expected: [string, RegExp][] = [
      ["AGENTS.md", /next dev/i],
      ["CLAUDE.md", /gitnexus analyze/i],
      [".claude/settings.json", /gitnexus analyze/i],
      [".agents/skills/gitnexus-cli/SKILL.md", /gitnexus analyze/i],
      [".next/BUILD_ID", /next dev/i],
      ["data/generated/quizzes.ts", /pnpm gen/],
      ["docs/glossary.md", /gen-glossary|pnpm glossary/i],
      ["docs/changelog/v1-22-0.md", /changelog-view|pnpm changelog/i],
      ["docs/ui-registry.md", /ui:registry|gen-ui-registry/i],
    ];
    for (const [path, writer] of expected) {
      const rule = lookupWriter(path);
      expect(rule, `${path} has no rule`).not.toBeNull();
      expect(rule?.writer).toMatch(writer);
      expect(rule?.clear.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("names both AGENTS.md writers, because next dev and gitnexus both rewrite it", () => {
    const rule = lookupWriter("AGENTS.md");
    expect(rule?.writer).toMatch(/next dev/);
    expect(rule?.writer).toMatch(/gitnexus/);
  });

  it("is exact at the root: a nested AGENTS.md is somebody's work, not next dev's", () => {
    expect(lookupWriter("docs/AGENTS.md")).toBeNull();
    expect(lookupWriter("app/(mainlayout)/AGENTS.md")).toBeNull();
  });

  it("matches a directory rule at every depth beneath it, and the directory itself", () => {
    expect(lookupWriter(".claude")).not.toBeNull();
    expect(lookupWriter(".claude/skills/gitnexus-cli/SKILL.md")).not.toBeNull();
    // A prefix is not a match: `.claude.json` is a different file.
    expect(lookupWriter(".claude.json")).toBeNull();
    expect(lookupWriter(".agentsrc")).toBeNull();
  });

  it("does not let a directory rule leak into a sibling with a shared prefix", () => {
    expect(lookupWriter(".nextjs")).toBeNull();
    expect(lookupWriter("data/generated-notes.md")).toBeNull();
  });

  it("has no row that can never fire and no two rows that claim one path", () => {
    const seen = new Map<string, string>();
    for (const rule of WRITER_RULES) {
      expect(rule.clear.length, `${rule.path} prints no clearing command`).toBeGreaterThan(0);
      const key = rule.kind === "glob" ? String(rule.path) : rule.path;
      expect(seen.has(key), `${key} is claimed twice`).toBe(false);
      seen.set(key, rule.writer);
    }
  });
});

describe("the unknown verdict", () => {
  it("says `unknown writer` for a path no rule owns, and prints no command", () => {
    const row = attribute({ code: " M", path: "lib/quiz-cards.ts" });
    expect(row.writer).toBe(UNKNOWN_WRITER);
    expect(row.known).toBe(false);
    expect(row.clear).toMatch(/human decides/);
  });

  it("never guesses from a file extension", () => {
    expect(lookupWriter("docs/some-page.md")).toBeNull();
    expect(lookupWriter("data/generated-notes.ts")).toBeNull();
  });

  it("attributes a known path with its status word and its clearing command", () => {
    const row = attribute({ code: "??", path: "./CLAUDE.md" });
    expect(row).toMatchObject({ path: "CLAUDE.md", status: "untracked", known: true });
    expect(row.writer).toMatch(/gitnexus analyze/);
    expect(row.clear).toMatch(/^rm CLAUDE.md/);
  });
});

describe("the porcelain parser", () => {
  it("reads the four shapes the brief names: M, A, ?? and D", () => {
    const raw = [" M AGENTS.md", "A  data/new.ts", "?? CLAUDE.md", " D docs/old.md", ""].join("\0");
    expect(parsePorcelain(raw)).toEqual([
      { code: " M", path: "AGENTS.md" },
      { code: "A ", path: "data/new.ts" },
      { code: "??", path: "CLAUDE.md" },
      { code: " D", path: "docs/old.md" },
    ]);
  });

  it("reads a rename as two records, not as an ` -> ` arrow in one path", () => {
    const raw = ["R  docs/new.md", "docs/old.md", ""].join("\0");
    expect(parsePorcelain(raw)).toEqual([{ code: "R ", path: "docs/new.md", from: "docs/old.md" }]);
  });

  it("keeps a path with a space in it intact", () => {
    expect(parsePorcelain("?? a file with spaces.md\0")).toEqual([
      { code: "??", path: "a file with spaces.md" },
    ]);
  });

  it("returns nothing for a clean tree", () => {
    expect(parsePorcelain("")).toEqual([]);
    expect(parsePorcelain("\0")).toEqual([]);
  });

  it("reads `M ` and ` M` as one word — the pair is the status, the column is not", () => {
    expect(describeCode(" M")).toBe("modified");
    expect(describeCode("M ")).toBe("modified");
    expect(describeCode("MM")).toBe("modified");
    expect(describeCode("A ")).toBe("added");
    expect(describeCode(" D")).toBe("deleted");
    expect(describeCode("??")).toBe("untracked");
    expect(describeCode("R ")).toBe("renamed");
    expect(describeCode("UU")).toBe("unmerged");
  });

  it("normalises a `./` prefix and a trailing slash, and leaves a root-relative path alone", () => {
    expect(normalisePath("./AGENTS.md")).toBe("AGENTS.md");
    expect(normalisePath(".claude/")).toBe(".claude");
    expect(normalisePath("docs/glossary.md")).toBe("docs/glossary.md");
  });
});

describe("the table the operator reads", () => {
  it("says clean when nothing changed", () => {
    expect(renderTable([])).toMatch(/clean/);
  });

  it("counts the tool-written rows apart from the unknown ones", () => {
    const text = renderTable([
      attribute({ code: " M", path: "AGENTS.md" }),
      attribute({ code: "??", path: "lib/mine.ts" }),
    ]);
    expect(text).toContain("2 changed path(s)");
    expect(text).toContain("1 written by a tool");
    expect(text).toContain(UNKNOWN_WRITER);
    expect(text).toContain("git checkout -- AGENTS.md");
    expect(text).toMatch(/printed, never run/);
  });
});

describe("the script against a sandbox repository", () => {
  it("attributes the two-path defect state and exits 0", () => {
    const dir = sandbox();
    // The real defect: next dev rewrites the managed block, gitnexus writes CLAUDE.md.
    writeFileSync(join(dir, "AGENTS.md"), "# AGENTS.md\n\n<!-- END:nextjs-agent-rules -->\n");
    writeFileSync(join(dir, "CLAUDE.md"), "# CLAUDE.md\n");

    const first = run(dir);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("2 changed path(s)");
    expect(first.stdout).toContain("AGENTS.md");
    expect(first.stdout).toContain("next dev");
    expect(first.stdout).toContain("CLAUDE.md");
    expect(first.stdout).toContain("gitnexus analyze");

    expect(run(dir, "--count").stdout.trim()).toBe("2");

    const rows = JSON.parse(run(dir, "--json").stdout) as { path: string; known: boolean }[];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.path).sort()).toEqual(["AGENTS.md", "CLAUDE.md"]);
    expect(rows.every((row) => row.known)).toBe(true);
  });

  it("reports a clean tree and still exits 0", () => {
    const dir = sandbox();
    const clean = run(dir);
    expect(clean.status, clean.stderr).toBe(0);
    expect(clean.stdout).toMatch(/clean/);
    expect(run(dir, "--count").stdout.trim()).toBe("0");
    expect(JSON.parse(run(dir, "--json").stdout)).toEqual([]);
  });

  it("keeps this branch's own work out of the tool-written report", () => {
    const dir = sandbox();
    writeFileSync(join(dir, "CLAUDE.md"), "# CLAUDE.md\n");
    writeFileSync(join(dir, "feature.ts"), "export const x = 1;\n");

    const known = run(dir, "--known-only");
    expect(known.status, known.stderr).toBe(0);
    expect(known.stdout).toContain("CLAUDE.md");
    expect(known.stdout).not.toContain("feature.ts");
    expect(known.stdout).toMatch(/no known writer/);
    // The full report still carries it, attributed honestly.
    expect(run(dir).stdout).toContain("feature.ts");
    expect(run(dir).stdout).toContain(UNKNOWN_WRITER);
  });

  it("fails only when git cannot be read, never because the tree is dirty", () => {
    const dir = sandbox();
    writeFileSync(join(dir, "CLAUDE.md"), "# CLAUDE.md\n");
    expect(run(dir).status).toBe(0);

    const outside = mkdtempSync(join(tmpdir(), "tree-hygiene-nogit-"));
    sandboxes.push(outside);
    mkdirSync(join(outside, "scripts"), { recursive: true });
    copyFileSync(SCRIPT, join(outside, "scripts", "tree-hygiene.mjs"));
    const result = run(outside);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/git status could not be read/);
  });
});
