#!/usr/bin/env node
/**
 * `pnpm qa:atlas:check` — the atlas's gate step (#945): the registry and the document agree.
 *
 * This is the **static** half of the atlas, and the reason the atlas can be a gate step at all: it
 * opens no browser, no connection, and imports nothing from `lib/db/**` — so it runs in the same
 * database-free tree the rest of `scripts/verify.sh` runs in (`pnpm build` passes with no
 * `DATABASE_URL`, and this must too). The capture needs a server and the demo branch's rows; the
 * *claim* that every registered route was captured is what a gate can check, every push.
 *
 * Nine rules, each failing by the name of the thing that is wrong:
 *
 *   coverage   every route `data/pages/budget.ts` registers has a row in the current version's
 *              `manifest.json`, and the manifest carries no route the registry does not know — an
 *              atlas that quietly documents last release's route set is the drift this exists for
 *   status     the row **says what it measured**: `expected` must be the status the boundary table
 *              derives today, and a capture whose measured status disagrees must be reported as a
 *              `fail` with its reason — a mismatch filed as a pass is the contradiction this refuses.
 *              Publishing a real mismatch is the atlas's job; hiding it is what would make the gate
 *              red and teach everyone to remove the row
 *   thumb      every captured row's thumbnail exists, and nothing points outside the atlas
 *   weight     the whole atlas directory stays inside the committed budget (5 MB)
 *   skip       a skipped route carries a reason. "Skipped" is a fact with a cause, never a blank
 *   extent     the `coverage` block is complete and describes the rows it ships with — six integer
 *              fields, `captured + skipped === routes`, and the three registry counts equal to what
 *              `data/pages/budget.ts` derives today. A capture that stopped after the public pass
 *              used to be committable as a whole one, because nothing read the block (#983)
 *   commit     `captureCommit` names the commit the run captured — the manifest's own answer to "was
 *              this measured against the tree it claims?". The capture refuses to start when
 *              `/api/version` disagrees with the tree (`captureRefusal()`); this is the half a
 *              database-free check can prove, and the line it prints says which commit was measured
 *   window     the tree holds no more cuts than the retention window — the current cut plus two
 *              past ones, one past while a kept cut is over 4 MB (`qa-atlas-retention.mjs`). The
 *              failure names the cuts to remove and the command that removes them, so "the atlas
 *              tree is growing" is a finding with an action and not an observation
 *   deferral   a version with **no** manifest may ship anyway **if, and only if,** the tree declares
 *              it in `docs/qa-atlas/DEFERRED.md`: a row naming this version, dated, carrying a
 *              release commit that exists, and saying which surfaces the atlas cannot yet cover
 *              (`qa-atlas-deferral.mjs`). The rule changed because a sweep that cannot see the
 *              release's own subject — no auth modal, no stage-form embed steps, nothing for
 *              sign-in, sign-up or the Stripe flow — must not block the cut that changes them. What
 *              a deferral may never buy is **silence**: the pass prints
 *              `⚑ v<version> deferred · <reason>`, so every gate run says out loud that this
 *              release has no sweep. A stale row does not cover a newer version; a reasonless one
 *              fails by name; a version that is both captured and deferred is a contradiction and
 *              fails too. The rule for a version that *has* a manifest is untouched
 *
 * Exit 0 prints one line in the shape the release note quotes:
 *
 *   75 registry surfaces · 72 routes · 72 captured · 0 missing · 0 skipped
 *
 * …or, on a declared deferral, the deferral first and the census beside it:
 *
 *   ⚑ v1.20.0 deferred · <reason>
 *   77 registry surfaces · 74 routes · 74 deferred · 0 captured · 3 skipped
 *
 * Usage:
 *
 *   node --import ./scripts/ts-modules.mjs scripts/qa-atlas-check.mjs
 *   … --version 1.17.0     # check a specific atlas (a tree mid-bump)
 *   … --root <dir>         # check another checkout's atlas, for demonstrating the failure
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { repoRoot } from "./load-env.mjs";
import {
  RECORD as DEFERRAL_RECORD,
  bareVersion,
  commitResolves,
  deferralFor,
  deferralProblems,
  parseDeferrals,
} from "./qa-atlas-deferral.mjs";
import {
  atlasLabel,
  coverageOf,
  coverageProblems,
  currentVersion,
  deriveRows,
} from "./qa-atlas-registry.mjs";
import { PAST_CUTS, atlasCuts, mb, retentionOf, retentionProblems } from "./qa-atlas-retention.mjs";

/** The committed weight ceiling for one atlas directory. */
const BUDGET_BYTES = 5 * 1024 * 1024;

const ARGS = process.argv.slice(2);
/**
 * `--name=value` or `--name value`. Both, because the docstrings spell flags with a space and a
 * flag that silently answered `true` for the space form is exactly the kind of harness lie this
 * script exists to stop: `--root <dir>` resolved to the string "true" and the check reported the
 * tree it was standing in.
 */
const flag = (name) => {
  const entry = ARGS.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (entry === undefined) return undefined;
  if (entry.includes("=")) return entry.slice(entry.indexOf("=") + 1);
  const next = ARGS[ARGS.indexOf(entry) + 1];
  return next === undefined || next.startsWith("--") ? true : next;
};

const ROOT = flag("root") === undefined ? repoRoot : resolve(String(flag("root")));

function bytesUnder(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? bytesUnder(full) : statSync(full).size;
  }
  return total;
}

/**
 * `docs/qa-atlas/DEFERRED.md`, read into rows.
 *
 * A tree with no record file defers nothing — the absence is the switch being off, and the file's
 * own registration in `docs/docs.json` is what stops it disappearing quietly (a listed page with no
 * file is a `docs:check` failure by name). A file that exists must parse: `parseDeferrals()`
 * returns the structural problems, and they are pushed into the run's problem list whether or not
 * this version needs a deferral.
 */
function loadDeferrals(root) {
  const file = join(root, DEFERRAL_RECORD);
  if (!existsSync(file)) return { rows: [], problems: [] };
  return parseDeferrals(readFileSync(file, "utf8"));
}

function main() {
  const version = String(flag("version") ?? currentVersion());
  const label = atlasLabel(version);
  const atlasDir = join(ROOT, "docs", "qa-atlas", label);
  const manifestFile = join(atlasDir, "manifest.json");
  const problems = [];

  /**
   * 8. the retention window, first, because it is a fact about the **directory** and not about the
   * manifest: a tree that grew a fourth cut is drift whether or not the newest one is readable, and
   * a check that only ran after the manifest parsed would stay silent on exactly the tree that is
   * accumulating captures.
   */
  const cuts = atlasCuts(join(ROOT, "docs", "qa-atlas"));
  problems.push(...retentionProblems({ cuts }));
  const deferrals = loadDeferrals(ROOT);
  problems.push(...deferrals.problems);

  // `deriveRows` with `db: null` is the same derivation the generator uses, minus the row ids: the
  // route set, the area, the gate and the expectation are all facts about the tree.
  return deriveRows({ brand: "alignsynch", db: null }).then(({ rows }) => {
    const coverage = coverageOf(rows);
    const deferral = deferralFor(deferrals.rows, version);

    if (!existsSync(manifestFile)) {
      /**
       * 9. the deferral (#owner decision 2026-11-14). A version may ship without a sweep **if the
       * tree says so**: a row in `docs/qa-atlas/DEFERRED.md` naming this version, dated, carrying a
       * release commit that exists, and saying which surfaces the atlas cannot yet cover. Strict on
       * purpose — the danger of a new pass branch is that it becomes a quiet one, so a stale,
       * reasonless or unresolvable row fails by name exactly as a missing manifest does.
       */
      if (deferral === undefined) {
        problems.push(
          `docs/qa-atlas/${label}/manifest.json is missing — the tree is v${version} and no atlas ` +
            "documents it (run `pnpm qa:atlas` against the release cut)",
        );
        /**
         * A row for a *different* release is the likeliest reason a reader believes this version is
         * deferred, so the failure names it. Without this the check says "no atlas" on a file the
         * reader can see a deferral in, and the next thing they do is widen the rule.
         */
        const others = [
          ...new Set(
            deferrals.rows
              .map((row) => bareVersion(row.version))
              .filter((rowVersion) => rowVersion !== null && rowVersion !== bareVersion(version)),
          ),
        ];
        if (others.length > 0) {
          problems.push(
            `${DEFERRAL_RECORD} carries a deferral for ${others
              .map((other) => `v${other}`)
              .join(", ")}, not for v${bareVersion(version)} — a row for another release cannot ` +
              "vouch for this one; add a row for this version, or capture it",
          );
        }
        report(problems, coverage, version, null, cuts);
        return 1;
      }

      problems.push(
        ...deferralProblems({
          row: deferral,
          version,
          resolves: (sha) => commitResolves(ROOT, sha),
        }),
      );
      return report(problems, coverage, version, { deferral }, cuts);
    }

    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    if (manifest.schema !== "qa-atlas/v1") {
      problems.push(`manifest.json: schema ${manifest.schema} — this check reads qa-atlas/v1`);
    }
    if (manifest.version !== version) {
      problems.push(
        `manifest.json: documents v${manifest.version}, the tree is v${version} — an atlas for ` +
          "another release cannot vouch for this one",
      );
    }

    /**
     * A version cannot be both captured and deferred. The contradiction is worth a rule rather than
     * a shrug: a row left behind after the sweep landed keeps saying the release shipped unmeasured,
     * which is a published claim about the product that is no longer true.
     */
    if (deferral !== undefined) {
      problems.push(
        `${DEFERRAL_RECORD}:${deferral.line}: defers v${bareVersion(version)} while ` +
          `docs/qa-atlas/${label}/manifest.json captures it — a release with a sweep is not ` +
          "deferred; drop the row so the record stops claiming a gap that has closed",
      );
    }

    if (!Array.isArray(manifest.routes)) {
      problems.push("manifest.json: routes is not a list — there is no row set to check");
      report(
        problems,
        coverage,
        version,
        { manifest: { ...manifest, routes: [] }, bytes: 0 },
        cuts,
      );
      return 1;
    }

    const byRoute = new Map(manifest.routes.map((row) => [row.route, row]));
    const derived = new Map(rows.map((row) => [row.route, row]));

    /**
     * 6. the commit the run captured, and 7. the extent it claims.
     *
     * Both are facts the document states about itself, and both were write-only until #983: the
     * `coverage` block was never compared to the rows beside it, so a capture that stopped after
     * the public pass committed as a complete one, and nothing in the manifest said which commit
     * the browser had actually measured. The capture refuses to start on a version mismatch
     * (`captureRefusal()`); this is the half of that guard a database-free gate can hold.
     */
    const captured =
      typeof manifest.captureCommit === "string" ? manifest.captureCommit.trim() : "";
    if (captured === "") {
      problems.push(
        "manifest.json: captureCommit is missing — the atlas must name the commit it measured, or " +
          "a reader cannot tell which tree these screenshots describe",
      );
    } else if (!/^[0-9a-f]{40}$/.test(captured)) {
      problems.push(
        `manifest.json: captureCommit "${captured}" is not a 40-character git sha — a commit that ` +
          "cannot be resolved names no build",
      );
    }

    problems.push(
      ...coverageProblems({
        coverage: manifest.coverage,
        rows: manifest.routes,
        expected: coverage,
      }),
    );

    // 1. coverage, both directions
    for (const row of rows) {
      const claimed = byRoute.get(row.route);
      if (claimed === undefined) {
        problems.push(`${row.route}: registered in data/pages/budget.ts, missing from the atlas`);
        continue;
      }
      if (claimed.kind !== row.kind) {
        problems.push(
          `${row.route}: atlas says kind "${claimed.kind}", the registry says "${row.kind}"`,
        );
      }
      // A captured route must claim the expectation the registry derives *today*. This is the rule
      // that bites when a boundary moves: the atlas keeps its old status and the check names it.
      if (row.kind === "route" && claimed.expected !== row.expected) {
        problems.push(
          `${row.route}: atlas expects ${claimed.expected}, the boundary table says ${row.expected} ` +
            `(${row.gateReason ?? row.brandGate.kind})`,
        );
      }
      if (row.kind === "route" && claimed.brandGate?.kind !== row.brandGate.kind) {
        problems.push(
          `${row.route}: atlas records gate "${claimed.brandGate?.kind}", the page says ` +
            `"${row.brandGate.kind}"`,
        );
      }
      // 2. status against the expectation
      if (claimed.verdict !== "skipped" && claimed.kind === "route") {
        /**
         * The row must **say what it measured**. A capture that disagrees with the boundary is a
         * finding the atlas exists to publish — making the product perfect is not this check's job,
         * and a gate that failed on it would only teach people to hide the row. What is refused is
         * the **contradiction**: a mismatch reported as a pass, or a failing row carrying no
         * measured reason. Both are the atlas lying about itself, which is the drift this exists for.
         */
        if (claimed.status !== claimed.expected && claimed.verdict !== "fail") {
          problems.push(
            `${row.route}: captured status ${claimed.status} against an expected ${claimed.expected}, ` +
              `but the atlas reports "${claimed.verdict}" — a mismatch is a failure, not a pass`,
          );
        }
        if (
          claimed.verdict === "fail" &&
          (claimed.captures ?? []).every(
            (entry) => entry.verdict !== "fail" || (entry.problems ?? []).length === 0,
          )
        ) {
          problems.push(
            `${row.route}: reported as a failure with no measured reason on any capture`,
          );
        }
        if (claimed.widths.length === 0) {
          problems.push(
            `${row.route}: captured with no width — a still without a size is not evidence`,
          );
        }
      }
      // 5. a skip is a fact with a cause
      if (claimed.verdict === "skipped" && !claimed.skip?.reason) {
        problems.push(`${row.route}: skipped with no reason`);
      }
      // 3. the thumbnail it points at
      if (claimed.thumb !== null) {
        const full = join(atlasDir, claimed.thumb);
        if (!existsSync(full)) {
          problems.push(`${row.route}: thumbnail ${claimed.thumb} is missing`);
        }
      } else if (claimed.verdict === "pass" && claimed.kind === "route") {
        problems.push(`${row.route}: passed with no thumbnail`);
      }
    }

    for (const route of byRoute.keys()) {
      if (!derived.has(route)) {
        problems.push(
          `${route}: in the atlas, not in data/pages/budget.ts — the registry is the list`,
        );
      }
    }

    // 4. the committed weight
    const bytes = bytesUnder(atlasDir);
    if (bytes > BUDGET_BYTES) {
      problems.push(
        `docs/qa-atlas/${label} is ${(bytes / 1024 / 1024).toFixed(2)} MB — the committed budget ` +
          `is ${(BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB (full-size captures belong in the ` +
          "release asset, not the tree)",
      );
    }

    return report(problems, coverage, version, { manifest, bytes }, cuts);
  });
}

function report(problems, coverage, version, state, cuts = []) {
  const routes = coverage.routes;
  const manifest = state === null ? null : (state.manifest ?? null);
  const deferral = state === null ? null : (state.deferral ?? null);
  const rows = manifest === null ? [] : manifest.routes;
  const captured = rows.filter((row) => row.kind === "route" && row.verdict !== "skipped").length;
  const failing = rows.filter((row) => row.verdict === "fail").length;
  const missing = manifest === null ? routes : 0;
  const skipped = coverage.skipped.length;

  /**
   * The window, printed on both paths: a reader asking "is the atlas tree healthy?" needs the cut
   * count beside the route count, and a failure that lists routes without it reads as if the only
   * problem were a route.
   */
  const plan = retentionOf({ cuts });
  const total = cuts.reduce((sum, cut) => sum + cut.bytes, 0);
  const windowLine =
    cuts.length === 0
      ? "  window: no atlas cuts on disk — nothing to retain\n"
      : `  window: ${cuts.length} cut${cuts.length === 1 ? "" : "s"} · ${mb(total)} · ` +
        `${plan.current.label} current + ${Math.min(plan.past, Math.max(0, cuts.length - 1))} past ` +
        `(window ${1 + plan.past}${plan.bulky ? `, narrowed from ${PAST_CUTS} — a kept cut is over ${mb(plan.threshold)}` : ""})\n`;

  const deferralLine =
    deferral === null
      ? ""
      : `⚑ v${bareVersion(version)} deferred · ${deferral.reason.trim().replace(/\s+/g, " ")} — ` +
        `no atlas captures this release, and ${DEFERRAL_RECORD} is the record of it\n`;

  if (problems.length > 0) {
    process.stderr.write(
      `✗ qa:atlas:check — ${problems.length} problem${problems.length === 1 ? "" : "s"} for v${version}:\n`,
    );
    for (const problem of problems) process.stderr.write(`  ✗ ${problem}\n`);
    process.stdout.write(deferralLine);
    process.stdout.write(
      manifest !== null
        ? `  ${coverage.keys} registry surfaces · ${routes} routes · ${captured} captured · ` +
            `${failing} failing · ${missing > 0 ? `${missing} missing` : `${problems.length} problem`} · ` +
            `${skipped} skipped\n`
        : deferral !== null
          ? `  ${coverage.keys} registry surfaces · ${routes} routes · ${routes} deferred · ` +
            `0 captured · ${skipped} skipped\n`
          : `  ${coverage.keys} registry surfaces · ${routes} routes · ${captured} captured · ` +
            `${failing} failing · ${missing > 0 ? `${missing} missing` : `${problems.length} problem`} · ` +
            `${skipped} skipped\n`,
    );
    process.stdout.write(windowLine);
    return 1;
  }

  /**
   * A declared deferral is a **pass that says so**: the deferral line goes first, and the census
   * counts the routes it did not capture as `deferred` rather than pretending they were measured.
   * This is the whole point of the rule — the release may ship unmeasured, the gate may not go quiet
   * about it.
   */
  if (deferral !== null) {
    process.stdout.write(deferralLine);
    process.stdout.write(
      `  ${coverage.keys} registry surfaces · ${routes} routes · ${routes} deferred · 0 captured · ` +
        `${skipped} skipped · ${deferral.date.trim()} · commit ` +
        `${deferral.commit.trim().slice(0, 8)}\n`,
    );
    process.stdout.write(windowLine);
    return 0;
  }

  const measured = typeof manifest.captureCommit === "string" ? manifest.captureCommit : "";
  process.stdout.write(
    `  ${coverage.keys} registry surfaces · ${routes} routes · ${captured} captured · ` +
      `${failing} failing · 0 missing · ` +
      `${rows.filter((row) => row.verdict === "skipped").length} skipped · ` +
      `${(state.bytes / 1024 / 1024).toFixed(2)} MB · captured at ` +
      `${measured === "" ? "(unrecorded)" : measured.slice(0, 8)} — every registered route has a ` +
      "row, every row reports what it measured, every thumbnail resolves, the coverage block " +
      "describes the rows it ships with and the manifest names the commit it measured\n",
  );
  process.stdout.write(windowLine);
  return 0;
}

process.exit(await main());
