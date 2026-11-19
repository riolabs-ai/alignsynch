/**
 * `pnpm release:postcheck` — the seven facts a completed cut must still be true, each one a case
 * (card t_244fc00a).
 *
 * Every case is against the pure `evaluate()` and the pure predicates, because the alternative is a
 * transcript nobody can re-run: the checks read git at a tag, `gh`, a live production endpoint and
 * two files on disk, so a test that exercised any of those would prove one machine and not the rule.
 * `gather()` does the I/O and takes no decision; `evaluate()` takes every decision and no I/O.
 *
 * Four groups, and the second and third are the ones that matter:
 *
 *   1. a completed cut passes all seven, so the verdict is not red on a healthy release;
 *   2. each check fails **alone** — seven cases, one red row each — so no check is shadowed by
 *      another, which is what a checker that only ever runs beside a worse failure can never prove;
 *   3. the **negative self-test**: `2.0.0-rc1.2` against a world that has moved to `2.0.0-rc1.3` is
 *      exit 1 with the failing checks named — a checker that only ever passes is not a checker;
 *   4. the known-flaky rule, so `reset and reseed the demo branch` is ⚠ with its URL and never a
 *      silent drop, and the parse of the CHANGELOG entry and its Known limits block.
 *
 * The CLI is spawned only for the two paths that touch nothing: `--help` and a usage error.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CHECK_NAMES,
  classifyCheckRuns,
  entryOf,
  evaluate,
  KNOWN_FLAKY,
  limitsArePlaceholder,
  limitsBullets,
  matchKnownFlaky,
  productionVerdict,
  render,
} from "../scripts/release-postcheck.mjs";

const CLI = fileURLToPath(new URL("../scripts/release-postcheck.mjs", import.meta.url));

const TAG_SHA = "94f3e8fd2f06d949af1720e42e8d821f58f09d14";
const LATER_SHA = "da332c3d992463fb19fada0b35419e7070180691";
const FLAKY_JOB = "reset and reseed the demo branch";
const RUN_URL = "https://github.com/riolabs-ai/alignsynch-web/actions/runs/44530480920/job/1";

type Run = { name: string; status?: string; conclusion: string | null; url: string | null };

type Evidence = {
  version: string;
  tagType: string | null;
  tagCommit: string | null;
  tagPackageVersion: string | null;
  originMain: string | null;
  containedInMain: boolean | null;
  release: {
    available: boolean;
    exists?: boolean;
    isDraft?: boolean;
    isPrerelease?: boolean;
    url?: string;
    reason?: string;
  };
  production: { ok: boolean; version?: string | null; commit?: string | null; error?: string };
  productionContainsTag: boolean | null;
  ci: { available: boolean; runs?: Run[]; reason?: string };
  limitsBullets: string[];
  entryFound: boolean;
  health: { packageVersion: string | null; latestTag: string | null; recordedAt: string | null };
};

/**
 * The `v2.0.0-rc1.3` cut as it actually stands: an annotated tag on `94f3e8f`, the bump in the
 * tagged tree, the tag an ancestor of `origin/main`, a published pre-release, production serving a
 * later commit that contains the tag, CI green except the demo reseed, a limits block and a record
 * naming the version.
 */
function clean(): Evidence {
  return {
    version: "2.0.0-rc1.3",
    tagType: "tag",
    tagCommit: TAG_SHA,
    tagPackageVersion: "2.0.0-rc1.3",
    originMain: LATER_SHA,
    containedInMain: true,
    release: {
      available: true,
      exists: true,
      isDraft: false,
      isPrerelease: true,
      url: "https://github.com/riolabs-ai/alignsynch-web/releases/tag/v2.0.0-rc1.3",
    },
    production: { ok: true, version: "2.0.0-rc1.3", commit: LATER_SHA },
    productionContainsTag: true,
    ci: {
      available: true,
      runs: [
        {
          name: "typecheck / lint / build",
          conclusion: "success",
          url: "https://github.com/run/1",
        },
        { name: "release note", conclusion: "success", url: "https://github.com/run/2" },
        { name: FLAKY_JOB, conclusion: "success", url: "https://github.com/run/3" },
      ],
    },
    limitsBullets: ["**The number is declared, and the census disagrees with it.**"],
    entryFound: true,
    health: {
      packageVersion: "2.0.0-rc1.3",
      latestTag: "v2.0.0-rc1.3",
      recordedAt: "2026-11-19T13:14:01.880Z",
    },
  };
}

const statuses = (evidence: Evidence) => evaluate(evidence).rows.map((row) => row.status);
const failed = (evidence: Evidence) => evaluate(evidence).failures.map((row) => row.n);

/* ------------------------------------------------------------------ *
 * 1 — a completed cut passes all seven
 * ------------------------------------------------------------------ */
describe("a completed cut passes all seven checks", () => {
  it("prints seven ✓ rows, in order, with no failure and no warning", () => {
    const result = evaluate(clean());
    expect(result.rows).toHaveLength(7);
    expect(result.rows.map((row) => row.key)).toEqual(CHECK_NAMES);
    expect(statuses(clean())).toEqual(Array(7).fill("ok"));
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("says so in one line, and says what it is not", () => {
    const transcript = render(evaluate(clean()), { version: "2.0.0-rc1.3" }).join("\n");
    expect(transcript).toContain("release:postcheck — v2.0.0-rc1.3");
    expect(transcript).toContain("verdict: 7 of 7 checks pass");
    expect(transcript).toContain("this is a verdict, not a gate");
    expect(transcript).toContain("a published tag is never");
    // No row is ✗. The footer names the glyph in prose ("a ✗ here is follow-up work"), so the
    // assertion is on the rows and not on the whole transcript.
    expect(transcript.split("\n").filter((line) => /^\s+✗/.test(line))).toEqual([]);
    expect(transcript).not.toContain("checks failed");
  });
});

/* ------------------------------------------------------------------ *
 * 2 — each check fails alone
 * ------------------------------------------------------------------ */
describe("each check fails alone, and names its remedy", () => {
  /**
   * `fails` is more than one row on check 1, and that is the honest answer rather than a leak: with
   * no tag there is no tagged tree to read (2) and no commit to place on main (3), so those checks
   * say they cannot be answered instead of passing. Every other case reddens exactly one row.
   */
  const cases: Array<{
    n: number;
    fails: number[];
    patch: (e: Evidence) => void;
    expect: string[];
  }> = [
    {
      n: 1,
      fails: [1, 2, 3],
      patch: (e) => {
        e.tagType = null;
        e.tagCommit = null;
        e.tagPackageVersion = null;
      },
      expect: ["no tag v", "--tag-only"],
    },
    {
      n: 2,
      fails: [2],
      patch: (e) => {
        e.tagPackageVersion = "2.0.0-rc1.2";
      },
      expect: ["the tagged package.json is 2.0.0-rc1.2", "cut the next version"],
    },
    {
      n: 3,
      fails: [3],
      patch: (e) => {
        e.containedInMain = false;
      },
      expect: ["is not contained in origin/main", "cut the next version from main"],
    },
    {
      n: 4,
      fails: [4],
      patch: (e) => {
        e.release.isPrerelease = false;
      },
      expect: ["isPrerelease=false", "--prerelease"],
    },
    {
      n: 5,
      fails: [5],
      patch: (e) => {
        e.production = { ok: true, version: "2.0.0-rc1.2", commit: LATER_SHA };
      },
      expect: ["production reports 2.0.0-rc1.2", "promote it"],
    },
    {
      n: 6,
      fails: [6],
      patch: (e) => {
        e.ci = {
          available: true,
          runs: [{ name: "typecheck / lint / build", conclusion: "failure", url: "https://r/9" }],
        };
      },
      expect: ["1 failed", "https://r/9", "a release ships a commit CI has read"],
    },
    {
      n: 7,
      fails: [7],
      patch: (e) => {
        e.health = { ...e.health, packageVersion: "2.0.0-rc1.2" };
      },
      expect: ["the health record names 2.0.0-rc1.2", "health:record"],
    },
  ];

  for (const { n, fails, patch, expect: expected } of cases) {
    it(`check ${n} (${CHECK_NAMES[n - 1]}) fails, and prints a fix`, () => {
      const evidence = clean();
      patch(evidence);
      const result = evaluate(evidence);
      expect(failed(evidence)).toEqual(fails);
      expect(result.ok).toBe(false);
      const rowText = result.rows[n - 1].value;
      const remedyText = String(result.rows[n - 1].remedy ?? "");
      for (const fragment of expected) {
        expect(`${rowText}\n${remedyText}`).toContain(fragment);
      }
    });
  }

  it("check 1 also fails a lightweight tag, which is not an annotated one", () => {
    const evidence = clean();
    evidence.tagType = "commit";
    expect(failed(evidence)).toEqual([1]);
    expect(evaluate(evidence).rows[0].value).toContain("lightweight tag");
  });

  it("check 4 fails a missing release and a draft, not just a wrong flag", () => {
    const missing = clean();
    missing.release = { available: true, exists: false };
    expect(failed(missing)).toEqual([4]);
    expect(evaluate(missing).rows[3].value).toContain("no GitHub release");

    const draft = clean();
    draft.release = { ...draft.release, isDraft: true };
    expect(failed(draft)).toEqual([4]);
    expect(evaluate(draft).rows[3].value).toContain("draft");
  });

  it("check 6 refuses a pending run and a commit nobody checked", () => {
    const pending = clean();
    pending.ci = {
      available: true,
      runs: [{ name: "typecheck / lint / build", conclusion: null, url: "https://r/1" }],
    };
    expect(failed(pending)).toEqual([6]);
    expect(evaluate(pending).rows[5].value).toContain("1 pending");

    const none = clean();
    none.ci = { available: true, runs: [] };
    expect(failed(none)).toEqual([6]);
    expect(evaluate(none).rows[5].value).toContain("no check has run");
  });

  it("an unverifiable check is a ✗, never a pass — gh missing, production silent", () => {
    const noGh = clean();
    noGh.release = { available: false, reason: "gh is not installed" };
    noGh.ci = { available: false, reason: "gh is not installed" };
    expect(failed(noGh)).toEqual([4, 6]);

    const noProd = clean();
    noProd.production = { ok: false, error: "timed out after 20s" };
    noProd.productionContainsTag = null;
    expect(failed(noProd)).toEqual([5]);
    expect(evaluate(noProd).rows[4].value).toContain("cannot read production");
  });
});

/* ------------------------------------------------------------------ *
 * 3 — the negative self-test: 1.2 in a world that moved to 1.3
 * ------------------------------------------------------------------ */
describe("a release that is no longer the live one fails, and says why", () => {
  /**
   * `2.0.0-rc1.2` is a real, well-formed cut: annotated tag, bump at the tag, on main, a published
   * pre-release, CI green. What it no longer is, is current — production and the health record have
   * moved to `2.0.0-rc1.3`. That is enough for exit 1, which is the whole point of the check.
   */
  function stale(): Evidence {
    const live = clean();
    live.version = "2.0.0-rc1.2";
    live.tagCommit = "1a7dd10c800bd032838961425bb0f881301cf1a8";
    live.tagPackageVersion = "2.0.0-rc1.2";
    live.health = {
      packageVersion: "2.0.0-rc1.3",
      latestTag: "v2.0.0-rc1.3",
      recordedAt: "2026-11-19T13:14:01.880Z",
    };
    return live;
  }

  it("fails check 5 (production has moved), and check 7 (the record has moved)", () => {
    const result = evaluate(stale());
    expect(result.ok).toBe(false);
    expect(result.failures.map((row) => row.n)).toEqual([5, 7]);
  });

  it("names both failures, with a fix, in the closing list an operator runs", () => {
    const transcript = render(evaluate(stale()), { version: "2.0.0-rc1.2" }).join("\n");
    expect(transcript).toContain("verdict: 2 of 7 checks failed (5, 7)");
    expect(transcript).toContain("what failed, and the one command that fixes it:");
    expect(transcript).toContain("production reports 2.0.0-rc1.3, not 2.0.0-rc1.2");
    expect(transcript).toContain("promote it");
    expect(transcript).toContain("pnpm health:record --db --gate --carry --ci");
    expect(transcript).not.toContain("7 of 7 checks pass");
  });
});

/* ------------------------------------------------------------------ *
 * 4 — a known-flaky job is ⚠ with its URL, never dropped
 * ------------------------------------------------------------------ */
describe("the known-flaky demo reseed is named, not swallowed", () => {
  it("carries a failing flaky job as ⚠ with its URL, and the verdict still passes", () => {
    const evidence = clean();
    evidence.ci = {
      available: true,
      runs: [
        { name: "typecheck / lint / build", conclusion: "success", url: "https://r/1" },
        { name: FLAKY_JOB, conclusion: "failure", url: RUN_URL },
      ],
    };
    const result = evaluate(evidence);
    expect(result.ok).toBe(true);
    expect(result.rows[5].status).toBe("ok");
    expect(result.rows[5].value).toContain("1 known-flaky");
    expect(result.rows[5].warning).toContain(FLAKY_JOB);
    expect(result.rows[5].warning).toContain(RUN_URL);

    const transcript = render(result, { version: "2.0.0-rc1.3" }).join("\n");
    expect(transcript).toContain("⚠");
    expect(transcript).toContain(FLAKY_JOB);
    expect(transcript).toContain(RUN_URL);
    expect(transcript).toContain("7 of 7 checks pass");
  });

  it("still fails the check when a real job failed beside it, and names both", () => {
    const evidence = clean();
    evidence.ci = {
      available: true,
      runs: [
        { name: FLAKY_JOB, conclusion: "failure", url: RUN_URL },
        { name: "typecheck / lint / build", conclusion: "failure", url: "https://r/real" },
      ],
    };
    const result = evaluate(evidence);
    expect(result.ok).toBe(false);
    expect(result.failures.map((row) => row.n)).toEqual([6]);
    expect(result.rows[5].value).toContain("https://r/real");
    expect(result.rows[5].warning).toContain(FLAKY_JOB);
  });

  it("matches the job's matrix leg, and nothing that merely contains its name", () => {
    expect(matchKnownFlaky(FLAKY_JOB)).toBe(KNOWN_FLAKY[0]);
    expect(matchKnownFlaky(`${FLAKY_JOB} (demo)`)).toBe(KNOWN_FLAKY[0]);
    expect(matchKnownFlaky("RESET AND RESEED THE DEMO BRANCH")).toBe(KNOWN_FLAKY[0]);
    expect(matchKnownFlaky("reset and reseed the demo branch twice")).toBeNull();
    expect(matchKnownFlaky("typecheck / lint / build")).toBeNull();
    expect(matchKnownFlaky(undefined)).toBeNull();
  });

  it("classifies a run list into four groups, and calls an unknown conclusion a failure", () => {
    const { green, failing, flaky, pending } = classifyCheckRuns([
      { name: "a", conclusion: "success", url: null },
      { name: "b", conclusion: "skipped", url: null },
      { name: "c", conclusion: "failure", url: null },
      { name: FLAKY_JOB, conclusion: "timed_out", url: RUN_URL },
      { name: "d", conclusion: null, url: null },
      { name: "e", conclusion: "something-new", url: null },
    ]);
    expect(green.map((run) => run.name)).toEqual(["a", "b"]);
    expect(failing.map((run) => run.name)).toEqual(["c", "e"]);
    expect(flaky.map((run) => run.name)).toEqual([FLAKY_JOB]);
    expect(pending.map((run) => run.name)).toEqual(["d"]);
    expect(classifyCheckRuns(null)).toEqual({ green: [], failing: [], flaky: [], pending: [] });
  });
});

/* ------------------------------------------------------------------ *
 * 5 — production is compared as "contains the tag", not "equals it"
 * ------------------------------------------------------------------ */
describe("production is placed against the tag by containment", () => {
  const live = { ok: true, version: "2.0.0-rc1.3", commit: LATER_SHA };

  it("passes when the live commit contains the tag, or is the tag", () => {
    expect(productionVerdict({ expectedVersion: "2.0.0-rc1.3", live, containing: true }).ok).toBe(
      true,
    );
    expect(
      productionVerdict({
        expectedVersion: "2.0.0-rc1.3",
        live: { ...live, commit: TAG_SHA },
        containing: true,
      }).ok,
    ).toBe(true);
  });

  it("fails on a version that is not the tag's, or a commit that does not contain it", () => {
    const wrongVersion = productionVerdict({
      expectedVersion: "2.0.0-rc1.2",
      live,
      containing: true,
    });
    expect(wrongVersion.ok).toBe(false);
    expect(wrongVersion.value).toContain("not 2.0.0-rc1.2");

    const unrelated = productionVerdict({
      expectedVersion: "2.0.0-rc1.3",
      live,
      containing: false,
    });
    expect(unrelated.ok).toBe(false);
    expect(unrelated.value).toContain("does not contain the tag's commit");

    const unplaced = productionVerdict({
      expectedVersion: "2.0.0-rc1.3",
      live,
      containing: null,
    });
    expect(unplaced.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * 6 — the CHANGELOG entry and its Known limits block
 * ------------------------------------------------------------------ */
describe("the entry is parsed by its heading, and its Known limits block by its bullets", () => {
  const changelog = [
    "# Changelog",
    "",
    "## [2.0.0-rc1.3] - 2026-11-19",
    "",
    "### Added",
    "",
    "- `feat(flow)` — something",
    "",
    "### Known limits",
    "",
    "- **This is a pre-release.**",
    "- **Two migrations share 0042.**",
    "",
    "### Maintenance",
    "",
    "- `docs` — a line after the block, which is not a limit",
    "",
    "## [2.0.0-rc1.2] - 2026-11-18",
    "",
    "### Known limits",
    "",
    "- an older limit",
    "",
    "[2.0.0-rc1.2]: https://example.test/compare",
  ].join("\n");

  it("finds the entry for the exact version, and not the pre-release prefix of a longer one", () => {
    const entry = entryOf(changelog, "2.0.0-rc1.3");
    expect(entry).toContain("## [2.0.0-rc1.3] - 2026-11-19");
    expect(entry).not.toContain("an older limit");
    // `2.0.0-rc1` is a prefix of both versions and of neither heading.
    expect(entryOf(changelog, "2.0.0-rc1")).toBeNull();
    expect(entryOf(changelog, "9.9.9")).toBeNull();
    expect(entryOf(undefined, "2.0.0-rc1.3")).toBeNull();
  });

  it("takes the block's own bullets and stops at the next section", () => {
    const bullets = limitsBullets(entryOf(changelog, "2.0.0-rc1.3"));
    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toContain("This is a pre-release");
    expect(bullets.join("\n")).not.toContain("a line after the block");
    expect(limitsBullets(entryOf(changelog, "2.0.0-rc1.2"))).toEqual(["an older limit"]);
  });

  it("treats an absent block, an empty one and the generator's TODO as no limits at all", () => {
    expect(limitsArePlaceholder([])).toBe(true);
    expect(limitsArePlaceholder(["TODO: the limits of this release"])).toBe(true);
    expect(limitsArePlaceholder(["**A real limit.**"])).toBe(false);
    expect(limitsBullets("## [1.0.0] - 2026-01-01\n\n### Added\n\n- a line")).toEqual([]);
  });

  it("fails check 7 when the entry has no limits block, naming the entry not the record", () => {
    const evidence = clean();
    evidence.limitsBullets = [];
    expect(failed(evidence)).toEqual([7]);
    const remedy = String(evaluate(evidence).rows[6].remedy ?? "");
    expect(remedy).toContain("`### Known limits` bullets for [2.0.0-rc1.3]");
    expect(remedy).not.toContain("health:record");
  });
});

/* ------------------------------------------------------------------ *
 * 7 — the CLI: the two paths that read nothing
 * ------------------------------------------------------------------ */
describe("the CLI refuses a call it cannot answer", () => {
  const cli = (args: string[]) => {
    const run = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
    return { status: run.status ?? -1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
  };

  it("exits 2 with the usage when there is no version", () => {
    const run = cli([]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("a version is required");
    expect(run.stderr).toContain("not a step in");
  });

  it("exits 2 on a version that is not semver", () => {
    const run = cli(["1.1"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("is not a semantic version");
  });

  it("prints the usage and exits 0 for --help, and says it is read-only", () => {
    const run = cli(["--help"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("release:postcheck <version>");
    expect(run.stdout).toContain("Read-only");
  });
});
