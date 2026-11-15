/**
 * The entry classifier reads this repo's own commit subjects — proved by running `release.sh`.
 *
 * A release entry is generated from `git log`, and the section a bullet lands in is decided by
 * the subject's conventional prefix. The prefix rule used to accept only the `: ` the convention
 * specifies, while most of this repo's subjects are `feat(flow) · #979 B — …` (middot) and a
 * handful are `feat(admin) — …` (em dash). Measured on the v1.19.0 window that produced an entry
 * with **no `### Added` at all** over four feature commits: the prefix came back empty, the class
 * fell through to Maintenance, and the published Release body (the entry, byte for byte)
 * understated a minor.
 *
 * Each case below is a real subject from this history, run through the real script in a throwaway
 * git repo, and the file pins three things at once:
 *
 *   1. classification — `feat`/`fix`, with or without a scope, land in Added/Fixed whichever of
 *      the three separators (`: `, ` · `, ` — `) the merge used; everything else is Maintenance;
 *   2. rendering — the prefix prints the same way for every separator, `` - `feat(flow)` — text ``,
 *      so an entry reads identically whichever style the commit used;
 *   3. `entry_text()` stability — the words are the subject minus the separator it found, minus a
 *      *trailing* ` (#123)` only. That is the half `release:check` compares on, so a careless
 *      change here makes a correct entry read as missing.
 *
 * Nothing is re-implemented: `--dry-run` is the mode a cut uses to print its entry, and it is the
 * same `subject_prefix`/`subject_text`/`bullet` path the cut writes with.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";

const ROOT = process.cwd();

/**
 * Every child runs without the caller's `GIT_*` variables: the pre-push hook runs the gate from a
 * linked worktree with `GIT_DIR` exported, and an inherited `GIT_DIR` would point this probe's
 * `git init` — and the script's own `git log` — at the real repository.
 */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}
// The script calls `node` for its version classifier; resolve the node running this test, not
// whatever the ambient PATH happens to hold.
CHILD_ENV.PATH = `${dirname(process.execPath)}:${CHILD_ENV.PATH ?? ""}`;

const SUBJECTS = [
  // middot — the separator most merges in this repo use
  "feat(flow) · #979 B — every wizard-route entry opens the flow in place (#1007)",
  "fix(seed) · #975 the seeded relationship now says what its own session says (#985)",
  "chore(qa) · publish the refreshed v1.17.1 atlas (77/74/71) and make a capture refuse a version mismatch (#983) (#990)",
  // em dash — the second separator; four commits on main are written this way
  "feat(admin) — /admin/docs gains a features index and a release shelf, both derived (#893) (#978)",
  "fix(shell) — the surface registry calls create and answer live, because they are (#485)",
  // colon — the conventional form, which must keep classifying exactly as it did
  "feat(billing): stage 5 buys the membership: a real subscription, a 7-day trial (#1012)",
  "docs: reorganise docs/ into a by-question tree (#965)",
  // not conventional at all — no separator to strip, and no prefix to render
  'Revert "the nav greys" (#99)',
];

/** Every bullet the entry must carry, in the section it must carry it in. Nothing else. */
const EXPECTED: { section: string; bullet: string }[] = [
  {
    section: "Added",
    bullet: "- `feat(flow)` — #979 B — every wizard-route entry opens the flow in place",
  },
  {
    section: "Fixed",
    bullet: "- `fix(seed)` — #975 the seeded relationship now says what its own session says",
  },
  {
    section: "Maintenance",
    bullet:
      "- `chore(qa)` — publish the refreshed v1.17.1 atlas (77/74/71) and make a capture refuse a version mismatch (#983)",
  },
  {
    section: "Added",
    bullet:
      "- `feat(admin)` — /admin/docs gains a features index and a release shelf, both derived (#893)",
  },
  {
    section: "Fixed",
    bullet: "- `fix(shell)` — the surface registry calls create and answer live, because they are",
  },
  {
    section: "Added",
    bullet: "- `feat(billing)` — stage 5 buys the membership: a real subscription, a 7-day trial",
  },
  { section: "Maintenance", bullet: "- `docs` — reorganise docs/ into a by-question tree" },
  { section: "Maintenance", bullet: '- Revert "the nav greys"' },
];

const probes: string[] = [];

after(() => {
  while (probes.length > 0) {
    const dir = probes.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repo, env: CHILD_ENV, encoding: "utf8" });
}

/**
 * A throwaway repo holding the real script and one commit per subject, with `v1.0.0` on the
 * initial commit so `--dry-run` generates over exactly the subjects above and nothing else.
 */
function probe(): string {
  const repo = mkdtempSync(join(tmpdir(), "release-classifier-"));
  probes.push(repo);
  mkdirSync(join(repo, "scripts"), { recursive: true });
  cpSync(join(ROOT, "scripts", "release.sh"), join(repo, "scripts", "release.sh"));
  cpSync(
    join(ROOT, "scripts", "release-version.mjs"),
    join(repo, "scripts", "release-version.mjs"),
  );
  writeFileSync(join(repo, "package.json"), '{\n  "name": "probe",\n  "version": "1.0.0"\n}\n');
  writeFileSync(
    join(repo, "CHANGELOG.md"),
    [
      "# Changelog",
      "",
      "## [1.0.0] - 2026-01-01",
      "",
      "### Known limits",
      "",
      "- the probe is the whole tree",
      "",
      "[1.0.0]: https://example.test/releases/tag/v1.0.0",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(repo, "limits.md"),
    "- the probe is the whole tree, so every other surface is out of scope\n",
  );

  git(repo, ["init", "--quiet", "-b", "main"]);
  git(repo, ["config", "user.email", "probe@example.test"]);
  git(repo, ["config", "user.name", "Probe"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  git(repo, ["config", "tag.gpgsign", "false"]);
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "--quiet", "-m", "chore: the probe starts here"]);
  git(repo, ["tag", "-a", "v1.0.0", "-m", "v1.0.0"]);
  for (const subject of SUBJECTS) {
    git(repo, ["commit", "--quiet", "--allow-empty", "-m", subject]);
  }
  return repo;
}

function dryRun(repo: string): string {
  const run = spawnSync(
    "bash",
    ["scripts/release.sh", "--dry-run", "1.1.0", "--limits", "limits.md"],
    {
      cwd: repo,
      env: CHILD_ENV,
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, `release.sh --dry-run exited ${run.status}: ${run.stderr}`);
  return run.stdout;
}

/** `### Added` -> ["- …", …]; a section the entry does not emit is absent from the map. */
function sections(entry: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of entry.split("\n")) {
    if (line.startsWith("### ")) {
      current = line.slice(4).trim();
      found.set(current, []);
      continue;
    }
    if (current && line.startsWith("- ")) found.get(current)?.push(line);
  }
  return found;
}

describe("scripts/release.sh — the entry classifier reads this repo's own subjects", () => {
  it("files feat/fix under Added/Fixed whichever separator the merge used", () => {
    const entry = dryRun(probe());
    const found = sections(entry);
    assert.deepEqual(
      [...found.keys()],
      ["Added", "Fixed", "Maintenance", "Known limits"],
      `the entry did not emit the three commit sections:\n${entry}`,
    );
    for (const { section, bullet } of EXPECTED) {
      assert.ok(
        found.get(section)?.includes(bullet),
        `${section} is missing ${bullet}\n---\n${entry}`,
      );
    }
  });

  it("renders one bullet per commit and no bullet but the expected ones", () => {
    const entry = dryRun(probe());
    const found = sections(entry);
    const bullets = [...found.entries()]
      .filter(([section]) => section !== "Known limits")
      .flatMap(([, lines]) => lines);
    // Nothing dropped, nothing duplicated — the count is the commit count — and every line is
    // byte-identical to what this file expects, which is what makes a rendering change visible.
    assert.equal(bullets.length, SUBJECTS.length, entry);
    assert.deepEqual(bullets.slice().sort(), EXPECTED.map((e) => e.bullet).sort(), entry);
  });

  it("strips only the trailing (#123) from the words, and keeps an older one", () => {
    const entry = dryRun(probe());
    // The PR marker is the *last* ` (#N)` in the subject: `(#983) (#990)` keeps the subject's own
    // reference and loses only `(#990)` — `release:check` compares on exactly these words, so a
    // change here would make a correct entry read as missing.
    for (const marker of ["#990", "#978", "#1007", "#985", "#485", "#1012", "#965", "#99"]) {
      assert.ok(!entry.includes(`(${marker})`), `${marker} survived as a PR marker:\n${entry}`);
    }
    // …and the subject's own parenthesised words are not eaten with it.
    assert.ok(entry.includes("(77/74/71) and make a capture refuse"), entry);
    assert.ok(entry.includes("both derived (#893)"), entry);
  });
});
