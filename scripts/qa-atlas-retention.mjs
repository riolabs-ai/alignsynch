/**
 * scripts/qa-atlas-retention.mjs — how many atlas cuts the tree may hold, in one place.
 *
 * The owner's rule (2026-11-14): keep **the current cut and the 2 past cuts**, and **1 past** while
 * the tree is bulky. The window holds until a finished production release is fit for official
 * launch. That sentence is easy to write and easy to drift away from, so the number lives here and
 * two callers read it — `pnpm qa:atlas:check` (which **fails** when the tree holds more cuts than
 * the window, naming the ones to remove) and `pnpm qa:atlas:prune` (which removes them). A retention
 * rule with one caller is a comment; this one has a failure mode.
 *
 * ## The window, decided rather than felt
 *
 * `current`   the newest cut by semver — the one `package.json`'s version must name.
 * `past`      **2**, or **1** when the tree is bulky.
 * `bulky`     a cut the window would keep is over **4 MB**. Measured per cut, over the cuts that
 *             stay: a 9 MB cut that is about to be pruned does not shrink the window on its way out,
 *             because the window describes what the tree holds afterwards.
 *
 * So the committed set is `1 + past` directories: three at the current weights, two if a capture
 * ever grows past 4 MB. Both numbers are asserted in `tests/qa-atlas-retention.test.ts`, and the
 * README states them for a reader who does not read tests.
 *
 * ## The manifest's rows go with the directories
 *
 * A cut is a page in `docs/docs.json` as well as a directory, and `docs:check` fails on either half
 * alone: a listed page with no file, or a file with no row ("an orphan page"). So the two applied
 * ends of the window — `pnpm qa:atlas:prune` and `pnpm qa:atlas` — own the rows, through the two
 * pure helpers at the foot of this file. They live here rather than in `qa-atlas.mjs` because that
 * script runs a capture on import: a helper a test cannot import is a helper nothing checks.
 *
 * ## What counts as a cut
 *
 * A directory under `docs/qa-atlas/` named `v<major>.<minor>.<patch>`. Nothing else — `README.md`
 * is not a cut, and a directory with another name is not a release. A cut whose `manifest.json` is
 * missing still **counts** (it is tree weight and it is still a directory someone committed), and is
 * reported as such, because a half-written cut that the check could not see would be exactly the
 * drift this file exists to stop.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Past cuts kept beside the current one. */
export const PAST_CUTS = 2;

/** Past cuts kept when the tree is bulky. */
export const BULKY_PAST_CUTS = 1;

/**
 * A single cut over this is what "too bulky" means. Not "if it feels large": a number, so the
 * check and a reader cannot disagree. A capture is ~1.9 MB today, so this is roughly a doubling.
 */
export const BULK_THRESHOLD_BYTES = 4 * 1024 * 1024;

/** `v1.17.1` → `[1, 17, 1]`; anything else → null. */
export function cutVersion(label) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(label);
  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * A cut, as the disk reports it.
 *
 * @typedef {{ label: string, version: string, bytes: number, hasManifest: boolean }} Cut
 * @typedef {{
 *   current: Cut | null,
 *   past: number,
 *   bulky: boolean,
 *   threshold: number,
 *   keep: Cut[],
 *   remove: Cut[],
 * }} RetentionPlan
 */

/** Newest first. The comparison is numeric, so `v1.9.0` sorts below `v1.10.0`. */
export function compareCuts(left, right) {
  const a = cutVersion(left) ?? [];
  const b = cutVersion(right) ?? [];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (b[index] ?? 0) - (a[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

/** Every byte under a directory, the same measure the check's budget uses. */
export function bytesUnder(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? bytesUnder(full) : statSync(full).size;
  }
  return total;
}

/**
 * The cuts on disk, newest first: `{ label, version, bytes, hasManifest }`.
 *
 * `root` is the checkout's `docs/qa-atlas` directory — passed in so a test can point at a sandbox
 * instead of the tree the gate runs in.
 *
 * @param {string} root
 * @returns {Cut[]}
 */
export function atlasCuts(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((label) => cutVersion(label) !== null)
    .sort(compareCuts)
    .map((label) => {
      const dir = join(root, label);
      return {
        label,
        version: label.replace(/^v/, ""),
        bytes: bytesUnder(dir),
        hasManifest: existsSync(join(dir, "manifest.json")),
      };
    });
}

/**
 * The window applied to a set of cuts: which stay, which go, and why.
 *
 * Pure — no filesystem — so the rule is testable without a tree and the two callers cannot disagree
 * about it. It **sorts a copy** rather than trusting its caller: the window is counted from the
 * newest directory, and a caller that handed over an unsorted list would keep the wrong cuts.
 * `remove` is oldest-first, which is the order a person deleting them would use, and the current cut
 * can never appear in it (it is `keep[0]` by construction; `pruneRefusal` asserts it again).
 *
 * @param {{ cuts: Cut[], past?: number, threshold?: number }} input
 * @returns {RetentionPlan}
 */
export function retentionOf({ cuts, past = PAST_CUTS, threshold = BULK_THRESHOLD_BYTES }) {
  const sorted = [...cuts].sort((left, right) => compareCuts(left.label, right.label));
  const window = sorted.slice(0, 1 + past);
  const bulky = window.some((cut) => cut.bytes > threshold);
  const kept = bulky ? Math.min(past, BULKY_PAST_CUTS) : past;
  return {
    current: sorted[0] ?? null,
    past: kept,
    bulky,
    threshold,
    keep: sorted.slice(0, 1 + kept),
    remove: sorted.slice(1 + kept).reverse(),
  };
}

/** MB to two places, the unit the README and the failure text both print. */
export const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * A cut's weight, in the unit that does not round it to nothing. `mb()` is the right unit for a
 * capture and the wrong one for a directory a reader must identify and delete — `0.00 MB` names no
 * directory. So kilobyte-scale cuts print in KB.
 */
export function weight(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * The check's failure text for a tree holding more cuts than the window — empty when it holds no
 * more than the window.
 *
 * The message names the cuts to remove and the command that removes them, because "too many
 * atlases" without a list is a finding nobody can act on. A cut with no `manifest.json` is named in
 * the same breath: it is weight the check cannot read, so it is a cut to remove *and* a capture that
 * should have finished.
 *
 * @param {{ cuts: Cut[], past?: number, threshold?: number }} input
 * @returns {string[]}
 */
export function retentionProblems({ cuts, past = PAST_CUTS, threshold = BULK_THRESHOLD_BYTES }) {
  const plan = retentionOf({ cuts, past, threshold });
  const problems = [];
  const window = 1 + plan.past;
  if (cuts.length > window) {
    const named = plan.remove
      .map((cut) => `docs/qa-atlas/${cut.label} (${weight(cut.bytes)})`)
      .join(", ");
    problems.push(
      `docs/qa-atlas holds ${cuts.length} cuts, the window is ${window} (the current cut + ` +
        `${plan.past} past${plan.bulky ? `, narrowed from ${past} because a kept cut is over ${mb(threshold)}` : ""}) ` +
        `— remove ${named} with \`pnpm qa:atlas:prune\``,
    );
  }
  for (const cut of cuts) {
    if (!cut.hasManifest) {
      problems.push(
        `docs/qa-atlas/${cut.label} holds no manifest.json — a cut the check cannot read is not a ` +
          "capture, it is a directory someone committed",
      );
    }
  }
  return problems;
}

/**
 * Why a prune must **refuse to run**, or `null` when it may.
 *
 * `--prune` deletes committed directories with `git rm -r`, so every refusal here exists because
 * the alternative is deleting the wrong capture and calling it retention:
 *
 *   no cuts        nothing to reason about — a tree with no atlas is a different failure, and the
 *                  check names it. Pruning here would report success over a missing board
 *   mislabelled    the newest cut's directory must be `v` + the version `package.json` carries.
 *                  Pruning against a head that is not the tree's release is how the *current*
 *                  capture gets removed: the window is counted from the newest directory, and if
 *                  that directory is not this release, "past" is one cut too far back
 *   current        the plan removes the newest cut. This cannot happen through `retentionOf` (the
 *                  current cut is `keep[0]`), which is exactly why it is asserted here: a prune
 *                  that lost its head would delete the only capture of the release being cut
 *
 * @param {{ cuts: Cut[], version: string, plan?: RetentionPlan | null }} input
 * @returns {string | null}
 */
export function pruneRefusal({ cuts, version, plan = null }) {
  if (cuts.length === 0) {
    return (
      "docs/qa-atlas holds no cut directory — there is nothing to prune, and a prune that reports " +
      "success over an empty atlas is worse than one that refuses"
    );
  }
  const newest = [...cuts].sort((left, right) => compareCuts(left.label, right.label))[0];
  const wanted = `v${String(version).replace(/^v/, "")}`;
  if (newest.label !== wanted) {
    return (
      `the newest cut is ${newest.label}, package.json carries ${version} — refusing to prune. ` +
      "The window is counted from the newest directory, so pruning against a head that is not " +
      "this tree's release removes a cut the tree still needs. Capture or fix the label first."
    );
  }
  if (plan?.remove.some((cut) => cut.label === newest.label)) {
    return (
      `the plan removes ${newest.label}, the current cut — refusing. The capture for the release ` +
      "being cut is the one directory a prune may never touch."
    );
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * `docs/docs.json` — the rows a prune drops and the row a capture adds
 * ------------------------------------------------------------------ */

/**
 * A repo-relative directory as the manifest spells it, relative to `docs/`.
 *
 * This one line is the whole of the defect this pair of helpers replaced: `removed` holds
 * `docs/qa-atlas/v1.17.0` (a path from the repository root, which is what `git rm -r` takes) while
 * a manifest row's `path` is `qa-atlas/v1.17.0/index.md` (relative to `docs/`). Comparing the two
 * directly matched nothing, so `--prune` printed `dropped 0 rows` over a directory it had just
 * deleted and `docs:check` went red on the next push — a prune is never a gate step, so nothing
 * caught it first.
 *
 * @param {string} dir
 * @returns {string} `docs/qa-atlas/v1.17.0` → `qa-atlas/v1.17.0/`
 */
function manifestPrefix(dir) {
  const posix = String(dir)
    .split("\\")
    .join("/")
    .replace(/^\.\//, "")
    .replace(/^docs\//, "");
  return `${posix.replace(/\/+$/, "")}/`;
}

/**
 * Drop every manifest row belonging to the cuts a prune removed, and name the cut that had none.
 *
 * Returns the count the run prints and the cuts it found **no row for**. That second list is the
 * failure guard and not decoration: a prefix that does not match leaves every row in place, so
 * `dropped 0` over a deletion is the signature of exactly the bug above. A removed cut with no row
 * at all is not the same fact — a directory nobody registered has nothing to drop — so the caller
 * fails on the *named* case rather than on a zero.
 *
 * @param {{ sections?: Array<{ docs?: Array<{ path?: string }> }> }} manifest mutated in place
 * @param {string[]} removed repo-relative directories, oldest first
 * @returns {{ dropped: number, unmatched: string[] }}
 */
export function pruneDocsManifest(manifest, removed) {
  const prefixes = removed.map((dir) => ({ dir: String(dir), prefix: manifestPrefix(dir) }));
  const matched = new Set();
  let dropped = 0;
  for (const section of manifest.sections ?? []) {
    const kept = [];
    for (const doc of section.docs ?? []) {
      const hit = prefixes.find((entry) => String(doc.path ?? "").startsWith(entry.prefix));
      if (hit === undefined) kept.push(doc);
      else {
        dropped += 1;
        matched.add(hit.prefix);
      }
    }
    section.docs = kept;
  }
  return {
    dropped,
    unmatched: prefixes.filter((entry) => !matched.has(entry.prefix)).map((entry) => entry.dir),
  };
}

/** The row a cut is listed as, in the shape `docs/docs.json` uses. */
const cutRowPattern = /^qa-atlas\/v\d+\.\d+\.\d+\/index\.md$/;

/**
 * Insert the row for the cut a capture just wrote, after the newest cut already listed.
 *
 * `pnpm qa:atlas` writes `docs/qa-atlas/<version>/index.md`; the page is an orphan until a row
 * exists in `docs/docs.json`, and `docs:check` fails the next push by name for both halves of it
 * ("not listed in docs/README.md — an orphan page" and "`qa-atlas/<version>/index.md` is missing").
 * Editing the manifest by hand is what that failure used to cost, on the one command a release can
 * least afford to leave half-done, so the capture registers itself.
 *
 * Idempotent: a row already listing the path is left exactly where it is, because `docs-nav` fails a
 * page listed twice and a re-capture of the same version is normal (`--render` rewrites the page
 * from the manifest on disk). Title and question are the neighbouring cuts' own shapes — the
 * question names the previous cut when there is one, and falls back to the oldest cut's wording.
 *
 * @param {{ sections?: Array<{ id?: string, docs?: Array<{ path?: string, title?: string, question?: string }> }> }} manifest mutated in place
 * @param {string} version bare (`1.19.0`) or labelled (`v1.19.0`)
 * @returns {{ inserted: boolean, path: string, title: string, question: string, index: number }}
 */
export function registerAtlasCut(manifest, version) {
  const bare = String(version).replace(/^v/, "");
  const path = `qa-atlas/v${bare}/index.md`;
  const sections = manifest.sections ?? [];
  const rows = sections.flatMap((section) => section.docs ?? []);
  const existing = rows.findIndex((doc) => doc.path === path);
  if (existing !== -1) {
    const doc = rows[existing];
    return {
      inserted: false,
      path,
      title: String(doc.title),
      question: String(doc.question),
      index: existing,
    };
  }

  const section = sections.find((candidate) =>
    (candidate.docs ?? []).some((doc) => doc.path === "qa-atlas/README.md"),
  );
  if (section === undefined) {
    throw new Error(
      "docs/docs.json lists no `qa-atlas/README.md` — the hub cannot reach the atlas, so a new cut " +
        "has no section to be listed in",
    );
  }
  const docs = section.docs ?? [];
  const cuts = docs.filter((doc) => cutRowPattern.test(String(doc.path)));
  const newest = cuts[cuts.length - 1];
  const anchor = newest ?? docs.find((doc) => doc.path === "qa-atlas/README.md");
  const at = docs.indexOf(anchor);
  const title = `QA atlas — v${bare}`;
  const question =
    newest === undefined
      ? `What did every registered surface render in v${bare}, and did it read the record it claims?`
      : `What did every registered surface render in v${bare}, and what changed since the ` +
        `${String(newest.path)
          .replace(/^qa-atlas\/v?/, "")
          .replace(/\/index\.md$/, "")} capture?`;
  docs.splice(at + 1, 0, { path, title, question });
  section.docs = docs;
  return { inserted: true, path, title, question, index: rows.length };
}
