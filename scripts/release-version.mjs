#!/usr/bin/env node
/**
 * scripts/release-version.mjs — what counts as a version, and which way the numbers go.
 *
 * `scripts/release.sh` asks two questions about a version string, and until this module existed it
 * answered both with a pattern that only knew `x.y.z`: a pre-release (`1.1.0-rc1`) was refused as
 * "not a semantic version", so the RC could not be cut, and `--check` read the CHANGELOG heading it
 * had just been told to write as no entry at all. The ordering answer was worse: it split on `.`
 * and compared three integers, so `1.1.0-rc1 -> 1.1.0` read as "not a bump" (`"0-rc1" + 0` is 0)
 * and the release *after* the RC would have been refused too.
 *
 * Semver precedence is not integer comparison, so it lives here, once, as code with cases:
 * `scripts/release.sh` shells out to the CLI below and `tests/release-version.test.ts` asserts it.
 *
 * The token is POSIX ERE on purpose. The shell interpolates it into `grep -E` (heading and link
 * definition parsing) and this module anchors the same string for a full-match test, so there is
 * one pattern and not two that can drift. Semver 2.0.0, verbatim: no leading `v`, no leading zeros
 * in the numeric parts or in numeric pre-release identifiers (`1.1.0-01` is not a version), a build
 * suffix does not change precedence.
 *
 * CLI (exit 0 = yes, 1 = no, 2 = usage — the shell reads the exit status, not the words):
 *
 *   node scripts/release-version.mjs token              the ERE, for `grep -E` / `awk`
 *   node scripts/release-version.mjs valid <v>          is this a version at all
 *   node scripts/release-version.mjs prerelease <v>     does it carry a `-suffix`
 *   node scripts/release-version.mjs bump <from> <to>   is <to> a newer version than <from>
 *   node scripts/release-version.mjs compare <a> <b>    -1, 0 or 1
 */
import { pathToFileURL } from "node:url";

/**
 * Semver 2.0.0 as a POSIX ERE, split only so no line of it is unreadable:
 *
 *   major.minor.patch   no leading zeros          `1.0.0` yes, `01.0.0` no
 *   -prerelease         dot-separated identifiers `-rc1`, `-beta.2`, `-alpha.beta.1`
 *   +build              dot-separated identifiers `+build.5`
 *
 * Each part is optional but anchored by the callers, so `1.1.0.0`, `1.1` and `v1.1.0` do not match.
 */
export const VERSION_TOKEN = [
  "(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)",
  "(-((0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)",
  "(\\.(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?",
  "(\\+([0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*))?",
].join("");

const VERSION_RE = new RegExp(`^${VERSION_TOKEN}$`);
const NUMERIC = /^[0-9]+$/;
const CORE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)/;

/**
 * A version, or null. `prerelease` and `build` are arrays of identifiers, or null when absent — the
 * difference matters: `1.1.0-rc1` is a pre-release, `1.1.0+build.5` is a release with metadata.
 */
export function parseVersion(input) {
  if (typeof input !== "string" || !VERSION_RE.test(input)) return null;
  const core = CORE.exec(input);
  const rest = input.slice(core[0].length);

  let prerelease = null;
  let build = null;
  if (rest.startsWith("-")) {
    const plus = rest.indexOf("+");
    prerelease = rest.slice(1, plus >= 0 ? plus : undefined).split(".");
    if (plus >= 0) build = rest.slice(plus + 1).split(".");
  } else if (rest.startsWith("+")) {
    build = rest.slice(1).split(".");
  }

  return {
    major: Number(core[1]),
    minor: Number(core[2]),
    patch: Number(core[3]),
    prerelease,
    build,
  };
}

export function isVersion(input) {
  return parseVersion(input) !== null;
}

/** True for a `-suffix`. Build metadata (`+build.5`) is not a pre-release: semver says it does not
 * change precedence, and GitHub would then hide a final release behind the pre-release flag. */
export function isPrerelease(input) {
  const parsed = parseVersion(input);
  return parsed !== null && parsed.prerelease !== null;
}

/** Identifiers compare numerically when both are numeric, a number sorts below a word, words
 * compare in ASCII order, and a shorter list of equal identifiers sorts first. */
function compareIdentifiers(left, right) {
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    const a = left[i];
    const b = right[i];
    const aNumeric = NUMERIC.test(a);
    const bNumeric = NUMERIC.test(b);
    if (aNumeric && bNumeric) {
      const delta = Number(a) - Number(b);
      if (delta !== 0) return delta < 0 ? -1 : 1;
      continue;
    }
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    if (a !== b) return a < b ? -1 : 1;
  }
  if (left.length === right.length) return 0;
  return left.length < right.length ? -1 : 1;
}

/**
 * Semver precedence: -1 when `a` sorts below `b`, 0 when the two are equal precedence (a build
 * suffix never differs), 1 when it sorts above. Null when either string is not a version — the
 * caller decides what a malformed version means, this function does not guess.
 */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (left === null || right === null) return null;

  for (const part of ["major", "minor", "patch"]) {
    if (left[part] !== right[part]) return left[part] < right[part] ? -1 : 1;
  }

  if (left.prerelease === null && right.prerelease === null) return 0;
  if (left.prerelease === null) return 1; // a release outranks its own pre-release
  if (right.prerelease === null) return -1;
  return compareIdentifiers(left.prerelease, right.prerelease);
}

/** True when `to` is a newer version than `from`, which is the only thing a cut may move to:
 * `1.0.0 -> 1.1.0-rc1` and `1.1.0-rc1 -> 1.1.0` yes, `1.1.0 -> 1.1.0-rc1` and any malformed string
 * no. Equal precedence is not a bump. */
export function isBump(from, to) {
  return compareVersions(from, to) === -1;
}

/**
 * The CLI — the shell reads exit codes, not words: 0 yes, 1 no, 2 usage. Guarded so that importing
 * this module (the test suite does) neither parses argv nor exits: the shebang above makes
 * `node scripts/release-version.mjs …` the only path that reaches the switch.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);

  const answer = (yes) => process.exit(yes ? 0 : 1);

  switch (command) {
    case "token":
      process.stdout.write(`${VERSION_TOKEN}\n`);
      break;
    case "valid":
      answer(isVersion(args[0]));
      break;
    case "prerelease":
      answer(isPrerelease(args[0]));
      break;
    case "bump":
      if (args.length !== 2) process.exit(2);
      answer(isBump(args[0], args[1]));
      break;
    case "compare": {
      if (args.length !== 2) process.exit(2);
      const order = compareVersions(args[0], args[1]);
      if (order === null) process.exit(2);
      process.stdout.write(`${order}\n`);
      break;
    }
    default:
      process.stderr.write(
        "release-version: usage: token | valid <version> | prerelease <version> | " +
          "bump <from> <to> | compare <a> <b>\n",
      );
      process.exit(2);
  }
}
