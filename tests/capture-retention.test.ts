/**
 * THE `docs/qa/` RETENTION RULE (#1024), pinned rule by rule.
 *
 * `docs/qa/` was 81 directories and 118.85 MB governed by nothing: `docs:check`'s only invariant is
 * *every `.md` is indexed*, and a capture directory with no page is outside it by construction. Each
 * group below pins one part of the answer, in the order a reader meets it:
 *
 *   1. **`classify()` — the window, pure.** One case per way a directory can be **kept** (an open
 *      issue, a pointer, the current release, the previous release) and one per way it can be
 *      **retired** (an issue-named directory with no open issue behind it, a release outside the
 *      window, and a directory nothing names at all). The boundary case — the third-newest release
 *      — is the one that matters: a window with no boundary is a number in a comment. The switch
 *      case proves each rule is a rule and not a fact the caller cannot turn off.
 *   2. **`releaseVersion()` / `issueOf()` — the spellings.** Three release namings have been used on
 *      this shelf and four issue ones; a rule that recognised one would silently archive the rest.
 *   3. **`registerRows()` — the register.** `docs/qa/RETENTION.md`'s table is the machine-readable
 *      half of the page: the one fact the gate cannot derive offline is *is that issue open*, so it
 *      is a claim here and the check reads it back.
 *   4. **`captureProblems()` — what the gate names**, one case per failure: a capture nobody
 *      registered, an `archived` row whose directory is still here (the half-applied prune), a
 *      `keep` row whose directory is gone, a keep with no evidence, a weight that drifted, a claim
 *      about the wrong issue, and a duplicated row.
 *   5. **the real script against a sandbox tree** — exit 1 naming the unregistered directory, exit 1
 *      naming the directory an `archived` row still has on disk, exit 0 once both are settled.
 *   6. **the committed tree** — zero problems, so the gate is green on precisely what this card
 *      ships, and the register carries a row for every directory on disk.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  CAPTURE_ROOT,
  KEEP_RELEASES,
  REGISTER,
  captureDirs,
  captureProblems,
  classify,
  classifyTree,
  issueOf,
  registerRows,
  releaseVersion,
  retentionState,
} from "../scripts/capture-retention.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "capture-retention.mjs");
const RELEASES = ["1.19.0", "1.18.0", "1.17.1"];

const sandboxes: string[] = [];

afterEach(() => {
  while (sandboxes.length > 0) {
    const dir = sandboxes.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("classify — the window is the rule, in order", () => {
  it("keeps a capture an open issue claims", () => {
    const verdict = classify("975-d12", { openIssue: 975, releases: RELEASES });

    expect(verdict.fate).toBe("keep");
    expect(verdict.rule).toBe("open-issue");
    expect(verdict.reason).toContain("#975");
  });

  it("keeps a capture a shipped file names", () => {
    const verdict = classify("payment", {
      pointers: ["docs/changelog/v1-10-0.md", "tests/payment.test.ts"],
      releases: RELEASES,
    });

    expect(verdict.fate).toBe("keep");
    expect(verdict.rule).toBe("pointer");
    // The reason has to be actionable: a reviewer reads which file to open before deleting.
    expect(verdict.reason).toContain("docs/changelog/v1-10-0.md");
    expect(verdict.reason).toContain("1 other file");
  });

  it("keeps the current release cut", () => {
    const verdict = classify("release-1.19.0", { releases: RELEASES });

    expect(verdict.fate).toBe("keep");
    expect(verdict.rule).toBe("release");
    expect(verdict.reason).toContain("current release");
  });

  it("keeps the previous release cut, in the pre-move spelling", () => {
    const verdict = classify("v1-18-0", { releases: RELEASES });

    expect(verdict.fate).toBe("keep");
    expect(verdict.rule).toBe("release");
    expect(verdict.reason).toContain("previous release");
  });

  it("archives the third-newest release — the window has a boundary", () => {
    const verdict = classify("release-1.17.1", { releases: RELEASES });

    expect(verdict.fate).toBe("archive");
    expect(verdict.reason).toContain("1.17.1");
    expect(verdict.reason).toContain("window");
    // The window is a number in one place, and this is what keeps it honest.
    expect(KEEP_RELEASES).toBe(2);
  });

  it("archives a directory nothing names, whatever it is called", () => {
    const verdict = classify("home-v2", { releases: RELEASES });

    expect(verdict.fate).toBe("archive");
    expect(verdict.rule).toBe("archive");
    expect(verdict.reason).toContain("nothing in the tree names it");
  });

  it("archives an issue-named directory with no claim behind it", () => {
    // The issue number in a name is not a claim that the issue is open — `542` and `906` were both
    // named after closed issues, and they went. Only the register asserts the state.
    const verdict = classify("906", { pointers: [], releases: RELEASES });

    expect(verdict.fate).toBe("archive");
  });

  it("is governed by the window it is handed, not by the constants", () => {
    // Each rule can be switched off, which is what "a rule" means: with the pointer rule down, a
    // capture with a pointer and nothing else is archived — the evidence is the only thing saving it.
    const off = classify("payment", { pointers: ["app/globals.css"] }, { pointered: false });

    expect(off.fate).toBe("archive");
    expect(classify("payment", { pointers: ["app/globals.css"] }).fate).toBe("keep");
  });
});

describe("releaseVersion / issueOf — every spelling the shelf has used", () => {
  it("reads all three release namings", () => {
    expect(releaseVersion("release-1.17.0")).toBe("1.17.0");
    expect(releaseVersion("v1-15-0")).toBe("1.15.0");
    expect(releaseVersion("v1.18.0")).toBe("1.18.0");
  });

  it("is not fooled by a name that merely contains a number", () => {
    expect(releaseVersion("swiper-12")).toBeNull();
    expect(releaseVersion("979-flow-entries")).toBeNull();
    expect(releaseVersion("stage5")).toBeNull();
  });

  it("reads the issue a directory is named for, prefix and suffix", () => {
    expect(issueOf("975")).toBe(975);
    expect(issueOf("975-d12")).toBe(975);
    expect(issueOf("979-flow-entries")).toBe(979);
    expect(issueOf("surface-sweep-913")).toBe(913);
    expect(issueOf("admin-audit")).toBeNull();
  });
});

describe("registerRows — the table is the machine-readable half of the page", () => {
  it("reads a code-spanned directory, its weight, its fate and an open-issue claim", () => {
    const markdown = [
      "| directory | weight | fate | why it stays (or went) |",
      "| --------- | ------ | ---- | ---------------------- |",
      "| `975-d12` | 1.41 MB | keep | open issue #975 — kept while that issue is open |",
      "| `home-v2` | 3.22 MB | archived | the home page — no open issue, no pointer, no release cut |",
    ].join("\n");

    const rows = registerRows(markdown);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "975-d12", fate: "keep", openIssue: 975 });
    expect(rows[1]).toMatchObject({ name: "home-v2", fate: "archived", openIssue: null });
  });

  it("ignores prose, the header and any table with another shape", () => {
    const markdown = [
      "A sentence that mentions `docs/qa/payment` and is not a row.",
      "| command | what it does |",
      "| ------- | ------------ |",
      "| `pnpm docs:check` | fails |",
    ].join("\n");

    expect(registerRows(markdown)).toEqual([]);
  });
});

describe("captureProblems — the gate's named failures", () => {
  const capture = (name: string, bytes = 1024) => ({ name, bytes, files: 1 });
  const row = (name: string, fate: "keep" | "archived", why = "a reason") => ({
    name,
    weight: "0.00 MB",
    fate,
    why,
    openIssue: null,
  });

  it("names a capture nobody registered", () => {
    const problems = captureProblems({
      captures: [capture("home-v2")],
      rows: [],
      pointers: new Map(),
      releases: RELEASES,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${CAPTURE_ROOT}/home-v2`);
    expect(problems[0]).toContain(REGISTER);
    expect(problems[0]).toContain("qa:retention:prune");
  });

  it("names a directory an `archived` row still has on disk — the half-applied prune", () => {
    const problems = captureProblems({
      captures: [capture("home-v2")],
      rows: [row("home-v2", "archived")],
      pointers: new Map(),
      releases: RELEASES,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("archived and the directory is still here");
  });

  it("names a `keep` row whose directory is gone", () => {
    const problems = captureProblems({
      captures: [],
      rows: [row("payment", "keep")],
      pointers: new Map(),
      releases: RELEASES,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("is not on disk");
  });

  it("names a keep the rule cannot justify", () => {
    const problems = captureProblems({
      captures: [capture("home-v2")],
      rows: [{ ...row("home-v2", "keep"), weight: "0.00 MB" }],
      pointers: new Map([["home-v2", []]]),
      releases: RELEASES,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("unjustified");
  });

  it("names a weight that drifted from the disk", () => {
    const problems = captureProblems({
      captures: [capture("payment", 3 * 1024 * 1024)],
      rows: [{ ...row("payment", "keep"), weight: "2.00 MB", openIssue: null }],
      pointers: new Map([["payment", ["app/globals.css"]]]),
      releases: RELEASES,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("is 3.00 MB on disk");
    expect(problems[0]).toContain("2.00 MB");
  });

  it("names a claim about an issue the directory is not named for", () => {
    const problems = captureProblems({
      captures: [capture("home-v2")],
      rows: [{ ...row("home-v2", "keep"), why: "open issue #975", openIssue: 975 }],
      pointers: new Map(),
      releases: RELEASES,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not the issue its name carries");
  });

  it("names a duplicated row — once is the rule", () => {
    const problems = captureProblems({
      captures: [],
      rows: [row("payment", "keep"), row("payment", "keep")],
      pointers: new Map(),
      releases: RELEASES,
    });

    expect(problems.some((problem) => problem.includes("two rows"))).toBe(true);
  });
});

describe("the script against a sandbox tree", () => {
  /**
   * The two directories the sandbox fabricates. Named as constants and joined through
   * `CAPTURE_ROOT`, so the suite never writes a literal `docs/qa/<name>` path into the tree — a
   * grep for a capture that resolves (`git grep -n "docs/qa" -- ':!docs'`) must not be answered by
   * a fixture name that only exists in a temp directory.
   */
  const KEEP = "keep-me";
  const UNJUSTIFIED = "unjustified";

  /** A tree with one capture, one file that names it, and the register the case needs. */
  function sandbox({ register, capture }: { register: string; capture: boolean }): string {
    const root = mkdtempSync(join(tmpdir(), "capture-retention-"));
    sandboxes.push(root);
    mkdirSync(join(root, CAPTURE_ROOT, KEEP), { recursive: true });
    writeFileSync(join(root, CAPTURE_ROOT, KEEP, "README.md"), "# A capture a comment names\n");
    writeFileSync(join(root, "app-note.ts"), `// see \`${CAPTURE_ROOT}/${KEEP}/README.md\`\n`);
    if (capture) mkdirSync(join(root, CAPTURE_ROOT, UNJUSTIFIED), { recursive: true });
    writeFileSync(join(root, REGISTER), register);
    return root;
  }

  function run(root: string) {
    return spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
  }

  const registered = [
    "| directory | weight | fate | why it stays (or went) |",
    "| --------- | ------ | ---- | ---------------------- |",
    "| `keep-me` | 0.00 MB | keep | cited by `app-note.ts` |",
    "",
  ].join("\n");

  it("fails naming the capture nobody registered", () => {
    const root = sandbox({ register: registered, capture: true });
    const result = run(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${CAPTURE_ROOT}/unjustified: no row in ${REGISTER}`);
  });

  it("fails naming the directory an `archived` row still has on disk", () => {
    const root = sandbox({
      register: `${registered}| \`unjustified\` | 0.00 MB | archived | a capture that went |\n`,
      capture: true,
    });
    const result = run(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("archived and the directory is still here");
  });

  it("is green once the tree agrees with the register", () => {
    const root = sandbox({
      register: `${registered}| \`unjustified\` | 0.00 MB | archived | a capture that went |\n`,
      capture: false,
    });
    const result = run(root);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 capture(s) in docs/qa");
  });
});

describe("the committed tree", () => {
  it("is green: every capture on disk is justified and measured", () => {
    const { problems, summary } = retentionState(ROOT);

    expect(problems).toEqual([]);
    expect(summary.captures).toBeGreaterThan(0);
    expect(summary.archived).toBe(0);
  });

  it("registers every directory on disk exactly once", () => {
    const markdown = readFileSync(join(ROOT, REGISTER), "utf8");
    const rows = registerRows(markdown);
    const kept = rows.filter((row) => row.fate === "keep").map((row) => row.name);
    const onDisk = captureDirs(ROOT).map((capture) => capture.name);

    expect(new Set(kept).size).toBe(kept.length);
    expect(kept.sort()).toEqual(onDisk.sort());
  });

  it("reaches the same verdict from the tree as the register records", () => {
    const { verdicts } = classifyTree({ root: ROOT });
    const rows = registerRows(readFileSync(join(ROOT, REGISTER), "utf8"));
    const keptRows = rows.filter((row) => row.fate === "keep").map((row) => row.name);

    expect(
      [...verdicts.values()]
        .filter((v) => v.fate === "keep")
        .map((v) => v.name)
        .sort(),
    ).toEqual(keptRows.sort());
  });
});
