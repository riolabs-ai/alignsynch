#!/usr/bin/env node
/**
 * scripts/release-approval.mjs — the artifact that lets `--execute` tag without a TTY, and nothing else.
 *
 * `scripts/release-cut.mjs --execute` used to have exactly one door: an interactive terminal, a
 * printed plan and the version typed back. That guard exists because a tag is irreversible and a
 * dispatched worker must never take one. It has a cost, though: the cut cannot run from a cron, a
 * remote shell, or any place where a human is present but a TTY is not — and the pressure that
 * creates is to loosen the guard, which is the one thing that must not happen.
 *
 * So the door gains a second lock instead of a key: an **approval recorded in the repository**,
 * checked against the exact commit. `docs/releases/<candidate>.approval.json`, committed to `main`:
 *
 *     {
 *       "version": "1.22.0",
 *       "commit": "<40-hex sha that is on origin/main>",
 *       "approved_by": "<github login>",
 *       "approved_at": "<ISO-8601>",
 *       "url": "https://github.com/riolabs-ai/alignsynch/issues/<n>#issuecomment-<id>",
 *       "reason": "optional one line"
 *     }
 *
 * **This module never writes that file.** No `--prepare`, no `--check`, no `--execute`, no flag and
 * no side effect of a cut produces it: a self-issued approval is not an approval, and the whole
 * value of the mechanism is that the artifact is a human act, reviewable in a diff, naming a person.
 * The script only *reads* it. (The record of the cut that used it lives elsewhere — see
 * `scripts/release-record.mjs::recordApproval` — so nothing in the read path can mint one.)
 *
 * ---------------------------------------------------------------------------------------------
 * The version spelling
 * ---------------------------------------------------------------------------------------------
 * `version` is written **without** the leading `v` — `"1.22.0"`, never `"v1.22.0"` — because that
 * is the spelling `package.json`, the CHANGELOG heading and `release-version.mjs` all use, and a
 * candidate is bare everywhere it is compared. On read either form is accepted and normalised
 * (`v1.22.0` → `1.22.0`), because refusing a file over one character teaches people to edit the
 * check instead of the file. The file *name* is `docs/releases/<candidate>.approval.json`, also
 * bare.
 *
 * ---------------------------------------------------------------------------------------------
 * The keys are strict
 * ---------------------------------------------------------------------------------------------
 * Exactly `version`, `commit`, `approved_by`, `approved_at`, `url` and the optional `reason`. An
 * unknown key is an error, not a comment: a file that carries `"note"` or `"ticket"` is a file whose
 * author believed something else was being recorded, and reporting it is the honest answer.
 *
 * ---------------------------------------------------------------------------------------------
 * The checks, in order, each naming both sides
 * ---------------------------------------------------------------------------------------------
 *   artifact    exists, parses, carries exactly those keys, none empty
 *   version     the artifact approves the candidate the cut computed            (both versions named)
 *   approved_at a readable ISO-8601 instant
 *   commit      the artifact approves `git rev-parse HEAD`                      (both shas named)
 *   main        and that commit *is* `origin/main` — a pre-approval for a commit that is only on a
 *               branch is refused, not warned: the tag would publish something nobody approved
 *   tree        `git status --short` is empty — the gate checks the tree, so an approval cannot
 *               cover dirt; a cut from a dirty tree tags a commit plus everything uncommitted
 *   approver    `approved_by` is non-empty and is not a bot account — an approval names a person
 *   url         a comment or issue on this repository, so the approval is readable where it was made
 *
 * Exit/usage: this module exports rules; `scripts/release-cut.mjs` is the only caller.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where an approval lives, relative to the repository root. */
export const APPROVAL_DIR = "docs/releases";
export const APPROVAL_SUFFIX = ".approval.json";

/** The slug the approval URL must name, unless the caller (a test, a fork) passes another. */
export const DEFAULT_SLUG = "riolabs-ai/alignsynch";

/** Every key the artifact carries, and the one that may be absent. */
export const REQUIRED_KEYS = ["version", "commit", "approved_by", "approved_at", "url"];
export const OPTIONAL_KEYS = ["reason"];
export const APPROVAL_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

/**
 * Accounts that may not approve, whatever their display name says. The org and the bot profile are
 * the two that have actually pushed here; `[bot]` and `-bot` suffixed logins are the GitHub Apps.
 */
export const BOT_LOGINS = ["riolabs-ai", "alignsynch", "github-actions", "dependabot", "renovate"];

/**
 * @typedef {{ code: string, message: string }} ApprovalProblem
 * @typedef {{ ok: true, approval: Record<string, string> } | { ok: false, problems: ApprovalProblem[] }} ApprovalRead
 * @typedef {{
 *   candidate: string,
 *   root?: string,
 *   path?: string,
 *   read?: (path: string) => ApprovalRead,
 *   headSha?: string | (() => string | null),
 *   originMainSha?: string | (() => string | null),
 *   status?: string | (() => string | null),
 *   slug?: string,
 * }} ApprovalSpec
 */

/** `1.22.0` from `1.22.0` or `v1.22.0`; the one normalisation the whole module agrees on. */
export function bareVersion(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[vV]/, "");
}

/** The artifact's path for one candidate. Bare version in the name, always. */
export function approvalPath(root, candidate) {
  return join(root, APPROVAL_DIR, `${bareVersion(candidate)}${APPROVAL_SUFFIX}`);
}

/** True when a login is a bot: the known accounts, anything `[bot]`-suffixed, anything `-bot`. */
export function isBotLogin(login) {
  const name = String(login ?? "")
    .trim()
    .toLowerCase();
  if (name === "") return false;
  return BOT_LOGINS.includes(name) || name.endsWith("[bot]") || name.endsWith("-bot");
}

/** The pattern an approval URL must match — an issue, a pull request, or one comment on either. */
export function approvalUrlPattern(slug = DEFAULT_SLUG) {
  const escaped = String(slug).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https://github\\.com/${escaped}/(issues|pull)/\\d+(#issuecomment-\\d+)?$`);
}

/**
 * Shape problems: not an object, an unknown key, a missing or empty required key.
 *
 * Returned separately from `approvalProblems` because these are failures of the *file* rather than
 * of what it says — a caller that reports "version mismatch" for a file that also misspelled
 * `approved_by` sends the author to the wrong line.
 *
 * @param {unknown} value
 * @returns {ApprovalProblem[]}
 */
export function approvalShapeProblems(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [
      {
        code: "approval-keys",
        message: "artifact — the approval is not a JSON object",
      },
    ];
  }

  const problems = [];
  const unknown = Object.keys(value).filter((key) => !APPROVAL_KEYS.includes(key));
  if (unknown.length > 0) {
    problems.push({
      code: "approval-keys",
      message:
        `artifact — unknown key(s) ${unknown.map((key) => `'${key}'`).join(", ")}; ` +
        `the artifact carries exactly ${APPROVAL_KEYS.join(", ")} and nothing else`,
    });
  }

  const missing = REQUIRED_KEYS.filter(
    (key) => typeof value[key] !== "string" || value[key].trim() === "",
  );
  if (missing.length > 0) {
    problems.push({
      code: "approval-keys",
      message: `artifact — missing or empty key(s) ${missing.map((key) => `'${key}'`).join(", ")}`,
    });
  }
  if (
    value.reason !== undefined &&
    (typeof value.reason !== "string" || value.reason.trim() === "")
  ) {
    problems.push({
      code: "approval-keys",
      message: "artifact — 'reason' is optional, but when present it is a non-empty one line",
    });
  }

  return problems;
}

/**
 * Read one artifact. Returns `{ ok: true, approval }` or `{ ok: false, problems }` — never throws,
 * so a missing file and a malformed one are the same kind of answer to the caller.
 *
 * @param {string} path
 * @returns {ApprovalRead}
 */
export function readApproval(path) {
  if (!existsSync(path)) {
    return {
      ok: false,
      problems: [
        {
          code: "approval-missing",
          message:
            `artifact — there is no approval at ${path}; a cut without a TTY needs one, ` +
            "authored by hand and committed to main (the script never writes it)",
        },
      ],
    };
  }

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    return {
      ok: false,
      problems: [{ code: "approval-unreadable", message: `artifact — ${path} — ${error.message}` }],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        {
          code: "approval-unreadable",
          message: `artifact — ${path} is not JSON: ${error.message}`,
        },
      ],
    };
  }

  const shape = approvalShapeProblems(parsed);
  if (shape.length > 0) return { ok: false, problems: shape };
  return { ok: true, approval: parsed };
}

/**
 * Every way this approval fails to cover this cut, as named problems in the order a reader fixes
 * them. Both sides of every disagreement are in the message: "mismatch" alone is a riddle.
 *
 * @param {Record<string, string>} approval
 * @param {{ candidate: string, headSha?: string | null, originMainSha?: string | null, status?: string | null, slug?: string, now?: number }} context
 * @returns {ApprovalProblem[]}
 */
export function approvalProblems(approval, context) {
  const {
    candidate,
    headSha,
    originMainSha,
    status,
    slug = DEFAULT_SLUG,
    now = undefined,
  } = context ?? {};
  const problems = [];
  const want = bareVersion(candidate);

  const approved = bareVersion(approval?.version);
  if (approved !== want) {
    problems.push({
      code: "version-mismatch",
      message:
        `version — the artifact approves ${approval?.version}, and this cut computes ${want} ` +
        `(${APPROVAL_DIR}/${want}${APPROVAL_SUFFIX})`,
    });
  }

  const at = String(approval?.approved_at ?? "").trim();
  if (!Number.isFinite(Date.parse(at))) {
    problems.push({
      code: "approved-at-invalid",
      message: `approved_at — '${at}' is not an ISO-8601 instant`,
    });
  } else if (Number.isFinite(now) && Date.parse(at) > now) {
    problems.push({
      code: "approved-at-invalid",
      message: `approved_at — ${at} is in the future, so it records no approval that happened`,
    });
  }

  const approvedCommit = String(approval?.commit ?? "")
    .trim()
    .toLowerCase();
  const head = String(headSha ?? "")
    .trim()
    .toLowerCase();
  if (approvedCommit !== head) {
    problems.push({
      code: "commit-mismatch",
      message: `commit — the artifact approves ${approvedCommit || "(nothing)"}, HEAD is ${head || "(unreadable)"}`,
    });
  }

  const main = String(originMainSha ?? "")
    .trim()
    .toLowerCase();
  if (main === "" || head !== main) {
    problems.push({
      code: "commit-not-on-main",
      message:
        `commit — HEAD (${head || "(unreadable)"}) is not origin/main (${main || "(unreadable)"}); ` +
        "a pre-approval covers one commit and a tag may only sit on the head of main",
    });
  }

  const tree = typeof status === "string" ? status.trim() : null;
  if (tree === null) {
    problems.push({
      code: "tree-unknown",
      message: "tree — `git status --short` could not be read, so the tree is not proven clean",
    });
  } else if (tree !== "") {
    const count = tree.split("\n").filter((line) => line.trim() !== "").length;
    problems.push({
      code: "tree-dirty",
      message:
        `tree — git status --short names ${count} path(s); the gate checks the tree, so an ` +
        "approval cannot cover dirt — commit or stash them, then cut again",
    });
  }

  const approver = String(approval?.approved_by ?? "").trim();
  if (approver === "") {
    problems.push({
      code: "approved-by-missing",
      message: "approved_by — the artifact names no approver; an approval names a person",
    });
  } else if (isBotLogin(approver)) {
    problems.push({
      code: "approved-by-bot",
      message: `approved_by — '${approver}' is a bot account; an approval must name a person`,
    });
  }

  const url = String(approval?.url ?? "").trim();
  if (!approvalUrlPattern(slug).test(url)) {
    problems.push({
      code: "url-invalid",
      message:
        `url — '${url}' is not an issue, pull request or comment on github.com/${slug}; ` +
        "the approval has to be readable where it was made",
    });
  }

  return problems;
}

/**
 * The whole gate in one call: read the artifact for a candidate, then judge it against the tree.
 *
 * `read`, `headSha`, `originMainSha` and `status` are injectable so the rule is a pure function of
 * five values (a test never needs a repository), and the defaults are the real ones.
 *
 * @param {ApprovalSpec} spec
 * @returns {{ ok: boolean, path: string, problems: ApprovalProblem[], approval?: Record<string, string> }}
 */
export function preApproval(spec) {
  const {
    candidate,
    root = "",
    read = readApproval,
    headSha,
    originMainSha,
    status,
    slug = DEFAULT_SLUG,
  } = spec ?? {};
  const artifact = spec?.path ?? approvalPath(root, candidate);
  const found = read(artifact);
  if (!found.ok) return { ok: false, path: artifact, problems: found.problems };

  const problems = approvalProblems(found.approval, {
    candidate,
    headSha: typeof headSha === "function" ? headSha() : headSha,
    originMainSha: typeof originMainSha === "function" ? originMainSha() : originMainSha,
    status: typeof status === "function" ? status() : status,
    slug,
  });
  if (problems.length > 0) return { ok: false, path: artifact, problems };
  return { ok: true, path: artifact, problems: [], approval: found.approval };
}

/** The line `--execute` prints before it tags: who approved what, and where it is readable. */
export function approvalBanner(approval) {
  return (
    `pre-approved by ${String(approval?.approved_by).trim()} at ${String(approval?.url).trim()} ` +
    `for commit ${String(approval?.commit).trim()}`
  );
}

/**
 * The typed half of the interactive path, kept here so it is testable without a TTY: only the bare
 * version or `v<version>` is a confirmation.
 */
export function confirmTypedVersion(answer, candidate) {
  const typed = String(answer ?? "").trim();
  const want = bareVersion(candidate);
  if (typed === want || typed === `v${want}`) return { ok: true };
  return { ok: false, problem: `confirmation '${typed}' is not v${want} — nothing was tagged` };
}

/** The one thing both doors run, as data: `bash scripts/release.sh --tag-only <candidate>`. */
export function tagOnlyPlan(root, candidate) {
  return {
    command: "bash",
    args: [join(root, "scripts", "release.sh"), "--tag-only", bareVersion(candidate)],
  };
}
