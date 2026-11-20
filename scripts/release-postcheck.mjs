#!/usr/bin/env node
/**
 * scripts/release-postcheck.mjs — `pnpm release:postcheck <version>`: the seven facts a cut must
 * still be true *after* it happened, as one command with a ✗ per failure and a verdict.
 *
 * The requirement is card t_244fc00a; no GitHub issue carries it, so the card is cited rather than
 * an invented number.
 *
 * ## Why this exists beside the preflight
 *
 * `scripts/release-preflight.mjs` (ten facts) answers *may this cut start*. This answers *did the cut
 * actually land, and does the world agree with it* — a different question, read after the tag exists,
 * so it replaces, weakens and reorders nothing. Both are absent from `scripts/verify.sh` and from CI
 * on purpose: this one needs a tag and a live production endpoint, and neither exists on a PR.
 *
 * The v2.0.0-rc1.3 cut is the reference. Six of its seven checks passed; the seventh — the demo
 * reseed — was found **only because a human looked**. A check somebody remembers to run is not a
 * check, so the seven became this script.
 *
 * ## The seven checks
 *
 *   1  tag is annotated        `git cat-file -t v<version>` is `tag`, not `commit` — a lightweight
 *                              tag carries no tagger and no message, so the release that points at
 *                              it is the only record of who cut it
 *   2  bump is at the tag      `git show v<version>:package.json` names `<version>` — the top
 *                              historical failure: the bump merged but the tag landed on the commit
 *                              before it, so the released tree ships the previous version
 *   3  tag is on origin/main   `git merge-base --is-ancestor <tag-commit> origin/main` — a tag on a
 *                              commit the branch cannot reproduce is a release nobody can rebuild
 *   4  GitHub release exists   `gh release view` answers, it is not a draft, and `isPrerelease`
 *                              matches whether the version carries a `-suffix` (`+build` is not one)
 *   5  production names it     `GET https://alignsynch.com/api/version` reports the tagged version at
 *                              a commit that **contains** the tag — equality with the tag commit is
 *                              not required, because production deploys every `main` merge and is
 *                              routinely a few commits past the tag
 *   6  CI green at the tag     `gh api …/commits/<sha>/check-runs` has no failing check at the tag's
 *                              own commit; a **known-flaky** job is named with its URL and marked ⚠
 *                              instead of sinking the verdict (see below)
 *   7  entry and record agree  the `[<version>]` CHANGELOG entry carries a `### Known limits` block
 *                              with bullets (not the generator's TODO), and
 *                              `data/health/platform-health.json` names this version
 *
 * ## Known-flaky jobs are named, never dropped
 *
 * `reset and reseed the demo branch` seeds the shared demo branch. It fails for environmental
 * reasons — the branch's own ceiling, or two seeds overlapping — which is not a release defect, and
 * it failed on the rc1.3 cut. Dropping it would make check 6 a check that only ever passes, so it is
 * printed as `⚠` with its run URL and the reason, counted beside the verdict, and excluded from the
 * failure set. The list is `KNOWN_FLAKY`, one row per job, each carrying why it is flaky.
 *
 * ## Read-only, and a verdict rather than a gate
 *
 * It tags nothing, publishes nothing, pushes nothing and writes no file — not even the health record,
 * which it reads. `scripts/release.sh` calls it **after** the release is published and ignores its
 * exit code, because the tag is already on the remote and a published tag is never moved: a ✗ here
 * is a follow-up (usually the next version), never a re-cut. The script says that in its own output.
 *
 * Five of the checks are local git and local file reads, one is `gh` (the same identity the cut
 * itself used), and one is an unauthenticated public HTTP call. It reads no repo secret, and never
 * touches `STRIPE_*`, `BILLING_HOST` or the database.
 *
 * ## Exit
 *
 *   0  every check passed, or the only failures are known-flaky ones (printed as ⚠)
 *   1  at least one check failed — the ✗ lines name it, and each prints the command that fixes it
 *   2  usage: no version, or a version that is not semver
 *
 * Colour is printed only to a terminal, so a transcript captured to a file is plain text.
 *
 * Usage:
 *   pnpm release:postcheck <version>
 *   node scripts/release-postcheck.mjs <version>
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isVersion } from "./release-version.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The seven checks, in order. `CHECK_NAMES[n - 1]` is the name printed for check `n`. */
export const CHECK_NAMES = [
  "tag is annotated",
  "bump is at the tag",
  "tag is on origin/main",
  "GitHub release published",
  "production names the cut",
  "CI green at the tag commit",
  "entry and record agree",
];

/**
 * Jobs whose failure is not a release defect, with the reason printed beside them.
 *
 * The match is on the check-run's `name`, case-insensitively and either exactly or as the name the
 * matrix leg reports with a suffix — never a substring of a different job, because a flaky allowance
 * that widens itself to whatever fails is how a check stops being a check.
 */
export const KNOWN_FLAKY = [
  {
    job: "reset and reseed the demo branch",
    reason:
      "seeds the shared demo branch; its ceiling or an overlapping seed fails it for environmental reasons, not for a release defect",
  },
];

/**
 * Every remedy this script prints, in one place so a failure and its instruction can never drift.
 * Each names the one act that clears the failure; nothing here is run by this script.
 */
export const REMEDY = {
  tag: (version) =>
    `no tag — the release was never cut: \`bash scripts/release.sh --tag-only ${version}\` (from main, gate green)`,
  lightweight: (version) =>
    `a lightweight tag cannot be re-pointed into an annotated one — published tags are immutable, so cut the next version (\`bash scripts/release.sh --tag-only ${version}\`)`,
  bump: (have, want) =>
    `the tagged tree ships package.json ${have ?? "(unreadable)"}, not ${want} — the bump merged after the tag: cut the next version, the tag is never moved`,
  offMain: (sha) =>
    `the tag sits on ${sha}, which origin/main does not contain — a release ships a commit the branch can reproduce: cut the next version from main`,
  release: (version, prerelease) =>
    `gh release create v${version} --title v${version} --notes-file <the entry>${prerelease ? " --prerelease" : ""}`,
  releaseFlag: (version, want) =>
    `gh release edit v${version} ${want ? "--prerelease" : "--prerelease=false"} — a pre-release published as latest, or the reverse, is the wrong artefact`,
  production: (want) =>
    `production does not serve v${want} — promote it (\`docs/operations/releasing.md\` § main → production), then \`curl -s https://alignsynch.com/api/version\``,
  ci: (sha) =>
    `read the failing check at ${sha} and land the fix; a release ships a commit CI has read, so this is the next version rather than a re-tag`,
  ciPending: (sha) =>
    `CI at ${sha} has not finished — \`gh api repos/{owner}/{repo}/commits/${sha}/check-runs\`, then run this again`,
  limits: (version) =>
    `write the \`### Known limits\` bullets for [${version}] — \`bash scripts/release.sh --check\` names the entry that is missing them`,
  record: (version, have) =>
    `the health record names ${have ?? "(nothing readable)"}, not ${version} — \`pnpm health:record --db --gate --carry --ci <YYYY-MM-DD>\`, then land it as its own pull request`,
};

const PALETTE = {
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  off: "\u001b[0m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
};
const NO_COLOUR = { bold: "", dim: "", off: "", green: "", red: "", yellow: "" };

/* ------------------------------------------------------------------ *
 * Pure predicates — every one of them a case in tests/release-postcheck.test.ts
 * ------------------------------------------------------------------ */

const short = (sha) => (typeof sha === "string" && sha.length >= 7 ? sha.slice(0, 7) : String(sha));

/** A conclusion that means the check did not pass. `null` (still running) is not one of these. */
const FAILING_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
  "stale",
]);

/**
 * The known-flaky row a check-run name belongs to, or `null`.
 *
 * Exact first, then the `name (leg)` shape a matrix leg reports, because GitHub suffixes a matrix
 * job's name and a flaky job that is allowed only under its exact name would go red the moment it
 * was put behind a matrix. A substring of a *different* job is not a match: that is the widening
 * this rule must not do.
 */
export function matchKnownFlaky(name) {
  const wanted = String(name ?? "")
    .trim()
    .toLowerCase();
  if (wanted.length === 0) return null;
  for (const row of KNOWN_FLAKY) {
    const job = row.job.toLowerCase();
    if (wanted === job) return row;
    if (wanted.startsWith(`${job} (`) && wanted.endsWith(")")) return row;
  }
  return null;
}

/**
 * Sort a `check-runs` list into what passed, what failed, what failed only in a known-flaky job, and
 * what has not finished. Pure, so the rule is a test rather than a transcript.
 *
 * `unreadable` is its own answer: a run list this script cannot classify is not green, because an
 * unverified check is the failure this command exists to catch.
 */
export function classifyCheckRuns(runs) {
  const list = Array.isArray(runs) ? runs.filter(Boolean) : [];
  const green = [];
  const failing = [];
  const flaky = [];
  const pending = [];
  for (const run of list) {
    const conclusion = run.conclusion ?? null;
    if (!conclusion) {
      pending.push(run);
    } else if (conclusion === "success" || conclusion === "skipped" || conclusion === "neutral") {
      green.push(run);
    } else if (FAILING_CONCLUSIONS.has(conclusion)) {
      const known = matchKnownFlaky(run.name);
      if (known) flaky.push({ ...run, flaky: known });
      else failing.push(run);
    } else {
      // An unknown conclusion is unverified, and unverified is a failure here.
      failing.push(run);
    }
  }
  return { green, failing, flaky, pending };
}

/**
 * The `## [<version>] - <date>` entry of a CHANGELOG, or `null` when there is none.
 *
 * The heading carries the separator — `## [2.0.0-rc1.3] - ` — so asking for `2.0.0-rc1` cannot
 * match `2.0.0-rc1.2`'s entry, and the block ends at the next `## [` heading or at the release's own
 * link definition (`[1.2.3]: https://…`), which is a footer rather than part of the entry.
 */
export function entryOf(changelog, version) {
  const text = String(changelog ?? "");
  const want = `## [${version}] - `;
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(want));
  if (start === -1) return null;
  const block = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## [") || line.startsWith(`[${version}]: `)) break;
    block.push(line);
  }
  return block.join("\n");
}

/** The bullets of an entry's `### Known limits` block, body only; `[]` when the block is absent. */
export function limitsBullets(entry) {
  const lines = String(entry ?? "").split("\n");
  const start = lines.findIndex((line) => /^###\s+Known limits\s*$/i.test(line.trim()));
  if (start === -1) return [];
  const bullets = [];
  for (const line of lines.slice(start + 1)) {
    if (/^###\s/.test(line) || line.startsWith("## ")) break;
    if (line.startsWith("- ")) bullets.push(line.slice(2).trim());
  }
  return bullets;
}

/** Is the block still the generator's placeholder? A TODO is not a limits block. */
export function limitsArePlaceholder(bullets) {
  const rows = Array.isArray(bullets) ? bullets : [];
  return rows.length === 0 || rows.some((bullet) => /\bTODO\b/i.test(bullet));
}

/**
 * Everything check 5 needs, from one answer: does production report the tagged version, at a commit
 * that contains the tag?
 *
 * `containing` is `true | false | null`, computed by the caller from git (`merge-base --is-ancestor
 * <tag> <live>`) because equality is too strict — production deploys every `main` merge and is
 * usually a few commits past the tag the cut published.
 */
export function productionVerdict({ expectedVersion, live, containing }) {
  if (live?.ok !== true) {
    return { ok: false, value: `cannot read production — ${live?.error ?? "no answer"}` };
  }
  if (live.version !== expectedVersion) {
    return {
      ok: false,
      value: `production reports ${live.version ?? "(no version)"}, not ${expectedVersion}`,
    };
  }
  if (containing === true) {
    return {
      ok: true,
      value: `${live.version} at ${short(live.commit)} — contains the tag`,
    };
  }
  if (containing === false) {
    return {
      ok: false,
      value: `${live.version} at ${short(live.commit)}, which does not contain the tag's commit`,
    };
  }
  return {
    ok: false,
    value: `${live.version} at ${short(live.commit)} — cannot place the tag's commit in it`,
  };
}

/* ------------------------------------------------------------------ *
 * The decision — takes the evidence, does no I/O
 * ------------------------------------------------------------------ */

/**
 * @param {Record<string, any>} evidence
 * @returns {{ ok: boolean, rows: Array<Record<string, any>>, failures: Array<Record<string, any>>, warnings: Array<Record<string, any>> }}
 */
export function evaluate(evidence) {
  const version = String(evidence?.version ?? "");
  const rows = [];
  const row = (n, ok, value, extra = {}) => {
    rows.push({ n, key: CHECK_NAMES[n - 1], status: ok ? "ok" : "bad", value, ...extra });
  };
  const tagCommit = typeof evidence?.tagCommit === "string" ? evidence.tagCommit : null;

  /* 1 — tag is annotated ---------------------------------------------------- */
  if (!evidence?.tagType) {
    row(1, false, `no tag v${version}`, { remedy: REMEDY.tag(version) });
  } else if (evidence.tagType !== "tag") {
    row(1, false, `v${version} is a lightweight tag (${evidence.tagType})`, {
      remedy: REMEDY.lightweight(version),
    });
  } else {
    row(1, true, `v${version} is an annotated tag on ${short(tagCommit)}`);
  }

  /* 2 — bump is at the tag -------------------------------------------------- */
  const tagPackageVersion = evidence?.tagPackageVersion ?? null;
  if (!tagCommit) {
    row(2, false, "cannot read the tree at the tag — there is no tag", {
      remedy: REMEDY.tag(version),
    });
  } else if (tagPackageVersion !== version) {
    row(
      2,
      false,
      `the tagged package.json is ${tagPackageVersion ?? "(unreadable)"}, cutting ${version}`,
      {
        remedy: REMEDY.bump(tagPackageVersion, version),
      },
    );
  } else {
    row(2, true, `package.json at v${version} is ${version}`);
  }

  /* 3 — tag is on origin/main ----------------------------------------------- */
  if (!tagCommit) {
    row(3, false, "cannot place a tag that does not exist", { remedy: REMEDY.tag(version) });
  } else if (evidence?.containedInMain === true) {
    row(3, true, `${short(tagCommit)} is contained in origin/main ${short(evidence.originMain)}`);
  } else {
    row(
      3,
      false,
      `${short(tagCommit)} is not contained in origin/main ${short(evidence?.originMain ?? "?")}`,
      { remedy: REMEDY.offMain(short(tagCommit)) },
    );
  }

  /* 4 — GitHub release exists, and its prerelease flag is right ------------- */
  const release = evidence?.release ?? { available: false };
  const wantsPrerelease = version.includes("-");
  if (!release.available) {
    row(4, false, `cannot verify the GitHub release — ${release.reason ?? "gh did not answer"}`, {
      remedy: REMEDY.release(version, wantsPrerelease),
    });
  } else if (!release.exists) {
    row(4, false, `no GitHub release for v${version}`, {
      remedy: REMEDY.release(version, wantsPrerelease),
    });
  } else if (release.isDraft) {
    row(4, false, `v${version} is a draft — a release is published, not staged`, {
      remedy: REMEDY.releaseFlag(version, wantsPrerelease),
    });
  } else if (Boolean(release.isPrerelease) !== wantsPrerelease) {
    row(
      4,
      false,
      `isPrerelease=${release.isPrerelease}, and v${version} ${wantsPrerelease ? "is" : "is not"} a pre-release`,
      { remedy: REMEDY.releaseFlag(version, wantsPrerelease) },
    );
  } else {
    row(
      4,
      true,
      `published${wantsPrerelease ? " as a pre-release" : ""} — ${release.url ?? "no url reported"}`,
    );
  }

  /* 5 — production names both the version and the commit -------------------- */
  const verdict = productionVerdict({
    expectedVersion: version,
    live: evidence?.production,
    containing: evidence?.productionContainsTag,
  });
  row(5, verdict.ok, verdict.value, verdict.ok ? {} : { remedy: REMEDY.production(version) });

  /* 6 — CI at the tag's commit has no failing check ------------------------- */
  const ci = evidence?.ci ?? { available: false };
  if (!ci.available) {
    row(6, false, `cannot verify CI — ${ci.reason ?? "gh did not answer"}`, {
      remedy: REMEDY.ci(short(tagCommit ?? "HEAD")),
    });
  } else {
    const { green, failing, flaky, pending } = classifyCheckRuns(ci.runs);
    const value =
      `${green.length} green · ${failing.length} failed · ${flaky.length} known-flaky` +
      `${pending.length > 0 ? ` · ${pending.length} pending` : ""}`;
    const flakyWarning =
      flaky.length > 0
        ? flaky.map((run) => `${run.flaky.job} — ${run.flaky.reason} (${run.url ?? "no url"})`)
        : undefined;
    if (failing.length > 0) {
      row(6, false, `${value} — ${failing[0].url ?? failing[0].name}`, {
        remedy: REMEDY.ci(short(tagCommit ?? "HEAD")),
        ...(flakyWarning ? { warning: flakyWarning.join("; ") } : {}),
        runs: failing,
      });
    } else if (pending.length > 0) {
      row(6, false, `${value}`, {
        remedy: REMEDY.ciPending(short(tagCommit ?? "HEAD")),
        ...(flakyWarning ? { warning: flakyWarning.join("; ") } : {}),
      });
    } else if (green.length === 0) {
      row(6, false, `${value} — no check has run at this commit`, {
        remedy: REMEDY.ci(short(tagCommit ?? "HEAD")),
        ...(flakyWarning ? { warning: flakyWarning.join("; ") } : {}),
      });
    } else {
      // A known-flaky failure is carried as ⚠: named, with its URL, and never silently dropped.
      row(6, true, flaky.length > 0 ? `${value} (⚠ the flaky job is named below)` : value, {
        ...(flakyWarning ? { warning: flakyWarning.join("; ") } : {}),
      });
    }
  }

  /* 7 — the entry carries Known limits, and the record names this version --- */
  const bullets = Array.isArray(evidence?.limitsBullets) ? evidence.limitsBullets : [];
  const hasLimits = bullets.length > 0 && !limitsArePlaceholder(bullets);
  const recordVersion = evidence?.health?.packageVersion ?? null;
  const recordNamesIt = recordVersion === version;
  const halves = [
    hasLimits
      ? `the entry carries ${bullets.length} Known limits bullet(s)`
      : "the entry has no Known limits bullets",
    recordNamesIt
      ? `the health record names ${version}`
      : `the health record names ${recordVersion ?? "(nothing readable)"}`,
  ];
  if (hasLimits && recordNamesIt) {
    row(7, true, halves.join(" · "));
  } else {
    const remedies = [];
    if (!hasLimits) remedies.push(REMEDY.limits(version));
    if (!recordNamesIt) remedies.push(REMEDY.record(version, recordVersion));
    row(7, false, halves.join(" · "), { remedy: remedies.join("\n") });
  }

  const failures = rows.filter((entry) => entry.status === "bad");
  const warnings = rows.filter((entry) => entry.warning);
  return { ok: failures.length === 0, rows, failures, warnings };
}

/* ------------------------------------------------------------------ *
 * The transcript — pure, so a test asserts on the line an operator reads
 * ------------------------------------------------------------------ */

export function render(result, { version = "(no version)", colour = false } = {}) {
  const c = colour ? PALETTE : NO_COLOUR;
  const passed = result.rows.filter((entry) => entry.status === "ok").length;
  const warned = result.warnings.length;
  const lines = [];
  lines.push(
    `${c.bold}release:postcheck${c.off}${c.dim} — v${version}, the seven facts a completed cut must be true${c.off}`,
  );
  lines.push("");
  for (const entry of result.rows) {
    const glyph = entry.status === "ok" ? `${c.green}✓${c.off}` : `${c.red}✗${c.off}`;
    lines.push(`  ${glyph} ${String(entry.n).padStart(2)} ${entry.key.padEnd(28)} ${entry.value}`);
    for (const line of String(entry.remedy ?? "")
      .split("\n")
      .filter(Boolean)) {
      lines.push(`  ${c.yellow}   fix:${c.off} ${line}`);
    }
    if (entry.warning) lines.push(`  ${c.yellow}    ⚠${c.off} ${entry.warning}`);
  }
  lines.push("");
  if (result.ok) {
    lines.push(
      `  ${c.green}verdict: ${passed} of 7 checks pass${c.off}` +
        (warned > 0
          ? ` — ${warned} known-flaky job(s) named above, which is not a release defect`
          : " — the cut is verified"),
    );
  } else {
    const failed = result.failures.map((entry) => entry.n).join(", ");
    lines.push(
      `  ${c.red}verdict: ${result.failures.length} of 7 checks failed (${failed}) — the published cut does not hold${c.off}`,
    );
    lines.push("");
    lines.push(`  what failed, and the one command that fixes it:`);
    for (const entry of result.failures) {
      lines.push(`    ${c.red}✗${c.off} ${entry.n} ${entry.key}: ${entry.value}`);
      for (const line of String(entry.remedy ?? "")
        .split("\n")
        .filter(Boolean)) {
        lines.push(`      fix: ${line}`);
      }
    }
  }
  lines.push("");
  lines.push(
    `  ${c.dim}this is a verdict, not a gate: v${version}'s tag is published and a published tag is never` +
      ` moved, so a ✗ here is follow-up work — usually the next version — never a re-cut.${c.off}`,
  );
  return lines;
}

/* ------------------------------------------------------------------ *
 * Gathering the evidence — I/O only, no decisions
 * ------------------------------------------------------------------ */

function git(...args) {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (run.status !== 0 || typeof run.stdout !== "string") return null;
  return run.stdout.trim();
}

/** Exit status only — for `merge-base --is-ancestor`, which prints nothing either way. */
function gitOk(...args) {
  const run = spawnSync("git", args, { cwd: ROOT, stdio: "ignore" });
  return run.status === 0;
}

/**
 * Does this clone hold the commit? `git cat-file -e` prints **nothing** on success — a truthiness
 * check on its stdout answers "absent" for every sha that is present, which is how a live commit that
 * contains the tag was first read as one that does not. Status only.
 */
function gitHasCommit(sha) {
  if (typeof sha !== "string" || sha.length === 0) return false;
  return gitOk("cat-file", "-e", `${sha}^{commit}`);
}

function ghJson(args) {
  const run = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8" });
  if (run.error?.code === "ENOENT") return { available: false, reason: "gh is not installed" };
  if (run.status !== 0) {
    const stderr = String(run.stderr ?? "")
      .trim()
      .split("\n")[0];
    return {
      available: false,
      reason: stderr.length > 0 ? stderr : `gh exited ${run.status ?? "without a status"}`,
    };
  }
  try {
    return { available: true, body: JSON.parse(run.stdout) };
  } catch {
    return { available: false, reason: "gh answered something this script cannot read" };
  }
}

function readHealthRecord() {
  try {
    const record = JSON.parse(readFileSync(join(ROOT, "data/health/platform-health.json"), "utf8"));
    return {
      packageVersion: record?.tree?.packageVersion ?? null,
      latestTag: record?.tree?.latestTag ?? null,
      recordedAt: record?.recordedAt ?? null,
    };
  } catch {
    return { packageVersion: null, latestTag: null, recordedAt: null };
  }
}

/**
 * `GET <production>/api/version` — the one network read, unauthenticated, no repo secret.
 *
 * `POSTCHECK_PRODUCTION_URL` overrides the host so the script can be pointed at a preview without
 * editing it; the default is the site the release promises.
 */
async function fetchProduction() {
  const base = (process.env.POSTCHECK_PRODUCTION_URL || "https://alignsynch.com").replace(
    /\/+$/,
    "",
  );
  const url = `${base}/api/version`;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, error: `${url} answered HTTP ${response.status}` };
    const body = await response.json();
    return {
      ok: true,
      version: typeof body?.version === "string" ? body.version : null,
      commit: typeof body?.commit === "string" ? body.commit : null,
      url,
    };
  } catch (error) {
    const reason =
      error?.name === "TimeoutError"
        ? `timed out after 20s`
        : String(error?.cause?.code ?? error?.message ?? error);
    return { ok: false, error: `${url} — ${reason}` };
  }
}

/**
 * Whether the live commit contains the tag's commit. `null` when it cannot be decided — the live sha
 * is not in this clone (a deployment of something else), or there is no tag to place.
 */
function productionContainsTag(live, tagCommit) {
  if (!live?.ok || !live.commit || !tagCommit) return null;
  if (live.commit === tagCommit) return true;
  if (!gitHasCommit(live.commit)) {
    // The sha is not in this clone: not an ancestor by construction, but not a lie to call it one.
    return false;
  }
  return gitOk("merge-base", "--is-ancestor", tagCommit, live.commit);
}

async function gather(version) {
  // Remote-tracking refs only: `git fetch` never moves HEAD, and this script never pulls or checks out.
  spawnSync("git", ["fetch", "--quiet", "--prune", "--tags", "origin"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  const tagRef = `v${version}`;
  const tagType = git("cat-file", "-t", tagRef);
  const tagCommit = git("rev-parse", `${tagRef}^{commit}`);
  const tagPackageVersion = tagCommit
    ? (() => {
        const raw = git("show", `${tagRef}:package.json`);
        if (!raw) return null;
        try {
          return JSON.parse(raw).version ?? null;
        } catch {
          return null;
        }
      })()
    : null;
  const originMain = git("rev-parse", "origin/main");

  const releaseAnswer = ghJson([
    "release",
    "view",
    tagRef,
    "--json",
    "tagName,isDraft,isPrerelease,url",
  ]);
  const release = releaseAnswer.available
    ? { available: true, exists: true, ...releaseAnswer.body }
    : /not found|could not resolve|no release/i.test(String(releaseAnswer.reason))
      ? { available: true, exists: false, reason: releaseAnswer.reason }
      : { available: false, reason: releaseAnswer.reason };

  const ciAnswer = tagCommit
    ? ghJson([
        "api",
        `repos/{owner}/{repo}/commits/${tagCommit}/check-runs?per_page=100&filter=latest`,
      ])
    : { available: false, reason: "there is no tag commit to ask about" };
  const ci = ciAnswer.available
    ? {
        available: true,
        runs: (ciAnswer.body?.check_runs ?? []).map((run) => ({
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          url: run.html_url ?? run.details_url ?? null,
        })),
      }
    : { available: false, reason: ciAnswer.reason };

  let changelog = "";
  try {
    changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  } catch {
    changelog = "";
  }
  const entry = entryOf(changelog, version);

  const production = await fetchProduction();

  return {
    version,
    tagType,
    tagCommit,
    tagPackageVersion,
    originMain,
    containedInMain:
      tagCommit && originMain ? gitOk("merge-base", "--is-ancestor", tagCommit, originMain) : null,
    release,
    production,
    productionContainsTag: productionContainsTag(production, tagCommit),
    ci,
    limitsBullets: limitsBullets(entry),
    entryFound: entry !== null,
    health: readHealthRecord(),
  };
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

const USAGE = `  release:postcheck <version>     the seven facts a completed cut must still be true

Read-only: it tags, publishes, pushes and writes nothing. It is not a step in
\`scripts/verify.sh\` or in CI — it needs a tag and a live production endpoint.
\`scripts/release.sh\` runs it after the release is published and ignores its exit
code, because a published tag is never moved: it is a verdict, not a gate.

Exit: 0 every check passed (a known-flaky job is ⚠) · 1 a check failed · 2 usage.`;

function usageDie(message) {
  process.stderr.write(`release:postcheck: ${message}\n\n${USAGE}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { version: null, help: false };
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg.startsWith("-")) {
      usageDie(`unknown option '${arg}'`);
    } else if (opts.version !== null) {
      usageDie("one version per invocation");
    } else {
      opts.version = arg.replace(/^v/, "");
    }
  }
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!opts.version) usageDie("a version is required");
  if (!isVersion(opts.version)) {
    usageDie(
      `'${opts.version}' is not a semantic version (x.y.z, optionally -prerelease or +build)`,
    );
  }

  const evidence = await gather(opts.version);
  const result = evaluate(evidence);
  const colour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  for (const line of render(result, { version: opts.version, colour })) {
    process.stdout.write(`${line}\n`);
  }
  return result.ok ? 0 : 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`release:postcheck: ${error?.stack ?? error}\n`);
    process.exit(1);
  }
}
