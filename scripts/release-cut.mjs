#!/usr/bin/env node
/**
 * scripts/release-cut.mjs — `pnpm release:cut`: the release's one state and one actor (#1064).
 *
 * The record this replaces is in the issue, and every row of it is the same defect in a different
 * coat: `v1.19.1` planned then dropped, `v1.20.0` skipped on a premise that was false, `v1.21.0`
 * abandoned, a milestone renamed **three times in one day**, a tag card decomposed into six worker
 * cards one of which was *"Tag v1.20.0 and publish the GitHub release"*, a health record left naming
 * `1.15.0`, and a tag that appeared with nobody able to say who took it. The number lived in three
 * places that could disagree and nothing compared them; anyone could tag; and the number was
 * *chosen* — recommended by `release_boundary.py`, then typed by hand into a milestone title, a
 * `package.json`, a changelog heading and a card. Every disagreement was found late and repaired by
 * improvisation, which is what "yolo" describes: not recklessness, but a missing mechanism.
 *
 * So this script is the mechanism, and it has one job per paragraph below.
 *
 * ---------------------------------------------------------------------------------------------
 * 1. The number is COMPUTED, never passed.
 * ---------------------------------------------------------------------------------------------
 * `release_boundary.py` already applies the rule — `BREAKING CHANGE` (or a `!` before the
 * separator) → major, `feat` → minor, everything else → patch — and prints a recommendation. This
 * script applies the same rule (widened to the three separators the repo's own commits use: `: `,
 * ` · ` and ` — `, the #1021 repair — so it classifies what `scripts/release.sh` classifies) and
 * then **refuses a positional version argument**, because a typed number is the defect this file
 * exists to delete. `--override <version> --reason "<why>"` exists for the case that genuinely
 * needs one: it requires the reason, prints a loud banner, and `--prepare` writes that banner into
 * the changelog entry, so an override is a declared artefact in a published document and never a
 * silent one.
 *
 * When `~/.hermes/bin/release_boundary.py` is present it is run as a second reader and the two
 * censuses are compared: the boundary tool's rule is *narrower* (it does not read ` — `), so it can
 * under-count a `feat(x) — …` commit. This script only refuses when the boundary reading is
 * STRICTER than its own — a missed `BREAKING CHANGE` is the one direction that can lose a major —
 * and prints the narrower reading as a note. Absent (CI, a fresh clone) it is skipped out loud.
 *
 * ---------------------------------------------------------------------------------------------
 * 2. Refuse on disagreement — the seven values, each named with its source.
 * ---------------------------------------------------------------------------------------------
 * A cut has a **base** (the version the newest tag names, which is what the census counts from) and
 * a **candidate** (base bumped by the census). The seven values in the issue are checked against
 * the one each of them is supposed to record, and every refusal prints both values and where each
 * came from — "version mismatch" alone is a riddle, not a refusal:
 *
 *   milestone title        must name the candidate   (`gh api repos/…/milestones`, or --milestones)
 *   package.json           must name the base — or the candidate, once the release is prepared
 *   no existing tag        `v<candidate>` must be absent (`git tag --list`)
 *   CHANGELOG.md top entry must name the same version as package.json
 *   health record          must name the base or the release before it (#961/#1041: the record
 *                          lands *after* the cut, so one behind is the documented normal state)
 *   atlas manifest         the same two-value rule (`docs/qa-atlas/<v>/manifest.json`, or the
 *                          `docs/qa-atlas/DEFERRED.md` row that names this release)
 *   docs version page      the newest `docs/changelog/v*.md` title must name the same version as
 *                          package.json — the view page is part of the release commit
 *
 * Two states, detected rather than declared, because they are the two states a cut is really in:
 *
 *   unbumped  package.json / CHANGELOG top / newest tag all name the base — the cut is *planned*
 *   prepared  package.json / CHANGELOG top name the candidate and `v<candidate>` is untagged —
 *             the release PR is merged and the tag is the only thing left
 *
 * A package.json that names neither is the refusal the whole file exists for.
 *
 * The milestone row is a refusal only when the number is claimed TWICE (two open milestones naming
 * one version — the rename residue), because several versioned milestones are open at once by
 * design (`v2.0.0`, a deferred `v2.1.0`, the next `v1.22.0`); a rule that refused whenever some
 * other milestone named some other number would be red on every healthy tree and would teach
 * everyone to ignore it. When no milestone names the candidate the row prints the name the number
 * implies, which is what ends the hand-renaming cycle.
 *
 * ---------------------------------------------------------------------------------------------
 * 3. Exactly one actor.
 * ---------------------------------------------------------------------------------------------
 * `HERMES_KANBAN_TASK` set → refuse in every mode. A dispatched worker must never reach a tag: that
 * is how *"Tag v1.20.0 and publish the GitHub release"* became a worker subtask. `--execute` also
 * requires an interactive TTY and a typed confirmation of the version, so a worker that unsets the
 * variable still cannot tag. The one accidental exemption is deliberate: `env -u
 * HERMES_KANBAN_TASK` from a human shell is a human shell.
 *
 * `--execute` composes `bash scripts/release.sh --tag-only <v>` rather than re-implementing the
 * tag: that mode keeps its #1041 behaviour (re-record the platform health and refuse a stale
 * record), and it is the only thing that publishes a GitHub Release byte-identically from the
 * entry. Nothing here replaces it, deletes it or bypasses it.
 *
 * ---------------------------------------------------------------------------------------------
 * 4. `--check` mutates nothing.
 * ---------------------------------------------------------------------------------------------
 * The default mode, and the one a release card runs first: it prints the whole plan, the computed
 * number, the census by class and the milestone name that number implies, and writes not one byte —
 * `git status --short` is empty afterwards. `--prepare` is the only writing mode (entry + bump +
 * the override banner, no commit, no push, no tag); `--execute` is the only tagging mode.
 *
 * Exit: 0 the plan holds (or the mode finished) · 1 refused, the message says why · 2 usage.
 *
 * Usage:
 *   pnpm release:cut [--check]                 the plan: computed number, census, seven values
 *   pnpm release:cut --prepare --limits <f>    write the entry + the bump (no commit, no tag)
 *   pnpm release:cut --execute                 tag + publish — interactive TTY only
 *   pnpm release:cut --override <v> --reason "<why>"   declare a number the census did not compute
 *   pnpm release:cut [plan] --milestones <f>   read milestone evidence from a JSON file (offline)
 *   pnpm release:cut --theme "<theme>"         the theme in the milestone name it prints
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { compareVersions, isBump, isVersion } from "./release-version.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const CHANGELOG = "CHANGELOG.md";
const HEALTH = "data/health/platform-health.json";
const ATLAS_DIR = "docs/qa-atlas";
const DEFERRALS = "docs/qa-atlas/DEFERRED.md";
const DOCS_CHANGELOG = "docs/changelog";
const DEFAULT_SLUG = "riolabs-ai/alignsynch";

/**
 * The separator set the repo's own commits use, read from `scripts/release.sh` rather than invented
 * here: `: ` is canonical conventional, ` · ` and ` — ` are this repo's house style, and #1021
 * established that all three are the same claim — a type and a scope. A colon-only rule filed every
 * `feat(flow) · …` under Maintenance, which is how v1.19.0's billing subscription nearly shipped as
 * a maintenance bullet.
 */
const SEP = "(?:: | · | — )";
const CONVENTIONAL = new RegExp(`^([a-z]+)(?:\\([^)]*\\))?${SEP}`);
const BREAKING = new RegExp(`^([a-z]+)(?:\\([^)]*\\))?!${SEP}`);

const C = {
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  off: "\u001b[0m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
};

const say = (line = "") => process.stdout.write(`${line}\n`);
const die = (message, code = 1) => {
  process.stderr.write(`release:cut: ${message}\n`);
  process.exit(code);
};

/* ------------------------------------------------------------------ *
 * The census — release_boundary.py's rule, in one place with cases
 * ------------------------------------------------------------------ */

/**
 * One commit subject → the bump class it demands and the changelog section it lands in. Every
 * subject lands in exactly one class, so none is dropped: an unclassified subject is a patch, which
 * is the conservative reading (it never inflates a number) and the one both the boundary tool and
 * `release.sh` already take.
 */
export function classifySubject(subject) {
  if (BREAKING.test(subject) || subject.includes("BREAKING CHANGE")) {
    return { kind: "major", section: "Maintenance", type: null };
  }
  const match = CONVENTIONAL.exec(subject);
  const type = match ? match[1] : null;
  const section = type === "feat" ? "Added" : type === "fix" ? "Fixed" : "Maintenance";
  return { kind: type === "feat" ? "minor" : "patch", section, type };
}

/**
 * `base` bumped one step. A pre-release base is bumped on its core integers, exactly as
 * `release_boundary.py` does: `1.1.0-rc1` + patch is `1.1.1`, never `1.1.0-rc2` — a release
 * candidate is cut deliberately, never by this rule.
 */
export function bumpVersion(base, kind) {
  const core = String(base).split("-")[0].split("+")[0];
  const parts = core.split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }
  const [major, minor, patch] = parts;
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The whole census: counts per bump class, per changelog section, and the winning class. */
export function censusOf(subjects) {
  const counts = { major: 0, minor: 0, patch: 0 };
  const sections = { Added: 0, Fixed: 0, Maintenance: 0 };
  const rows = [];

  for (const subject of subjects) {
    const classified = classifySubject(subject);
    counts[classified.kind] += 1;
    sections[classified.section] += 1;
    rows.push({ subject, ...classified });
  }

  // major outranks minor outranks patch — the rule release_boundary.py applies, stated once.
  const kind = counts.major > 0 ? "major" : counts.minor > 0 ? "minor" : "patch";
  return { subjects: rows, total: rows.length, counts, sections, kind };
}

/* ------------------------------------------------------------------ *
 * The seven values — a pure function, so the refusals are testable
 * ------------------------------------------------------------------ */

/**
 * Every value the cut depends on, checked against the thing it is supposed to record. Pure: the
 * caller gathers the evidence (git, files, `gh`), this decides, so each of the seven refusals is a
 * case in `tests/release-cut.test.ts` rather than a scratch tree nobody can reproduce.
 *
 * `evidence` keys: base, baseTag, candidate, computed, kind, census, packageVersion, changelog
 * (+source), candidateTagExists, health, atlas, docs, milestones (null = not checked).
 * Returns `{ state, expected, rows, refusals, warnings }`; a row is
 * `{ key, status, value, source, reason, detail }` where `status` is ok | bad | warn | skip.
 */
export function evaluate(evidence) {
  const {
    base,
    candidate,
    computed = candidate,
    kind,
    census,
    packageVersion,
    changelog,
    changelogSource,
    candidateTagExists,
    health,
    atlas,
    docs,
    milestones,
  } = evidence;

  const rows = [];
  const add = (row) => {
    rows.push(row);
    return row;
  };
  const bad = (key, value, source, reason) => add({ key, status: "bad", value, source, reason });

  let state = "unbumped";
  if (packageVersion === candidate) state = "prepared";
  else if (packageVersion !== base) state = "broken";
  const expected = state === "prepared" ? candidate : base;

  /* 1 — package.json -------------------------------------------------------- */
  if (state === "broken") {
    bad(
      "package.json",
      packageVersion ?? "(unreadable)",
      "package.json version",
      `package.json names ${packageVersion} (package.json version) but the newest tag names ` +
        `${base ?? "(no tag)"} (${evidence.baseTag ?? "no tag"}, git describe --tags --abbrev=0 ` +
        `--match 'v*') and the census computes ${candidate} (${census.total} commit(s) since ` +
        `${evidence.baseTag ?? "the first commit"}: major ${census.counts.major} · feat ` +
        `${census.counts.minor} · other ${census.counts.patch}). The tree is at neither, so there ` +
        "is no number to cut.",
    );
  } else {
    add({
      key: "package.json",
      status: "ok",
      value: packageVersion,
      source:
        state === "prepared"
          ? "package.json version — the release is prepared"
          : "package.json version — the base the cut bumps from",
    });
  }

  /* 2 — no existing tag ----------------------------------------------------- */
  if (candidateTagExists) {
    bad(
      `tag v${candidate}`,
      "exists",
      `git tag --list 'v${candidate}*'`,
      `a tag v${candidate} already exists (git tag --list) while the census computes ${candidate} ` +
        `(${kind}, ${census.total} commit(s) since ${evidence.baseTag ?? "the first commit"}) — ` +
        "a pushed tag is never moved; the next cut is counted from that tag, not through it",
    );
  } else {
    add({
      key: `tag v${candidate}`,
      status: "ok",
      value: "absent",
      source: `git tag --list 'v${candidate}'`,
    });
  }

  /* 3 — CHANGELOG.md's top entry ------------------------------------------- */
  if (changelog?.top && changelog.top !== expected) {
    bad(
      "CHANGELOG.md",
      changelog.top,
      changelogSource,
      `the newest entry is [${changelog.top}] (${changelogSource}) but package.json names ` +
        `${packageVersion} (package.json version) — the version is one source of truth, and a ` +
        "bump whose entry was not written (or written and not bumped) is a half-prepared release",
    );
  } else if (!changelog?.top) {
    bad(
      "CHANGELOG.md",
      "no entry",
      CHANGELOG,
      `${CHANGELOG} carries no '## [x.y.z] - <date>' entry`,
    );
  } else {
    add({
      key: "CHANGELOG.md",
      status: "ok",
      value: changelog.top,
      source: `${changelogSource} — the newest entry`,
    });
  }

  /* 4 — the health record --------------------------------------------------- */
  const releases = evidence.releases ?? changelog?.versions ?? [];
  const healthAllowed = recordAllowed(base, releases);
  if (!health?.version) {
    bad(
      "health record",
      "unreadable",
      HEALTH,
      `${HEALTH} carries no tree.packageVersion — the record is part of the release (#961)`,
    );
  } else if (!healthAllowed.includes(health.version)) {
    bad(
      "health record",
      health.version,
      `${HEALTH} tree.packageVersion, recorded ${health.recordedAt ?? "at an unknown instant"}`,
      `the record names ${health.version} but the tree is at ${expected} (package.json version); ` +
        `a record may be one release behind (${healthAllowed.join(" or ")}), never more — ` +
        "v1.17.0 shipped with a record naming 1.15.0 (#961, #1041)",
    );
  } else {
    add({
      key: "health record",
      status: health.version === base ? "ok" : "warn",
      value: health.version,
      source: `${HEALTH} tree.packageVersion`,
      detail:
        health.version === base
          ? undefined
          : `one release behind ${base} — the record lands after the cut (#961), so this is the normal state before it`,
    });
  }

  /* 5 — the atlas manifest -------------------------------------------------- */
  const atlasAllowed = atlasAllowedFor(state, base, candidate, releases);
  const deferred = atlas?.deferred ?? null;
  if (atlas?.version && atlasAllowed.includes(atlas.version)) {
    add({
      key: "atlas manifest",
      status: atlas.version === expected || atlas.version === base ? "ok" : "warn",
      value: atlas.version,
      source: atlas.source,
      detail:
        atlas.version === expected || atlas.version === base
          ? undefined
          : `one release behind ${base} — a capture is made per release, and the deferral is the tree's own answer`,
    });
  } else if (deferred && (deferred.version === expected || deferred.version === base)) {
    add({
      key: "atlas manifest",
      status: "warn",
      value: `deferred v${deferred.version}`,
      source: `${DEFERRALS}:${deferred.line}`,
      detail: `this release ships without a sweep, declared: ${deferred.reason}`,
    });
  } else if (!atlas?.version) {
    bad(
      "atlas manifest",
      "none",
      ATLAS_DIR,
      `no ${ATLAS_DIR}/v*/manifest.json is readable and ${DEFERRALS} carries no row for ` +
        `${expected} — the atlas either captured this release or says why it did not`,
    );
  } else {
    bad(
      "atlas manifest",
      atlas.version,
      atlas.source,
      `the newest manifest names ${atlas.version} but the tree is at ${expected} (package.json ` +
        `version); one release behind is normal (${atlasAllowed.join(" or ")}), two is the stale ` +
        "atlas this rule exists for",
    );
  }

  /* 6 — the docs' version page --------------------------------------------- */
  if (docs?.version && docs.version === expected) {
    add({ key: "docs page", status: "ok", value: `v${docs.version}`, source: docs.source });
  } else if (!docs?.version) {
    bad("docs page", "none", DOCS_CHANGELOG, `${DOCS_CHANGELOG} carries no 'v<X-Y-Z>.md' page`);
  } else {
    bad(
      "docs page",
      `v${docs.version}`,
      docs.source,
      `the newest release page names v${docs.version} (its title) but the tree is at ${expected} ` +
        "(package.json version) — the view page is part of the release commit, so a bump without " +
        `one leaves the docs describing the previous release`,
    );
  }

  /* 7 — the milestone -------------------------------------------------------- */
  const milestone = milestoneRow({ milestones, candidate, computed, base, theme: evidence.theme });
  add(milestone);

  const refusals = rows.filter((row) => row.status === "bad");
  const warnings = rows.filter((row) => row.status === "warn");
  return { state, expected, rows, refusals, warnings, kind, computed };
}

/**
 * The versions a record made *for a release* may name — the release it measured, or the one before
 * it. Both records are snapshots taken **after** a cut, so the last thing they can name is the base
 * (the newest tag), never the candidate: requiring the candidate would demand the measurement the
 * tag itself is what produces (#961 — the recorder runs from `release.sh --tag-only`).
 */
function recordAllowed(base, versions) {
  // Ordered by version, not by position: the tags come oldest → newest and the CHANGELOG newest →
  // oldest, and the same rule must read both. `previous` is the highest version below the base.
  const older = versions
    .filter((version) => compareVersions(version, base) === -1)
    .sort(compareVersions);
  const previous = older.length > 0 ? older[older.length - 1] : undefined;
  return [...new Set([base, previous].filter(Boolean))];
}

/**
 * The atlas may name the base, the release before it, or — once the release is prepared — the
 * candidate, because a capture is taken at cut time and can legitimately land before the tag.
 */
function atlasAllowedFor(state, base, candidate, versions) {
  const allowed = recordAllowed(base, versions);
  return state === "prepared" ? [...new Set([candidate, ...allowed].filter(Boolean))] : allowed;
}

/**
 * The milestone row: a refusal only when the same number is claimed twice, and otherwise the name
 * the number implies. See the header for why "some milestone names another version" is not a
 * refusal — several versioned milestones are open at once by design, so that rule would be red on
 * every healthy tree.
 */
function milestoneRow({ milestones, candidate, base, theme }) {
  const implied = theme ? `v${candidate} — ${theme}` : `v${candidate} — <theme>`;
  const source = milestones?.source ?? "gh api repos/…/milestones";

  if (!milestones || milestones.rows === null) {
    return {
      key: "milestone",
      status: "skip",
      value: "not checked",
      source,
      reason:
        "milestone evidence unavailable (gh is not authenticated here, or --milestones was not given)",
      detail: `the name the number implies: ${implied}`,
    };
  }

  const versioned = milestones.rows
    .map((row) => ({ ...row, version: versionInTitle(row.title) }))
    .filter((row) => row.version !== null);
  const claims = new Map();
  for (const row of versioned) {
    claims.set(row.version, [...(claims.get(row.version) ?? []), row]);
  }

  for (const [version, rows] of claims) {
    if (rows.length > 1) {
      const named = rows.map((row) => `#${row.number} "${row.title}"`).join(" and ");
      return {
        key: "milestone",
        status: "bad",
        value: version,
        source,
        reason:
          `${named} both name ${version} (${source}) — one release has one milestone, and a ` +
          `number claimed twice is how a pool milestone gets renamed three times in a day`,
      };
    }
  }

  const holder = claims.get(candidate)?.[0];
  if (holder) {
    return {
      key: "milestone",
      status: "ok",
      value: `#${holder.number} ${holder.title}`,
      source,
    };
  }

  const ahead = versioned
    .filter((row) => compareVersions(row.version, candidate) === 1)
    .map((row) => `#${row.number} ${row.title}`);

  return {
    key: "milestone",
    status: "warn",
    value: "none names the cut",
    source,
    detail:
      `the name this number implies: ${implied}` +
      (base ? ` ${C.dim}(computed from ${base}; not chosen)${C.off}` : "") +
      (ahead.length
        ? `\n    open and named for a later number, which is planning, not a conflict: ${ahead.join(", ")}`
        : ""),
  };
}

/** The first semver in a milestone title ("v1.22.0 — the lifecycle and the debt" → "1.22.0"). */
export function versionInTitle(title) {
  const match = /(?:^|[^\d.])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(String(title ?? ""));
  if (!match) return null;
  return isVersion(match[1]) ? match[1] : null;
}

/* ------------------------------------------------------------------ *
 * Gathering the evidence (git, the files, gh) — no decisions here
 * ------------------------------------------------------------------ */

function git(...args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readJson(path) {
  try {
    // `resolve`, not `join`: an absolute --milestones path must survive, and join() would make it
    // <repo>/home/… and report a file that exists as unreadable.
    return JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
  } catch {
    return null;
  }
}

export function repoSlug() {
  const url = git("config", "--get", "remote.origin.url");
  if (!url) return DEFAULT_SLUG;
  const match = /github\.com[:/]+([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  return match ? match[1] : DEFAULT_SLUG;
}

function newestTag() {
  const tag = git("describe", "--tags", "--abbrev=0", "--match", "v*");
  return tag && isVersion(tag.replace(/^v/, "")) ? tag : null;
}

/**
 * Every released version, oldest → newest, from the tags rather than from `CHANGELOG.md`: the
 * question "which release came before the base" must not be answered by a file one of the refusals
 * is about, or a mutated entry would cascade into a second, unrelated refusal.
 */
function releasedVersions() {
  const listing = git("tag", "--list", "v*");
  if (!listing) return [];
  return listing
    .split("\n")
    .map((tag) => tag.replace(/^v/, ""))
    .filter((version) => isVersion(version))
    .sort(compareVersions);
}

function commitsSince(ref) {
  const log = git("log", "--no-merges", "--format=%s", `${ref}..HEAD`);
  return log ? log.split("\n").filter((line) => line.length > 0) : [];
}

function tagExists(version) {
  return Boolean(git("tag", "--list", `v${version}*`));
}

function changelogEvidence() {
  let text;
  try {
    text = readFileSync(join(ROOT, CHANGELOG), "utf8");
  } catch {
    return { top: null, versions: [], source: CHANGELOG };
  }
  const versions = [];
  const pattern = /^## \[([^\]]+)\] - /gm;
  let match = pattern.exec(text);
  while (match) {
    if (isVersion(match[1])) versions.push(match[1]);
    match = pattern.exec(text);
  }
  const line = findLine(text, `## [${versions[0]}] - `);
  return {
    top: versions[0] ?? null,
    versions,
    source: versions[0] ? `${CHANGELOG}:${line}` : CHANGELOG,
  };
}

function findLine(text, needle) {
  const index = text.indexOf(needle);
  return index < 0 ? 0 : text.slice(0, index).split("\n").length;
}

function healthEvidence() {
  const record = readJson(HEALTH);
  if (!record) return { version: null };
  return {
    version: record.tree?.packageVersion ?? null,
    recordedAt: record.recordedAt ?? null,
    production: record.production?.version ?? null,
    latestTag: record.tree?.latestTag ?? null,
  };
}

/** The atlas: the newest manifest by its own `version` field, plus any deferral row. */
function atlasEvidence() {
  let newest = null;
  try {
    for (const entry of readdirSync(join(ROOT, ATLAS_DIR), { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("v")) continue;
      const path = `${ATLAS_DIR}/${entry.name}/manifest.json`;
      const manifest = readJson(path);
      const version = manifest?.version;
      if (!isVersion(version)) continue;
      if (!newest || compareVersions(version, newest.version) === 1) {
        newest = { version, source: `${path} (manifest.version)` };
      }
    }
  } catch {
    newest = null;
  }

  let deferred = null;
  try {
    const text = readFileSync(join(ROOT, DEFERRALS), "utf8");
    text.split("\n").forEach((line, index) => {
      const match = /^\|\s*v?(\d+\.\d+\.\d+[^|\s]*)\s*\|/.exec(line);
      if (!match || !isVersion(match[1])) return;
      const cells = line.split("|").map((cell) => cell.trim());
      const reason = cells.length >= 5 ? cells[4] : "";
      deferred = { version: match[1], reason: reason || "(no reason given)", line: index + 1 };
    });
  } catch {
    deferred = null;
  }

  return { ...(newest ?? { version: null }), deferred };
}

/** The docs' newest release page, by its own title (`# v1.20.0 — the walk can be paid`). */
function docsEvidence() {
  let newest = null;
  try {
    for (const file of readdirSync(join(ROOT, DOCS_CHANGELOG))) {
      if (!/^v.*\.md$/.test(file) || file === "README.md") continue;
      const path = `${DOCS_CHANGELOG}/${file}`;
      let title;
      try {
        title = readFileSync(join(ROOT, path), "utf8").split("\n")[0];
      } catch {
        continue;
      }
      const match = /^#\s+v?(\d+\.\d+\.\d+[^\s—–-]*)/.exec(title);
      if (!match || !isVersion(match[1])) continue;
      if (!newest || compareVersions(match[1], newest.version) === 1) {
        newest = { version: match[1], source: `${path} (its title)` };
      }
    }
  } catch {
    newest = null;
  }
  return newest ?? { version: null };
}

/**
 * Milestone evidence. `gh api` when it can answer, a JSON file when `--milestones` is given (a
 * scratch tree, a machine with no token, a test). Never a guess: `rows: null` means "not checked",
 * and the plan says so out loud rather than printing a green row for evidence it does not have.
 */
function milestoneEvidence(file, slug) {
  if (file) {
    const rows = readJson(file);
    if (!Array.isArray(rows)) {
      die(`--milestones ${file} is not a JSON array of {number,title}`, 2);
    }
    return {
      rows: rows
        .filter((row) => typeof row?.title === "string")
        .map((row) => ({ number: row.number ?? 0, title: row.title })),
      source: `--milestones ${file}`,
    };
  }

  const run = spawnSync("gh", ["api", `repos/${slug}/milestones?state=open&per_page=100`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (run.status !== 0) return { rows: null, source: `gh api repos/${slug}/milestones` };
  try {
    const parsed = JSON.parse(run.stdout);
    if (!Array.isArray(parsed)) return { rows: null, source: `gh api repos/${slug}/milestones` };
    return {
      rows: parsed.map((row) => ({ number: row.number, title: String(row.title ?? "") })),
      source: `gh api repos/${slug}/milestones`,
    };
  } catch {
    return { rows: null, source: `gh api repos/${slug}/milestones` };
  }
}

/**
 * `release_boundary.py` as a second reader — it is the tool the owner already trusts for "new chat
 * or not", and it is where the rule came from. Its pattern is narrower (no ` — `), so it can
 * under-count and its reading never overrides this one; it can only be *stricter*, and a stricter
 * reading is a refusal because a missed `BREAKING CHANGE` is the one direction that loses a major.
 */
function boundaryEvidence(base) {
  const script = join(process.env.HOME ?? "", ".hermes/bin/release_boundary.py");
  if (!existsSync(script)) return { available: false };
  const run = spawnSync("python3", [script, "--repo", ROOT, "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (run.status !== 0 && run.status !== 3) return { available: false };
  try {
    const payload = JSON.parse(run.stdout);
    return {
      available: true,
      nextVersion: payload.next_version,
      kind: payload.bump,
      commits: payload.commits_since_tag,
      base: payload.latest_tag ? String(payload.latest_tag).replace(/^v/, "") : base,
    };
  } catch {
    return { available: false };
  }
}

function gather({ milestones, override, theme }) {
  const slug = repoSlug();
  const baseTag = newestTag();
  const base = baseTag ? baseTag.replace(/^v/, "") : null;
  const census = censusOf(baseTag ? commitsSince(baseTag) : []);
  const computed = base ? bumpVersion(base, census.kind) : null;
  const candidate = override ?? computed;
  const changelog = changelogEvidence();

  return {
    slug,
    baseTag,
    base,
    releases: releasedVersions(),
    census,
    computed,
    candidate,
    kind: census.kind,
    theme,
    packageVersion: readJson("package.json")?.version ?? null,
    changelog,
    changelogSource: changelog.source,
    candidateTagExists: candidate ? tagExists(candidate) : false,
    health: healthEvidence(),
    atlas: atlasEvidence(),
    docs: docsEvidence(),
    milestones: milestoneEvidence(milestones, slug),
    boundary: boundaryEvidence(base),
  };
}

/* ------------------------------------------------------------------ *
 * Printing the plan
 * ------------------------------------------------------------------ */

function printPlan(evidence, result, opts) {
  const { baseTag, base, census, candidate, computed, health } = evidence;

  say(
    `${C.bold}release:cut${C.off} ${C.dim}— ${opts.mode === "plan" ? "plan (nothing is written)" : opts.mode}${C.off}`,
  );
  say();

  const head = git("rev-parse", "--abbrev-ref", "HEAD");
  const sha = git("rev-parse", "--short", "HEAD");
  say(
    `  tree          ${head ?? "detached HEAD"} @ ${sha ?? "?"} · package.json ${evidence.packageVersion ?? "?"}`,
  );
  say(
    `  census        ${baseTag ?? "(no tag)"}..HEAD — ${census.total} commit(s) ` +
      `${C.dim}(major ${census.counts.major} · feat ${census.counts.minor} · other ${census.counts.patch})${C.off}`,
  );
  if (census.total === 0) {
    say(
      `  ${C.yellow}!${C.off}${" ".repeat(13)}no commits since ${baseTag ?? "the first commit"} — this cut would be an empty release`,
    );
  }
  if (census.total > 0) {
    for (const row of census.subjects) {
      say(
        `                ${C.dim}${row.kind.padEnd(5)} ${row.section.padEnd(11)}${C.off} ${row.subject}`,
      );
    }
  }
  say(`  next cut      ${C.bold}v${candidate}${C.off} → ${census.kind}`);
  say(
    `  state         ${result.state}` +
      (result.state === "prepared"
        ? " — the release is prepared: package.json and the entry name the candidate, the tag is what is left"
        : result.state === "unbumped"
          ? ` — the release is not prepared: the tree is at ${base}, the cut bumps it to ${candidate}`
          : " — package.json names neither the base nor the candidate"),
  );
  if (opts.override) {
    say();
    say("  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    say(`  !! OVERRIDE — v${candidate} is NOT the computed number (${computed}, ${census.kind})`);
    say(`  !! reason: ${opts.reason}`);
    say("  !! --prepare writes this banner into the CHANGELOG entry: a declared artefact");
    say("  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  }
  say();

  say(`  ${C.bold}the seven values${C.off}`);
  for (const row of result.rows) {
    const glyph =
      row.status === "ok"
        ? `${C.green}✓${C.off}`
        : row.status === "bad"
          ? `${C.red}✗${C.off}`
          : row.status === "warn"
            ? `${C.yellow}–${C.off}`
            : `${C.dim}·${C.off}`;
    say(
      `  ${glyph} ${row.key.padEnd(16)} ${String(row.value ?? "").padEnd(26)} ${C.dim}${row.source}${C.off}`,
    );
    if (row.reason) say(`    ${C.red}${row.reason}${C.off}`);
    if (row.detail) say(`    ${row.detail}`);
  }

  if (evidence.boundary?.available) {
    const agrees =
      evidence.boundary.nextVersion === computed && evidence.boundary.kind === census.kind;
    say(
      `\n  ${C.dim}release_boundary.py reads ${evidence.boundary.commits} commit(s) → ` +
        `v${evidence.boundary.nextVersion} ${evidence.boundary.kind}${agrees ? " (agrees with the census)" : " (narrower separator set — the census above is the reader the entry is written by)"}${C.off}`,
    );
  } else {
    say(
      `\n  ${C.dim}release_boundary.py absent — the census above is the only reader of the commits${C.off}`,
    );
  }

  say();
  say(
    `  ${C.bold}production${C.off}    ${health.production ? `serving ${health.production} ${C.dim}(data/health/platform-health.json)` : "not recorded"}${C.off}`,
  );

  printNextSteps(evidence, opts);
}

function printNextSteps(evidence, opts) {
  const { candidate, computed, base } = evidence;
  const implied = opts.theme ? `v${candidate} — ${opts.theme}` : `v${candidate} — <theme>`;
  const tagPage = `docs/changelog/v${candidate.replace(/\./g, "-")}.md`;

  say();
  say(`  ${C.bold}milestone implied${C.off}  ${implied}`);

  if (opts.mode !== "plan") return;

  say();
  say(`  ${C.bold}next${C.off}`);
  say(
    `  1. name the milestone  gh api -X PATCH repos/${evidence.slug}/milestones/<n> -f title="${implied}"`,
  );
  say(
    `  2. prepare (writes)   pnpm release:cut --prepare --limits <file>   → entry + bump, then PR them`,
  );
  say(
    `     the view page      ${tagPage} (prose, mermaid, ≥1 screenshot, the two changelog-view markers),`,
  );
  say(
    `                        a row in docs/changelog/releases.json, then pnpm docs:nav && node scripts/changelog-view.mjs`,
  );
  say(
    `  3. merge, then tag    pnpm release:cut --execute   ${C.dim}(interactive shell only — it refuses a worker)${C.off}`,
  );
  say();
  say(
    `  ${C.dim}the number is computed from the commits, not typed: ${computed} is ${census_kind(evidence)} from ${base}${C.off}`,
  );
}

const census_kind = (evidence) =>
  `${evidence.census.kind} (${evidence.census.total} commit(s) since ${evidence.baseTag ?? "the first commit"})`;

/* ------------------------------------------------------------------ *
 * --prepare: the entry + the bump, and nothing else
 * ------------------------------------------------------------------ */

function prepare(evidence, opts) {
  const { candidate, baseTag, computed, census } = evidence;

  if (!opts.limits) {
    die(
      "--prepare needs --limits <file>: the Known limits block ships verbatim in public release notes, so a human writes it",
      2,
    );
  }
  // `resolve`, not `join`: join() concatenates, so an absolute --limits path would become
  // <repo>/home/… and a file that exists would be reported missing.
  const limitsPath = resolve(ROOT, opts.limits);
  if (!existsSync(limitsPath)) die(`--limits ${opts.limits}: no such file`, 2);
  if (evidence.changelog.versions.includes(candidate)) {
    die(
      `${CHANGELOG} already carries an entry for [${candidate}] — the release is prepared; write nothing, run --execute after it merges`,
    );
  }

  // The entry is generated by release.sh, never by a second copy of its rules: `--dry-run` prints
  // the entry on stdout (its plan goes to stderr), which is the only generation path in the repo.
  const dry = spawnSync(
    "bash",
    [join(ROOT, "scripts/release.sh"), "--dry-run", candidate, "--limits", limitsPath],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (dry.status !== 0 || !dry.stdout.trim()) {
    die(`scripts/release.sh --dry-run ${candidate} failed:\n${dry.stderr || "(no output)"}`);
  }

  let entry = dry.stdout.replace(/\s+$/, "");
  if (opts.override) {
    const [heading, ...rest] = entry.split("\n");
    const banner = [
      "",
      `> **Declared override.** The commit census computes ${computed} ` +
        `(${census.kind}, ${census.total} commit(s) since ${baseTag ?? "the first commit"}); this ` +
        `release is cut as ${candidate} by decision: ${opts.reason}`,
      ">",
      "> `pnpm release:cut` printed this banner and wrote it here so the number is a declared " +
        "artefact in a published document, never a silent one.",
    ];
    entry = [heading, ...banner, ...rest].join("\n");
  }
  entry = `${entry}\n`;

  // Insert above the newest entry, keep everything below it — release.sh's own insertion rule.
  const changelogPath = join(ROOT, CHANGELOG);
  const text = readFileSync(changelogPath, "utf8");
  const firstEntry = /^## \[/m.exec(text);
  const head = firstEntry ? text.slice(0, firstEntry.index) : text;
  const tail = firstEntry ? text.slice(firstEntry.index) : "";
  let next = `${head}${entry}\n${tail}`;

  const slug = repoSlug();
  if (!new RegExp(`^\\[${candidate.replace(/\./g, "\\.")}\\]: `, "m").test(next)) {
    next += `${baseTag ? `[${candidate}]: https://github.com/${slug}/compare/${baseTag}...v${candidate}` : `[${candidate}]: https://github.com/${slug}/releases/tag/v${candidate}`}\n`;
  }
  writeFileSync(changelogPath, next);

  const packagePath = join(ROOT, "package.json");
  const before = readFileSync(packagePath, "utf8");
  const after = before.replace(/("version":\s*")[^"]*(")/, `$1${candidate}$2`);
  if (after === before) die('package.json has no "version" line to bump');
  writeFileSync(packagePath, after);

  say();
  say(
    `  ${C.bold}prepared v${candidate} in the tree${C.off} ${C.dim}(nothing committed, nothing tagged)${C.off}`,
  );
  say(
    `    wrote   ${CHANGELOG}   entry [${candidate}] above [${evidence.changelog.top ?? "nothing"}]`,
  );
  say(`    wrote   package.json   ${evidence.packageVersion} → ${candidate}`);
  if (opts.override) say(`    wrote   the override banner into the entry, with the reason`);
  say();
  say(
    `  next:  ${`docs/changelog/v${candidate.replace(/\./g, "-")}.md`} — hand-authored (prose, mermaid, at least one screenshot)`,
  );
  say(
    `         with the two markers ${C.dim}<!-- changelog-view:begin entry -->${C.off} and ${C.dim}<!-- changelog-view:begin limits -->${C.off},`,
  );
  say(`         a {version, theme, headline} row in docs/changelog/releases.json, then:`);
  say(
    `         ${C.dim}pnpm docs:nav && node scripts/changelog-view.mjs && pnpm changelog:check${C.off}`,
  );
  say(
    `  then:  PR → merge → ${C.bold}pnpm release:cut --execute${C.off} on main, in an interactive shell`,
  );
  return 0;
}

/* ------------------------------------------------------------------ *
 * --execute: the tag, and only from a human shell
 * ------------------------------------------------------------------ */

async function execute(evidence) {
  const { candidate } = evidence;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    die(
      `--execute requires an interactive TTY — the tag belongs to a human shell, not to a piped or dispatched run. ` +
        `The plan is safe to run anywhere: pnpm release:cut --check`,
    );
  }

  say();
  say(
    `  ${C.bold}tag v${candidate}${C.off} — this runs: bash scripts/release.sh --tag-only ${candidate}`,
  );
  say(
    `  ${C.dim}that mode is the only path to a tag and to a GitHub Release; it re-records the platform`,
  );
  say(
    `  health and refuses a stale record (#1041). It needs the gate to be green and a clean tree.`,
  );
  say(`  If this shell is to run the record step, run it through the repo's env:${C.off}`);
  say(
    `  ${C.dim}  ~/.hermes/profiles/alignsynch/bin/withenv.sh <repo> pnpm release:cut --execute${C.off}`,
  );
  say();

  const answer = await ask(`  type the version to tag (v${candidate}): `);
  if (answer.trim() !== candidate && answer.trim() !== `v${candidate}`) {
    die(`confirmation '${answer.trim()}' is not v${candidate} — nothing was tagged`);
  }

  const run = spawnSync("bash", [join(ROOT, "scripts/release.sh"), "--tag-only", candidate], {
    cwd: ROOT,
    stdio: "inherit",
  });
  return run.status ?? 1;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = {
    mode: "plan",
    override: null,
    reason: null,
    limits: null,
    milestones: null,
    theme: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) die(`${arg} needs a value`, 2);
      index += 1;
      return next;
    };
    switch (arg) {
      case "--check":
        break;
      case "--prepare":
        opts.mode = "prepare";
        break;
      case "--execute":
        opts.mode = "execute";
        break;
      case "--override":
        opts.override = value();
        break;
      case "--reason":
        opts.reason = value();
        break;
      case "--limits":
        opts.limits = value();
        break;
      case "--milestones":
        opts.milestones = value();
        break;
      case "--theme":
        opts.theme = value();
        break;
      case "-h":
      case "--help":
        opts.mode = "help";
        break;
      default:
        if (/^v?\d+\.\d+\.\d+/.test(arg)) {
          die(
            `'${arg}' is a version argument, and the number is computed from the commits, never typed — ` +
              `that is the defect #1064 fixes. If a cut genuinely must carry a different number, declare it: ` +
              `pnpm release:cut --override ${arg.replace(/^v/, "")} --reason "<why>"`,
            2,
          );
        }
        die(
          `unknown argument '${arg}' (--check | --prepare | --execute | --override | --reason | --limits | --milestones | --theme)`,
          2,
        );
    }
  }

  if (opts.override !== null) {
    if (!isVersion(opts.override))
      die(`--override '${opts.override}' is not a semantic version`, 2);
    if (!opts.reason || opts.reason.trim().length === 0) {
      die(
        '--override requires --reason "<why>" — an undeclared override is exactly the silent number this replaces',
        2,
      );
    }
    if (opts.mode === "execute") {
      die(
        "--override belongs to the plan and --prepare: the tree on main already names the version it tags",
        2,
      );
    }
  } else if (opts.reason !== null) {
    die("--reason belongs to --override", 2);
  }

  if (opts.mode === "execute" && (opts.milestones !== null || opts.limits !== null)) {
    die(
      "--execute reads the live tree and the live queue: --milestones and --limits belong to the plan and --prepare",
      2,
    );
  }

  return opts;
}

const USAGE = `release:cut — the release's one state and one actor (#1064)

  pnpm release:cut [--check]                  the plan: computed number, census, the seven values
  pnpm release:cut --prepare --limits <file>   write the entry + the bump (no commit, no tag)
  pnpm release:cut --execute                   tag + publish — interactive TTY only
  pnpm release:cut --override <v> --reason "<why>"   declare a number the census did not compute
  pnpm release:cut --milestones <file>         read milestone evidence from JSON (offline, a scratch tree)
  pnpm release:cut --theme "<theme>"           the theme in the milestone name it prints

Exit: 0 the plan holds · 1 refused (the message says why) · 2 usage.`;

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.mode === "help") {
    say(USAGE);
    return 0;
  }

  // The one actor, enforced before anything is read: a dispatched worker may never run a cut. A
  // card that reaches a tag is how "Tag v1.20.0 and publish the GitHub release" became a subtask.
  if (process.env.HERMES_KANBAN_TASK) {
    die(
      `refusing to run inside a dispatched worker (HERMES_KANBAN_TASK=${process.env.HERMES_KANBAN_TASK}) — ` +
        "a cut is one actor and a worker is not it. Run it from an interactive shell. From a shell that " +
        "merely inherits the variable, `env -u HERMES_KANBAN_TASK pnpm release:cut --check` is the plan.",
    );
  }

  const evidence = gather(opts);

  if (!evidence.base) {
    die(
      "the tree carries no version tag (git tag --list 'v*' returns nothing) — a cut is counted from a tag",
    );
  }
  if (!evidence.candidate) {
    die(
      `cannot bump '${evidence.base}' — the newest tag is not a version this script can count from`,
    );
  }
  if (opts.override && !isBump(evidence.base, opts.override)) {
    die(
      `--override ${opts.override} is not a bump of ${evidence.base} (the newest tag) — a cut moves forward`,
    );
  }

  const result = evaluate(evidence);

  // A stricter reading from the boundary tool is a refusal: it would count a major this census did
  // not see, and shipping a major-numbered change as a minor is the direction that cannot be undone.
  if (
    evidence.boundary?.available &&
    evidence.boundary.kind === "major" &&
    evidence.census.kind !== "major"
  ) {
    const row = {
      key: "census",
      status: "bad",
      value: evidence.census.kind,
      source: "git log --no-merges (this script)",
      reason:
        `this census reads ${evidence.census.kind} but ~/.hermes/bin/release_boundary.py reads ` +
        `major (${evidence.boundary.commits} commit(s) since v${evidence.boundary.base}) — the ` +
        "boundary tool sees a BREAKING CHANGE this census does not; resolve it before a number is cut",
    };
    result.rows.push(row);
    result.refusals.push(row);
  }

  printPlan(evidence, result, opts);

  if (result.refusals.length > 0) {
    say();
    say(
      `  ${C.red}release:cut: ${result.refusals.length} value(s) disagree — nothing was written, nothing was tagged.${C.off}`,
    );
    say(
      `  ${C.dim}Fix the value each line names, not this check: the number is computed once, and every`,
    );
    say(`  place that records it has to say the same thing.${C.off}`);
    return 1;
  }

  if (opts.mode === "prepare") return prepare(evidence, opts);
  if (opts.mode === "execute") return execute(evidence);

  say();
  say(
    `  ${C.green}release:cut: the plan holds — v${evidence.candidate} (${evidence.census.kind}) is consistent across all seven values.${C.off}`,
  );
  return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`release:cut: ${error?.stack ?? error}\n`);
      process.exit(1);
    });
}
