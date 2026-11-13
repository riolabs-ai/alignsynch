/**
 * The branch-ceiling pre-flight and the preserved-branch policy (#909).
 *
 * `POST …/branches/{b}/restore` answered `HTTP 422 — branches limit exceeded` on the nightly
 * `Demo reset` for two consecutive runs (`99eedaba`, `7a531b43`) while the project held 10 of its
 * 10 branches. The run log of the second (43263203497) is the whole diagnosis: the restore that
 * failed said `children none — the body carries no preserve_under_name`, so this was the **plain**
 * body. A restore needs one free branch slot whether or not it preserves anything — Neon
 * implements it as a branch creation — and a restore that also carries `preserve_under_name`
 * creates the preserved branch on top of that.
 *
 * Two things were missing, and this module is both:
 *
 * 1. **A pre-flight that names the ceiling.** A raw `422 — branches limit exceeded` from inside
 *    the restore says nothing about which branch to retire, and it arrives after `db:migrate` has
 *    already written to the source. `prunePlan()` reads the project's branches and decides, and
 *    `capacityRefusal()` turns "still full" into a sentence that lists the branches and the count.
 * 2. **A policy that removes what the reset itself leaves behind.** `preserve_under_name` mints a
 *    `<branch>-preserved-<UTC stamp>` branch on every reset that has children to move, and nothing
 *    ever deleted one — so the ceiling was reached by the reset's own recovery points. The policy
 *    keeps the newest preserved state per parent and anything younger than
 *    `DEMO_PRESERVED_MAX_AGE_DAYS`, and prunes the rest.
 *
 * ## What is never pruned, and why the list is in the code
 *
 * `CORE_BRANCH_NAMES` (`production`, `demo`, `demo-base`), the project's default branch by its own
 * `default` flag, anything named in `DEMO_KEEP_BRANCHES`, and `EXPERIMENT_BRANCHES`. The last one
 * is not a policy detail: `coach-card`, `rel-schema-533-p1`, `initiator-crud-533-p2` and
 * `lapse-533-p3` are the owner's work-in-progress, they are not preserved snapshots, and they
 * counted as "free slots" only to a reader who did not know that. Deleting one is not this
 * script's decision and no rule here may grow into it — a future reader who finds four branches
 * "wasting" the ceiling should read this paragraph rather than "fix" it.
 *
 * A branch is a candidate only when its name parses as `<stem>-preserved-<YYYYMMDD-HHMMSS>`
 * (optionally with the `-2`, `-3` collision suffix `preservedUnderName()` appends). Anything else
 * is kept and said so: this script prunes the branches the reset created, never a branch a person
 * made.
 *
 * The clock used for "newest" and for the age rule is the **stamp in the name** — the instant the
 * state was preserved — not `created_at` from the API, so the decision is a pure function of the
 * branch list and a `now`, and `tests/demo-branch-prune.test.ts` can prove it without a key. (The
 * live preserved branches have a `created_at` copied from their parent, which is why the name's
 * stamp is the only usable instant: `demo-preserved-20261106-111855` reports
 * `created_at 2026-10-30`, the day `demo-base` was cut.)
 *
 * ## Why the API is injected
 *
 * `prunePreservedBranches()` takes `call(method, path)`. `scripts/demo-reset.mjs` passes its own
 * `neon()`; the tests pass a fake over a mutable array, so the gate and `pnpm test` make no live
 * Neon call — and the test asserts the deletion it believes it made is the only one issued.
 */

/** Branches the demo reset never deletes, whatever their name looks like. */
export const CORE_BRANCH_NAMES = ["production", "demo", "demo-base"];

/**
 * The owner's experiment branches. Never a prune candidate — see the header. If one of these is
 * ever meant to go, the owner deletes it, in a card that says so.
 */
export const EXPERIMENT_BRANCHES = [
  "coach-card",
  "rel-schema-533-p1",
  "initiator-crud-533-p2",
  "lapse-533-p3",
];

/** Neon's branch limit on this project's plan; `DEMO_BRANCH_LIMIT` overrides for another plan. */
export const DEFAULT_BRANCH_LIMIT = 10;

/** A preserved branch older than this is pruned even when it is the newest for its parent. */
export const DEFAULT_PRESERVED_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `<stem>-preserved-<YYYYMMDD>-<HHMMSS>[-N]`, the name `preservedUnderName()` builds. */
const PRESERVED_NAME = /^(.+)-preserved-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d+))?$/;

/**
 * Why a row was decided the way it was. The caller groups on this rather than on the prose, so a
 * reworded reason cannot silently change the run's summary.
 *
 * Candidates: `superseded` (a newer preserved state exists for the same branch) or `aged` (older
 * than the age limit). Kept: `default`, `core`, `keep-list`, `experiment`, `not-preserved`,
 * `newest-preserved`.
 */
export const KIND = {
  superseded: "superseded",
  aged: "aged",
  default: "default",
  core: "core",
  keepList: "keep-list",
  experiment: "experiment",
  notPreserved: "not-preserved",
  newestPreserved: "newest-preserved",
};

/**
 * The instant and parent a preserved branch's name carries, or `null` when the name is not one.
 *
 * @param {string} name
 * @returns {{ stem: string, at: Date, collision: number } | null}
 */
export function parsePreserved(name) {
  const match = PRESERVED_NAME.exec(name ?? "");
  if (match === null) return null;
  const [, stem, year, month, day, hour, minute, second, collision] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const at = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
  // A stamp that is not a real instant (`20261340-999999`) is not a preserved branch this script
  // understands; refusing to guess is what keeps the age rule from pruning on a parse artefact.
  if (Number.isNaN(at.getTime()) || at.getUTCMonth() + 1 !== parts[1]) return null;
  return { stem, at, collision: collision === undefined ? 1 : Number(collision) };
}

/**
 * `DEMO_KEEP_BRANCHES=a,b c` → `["a", "b", "c"]`. Commas or whitespace; empty entries dropped.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function keepList(env = process.env) {
  return (env.DEMO_KEEP_BRANCHES ?? "")
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/**
 * `DEMO_BRANCH_LIMIT`, else the plan's documented ceiling. A bad value is the default, not NaN.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function branchLimit(env = process.env) {
  const parsed = Number.parseInt(env.DEMO_BRANCH_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BRANCH_LIMIT;
}

/**
 * `DEMO_PRESERVED_MAX_AGE_DAYS`, else 7.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function preservedMaxAgeDays(env = process.env) {
  const parsed = Number.parseInt(env.DEMO_PRESERVED_MAX_AGE_DAYS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PRESERVED_MAX_AGE_DAYS;
}

/**
 * The decision for every branch in the project: what would be pruned, and why everything else is
 * kept. Pure — no API, no clock, no environment.
 *
 * @param {{
 *   branches: { id: string, name: string, parent_id?: string | null, default?: boolean }[],
 *   now: Date,
 *   branchName?: string,
 *   keep?: Iterable<string>,
 *   maxAgeDays?: number,
 *   ceiling?: number,
 * }} input
 * @returns {{
 *   count: number, ceiling: number, free: number, children: number,
 *   candidates: { id: string, name: string, kind: string, at: Date, reason: string }[],
 *   kept: { id: string, name: string, kind: string, reason: string }[],
 * }}
 */
export function prunePlan({
  branches,
  now,
  branchName = "demo",
  keep = [],
  maxAgeDays = DEFAULT_PRESERVED_MAX_AGE_DAYS,
  ceiling = DEFAULT_BRANCH_LIMIT,
}) {
  const keepSet = new Set(keep);
  const target = branches.find((branch) => branch.name === branchName) ?? null;
  const children =
    target === null ? 0 : branches.filter((branch) => branch.parent_id === target.id).length;

  /** Every preserved branch, grouped by the branch whose state it holds. */
  const groups = new Map();
  for (const branch of branches) {
    const parsed = parsePreserved(branch.name);
    if (parsed === null) continue;
    const list = groups.get(parsed.stem) ?? [];
    list.push({ branch, ...parsed });
    groups.set(parsed.stem, list);
  }

  /** The newest preserved state per parent — the one the policy protects. */
  const newest = new Map();
  for (const [stem, entries] of groups) {
    const top = [...entries].sort(
      (left, right) => right.at.getTime() - left.at.getTime() || right.collision - left.collision,
    )[0];
    newest.set(stem, top);
  }

  const candidates = [];
  const kept = [];
  const keepRow = (branch, kind, reason) =>
    kept.push({ id: branch.id, name: branch.name, kind, reason });

  for (const branch of branches) {
    const name = branch.name ?? "";
    if (branch.default === true) {
      keepRow(branch, KIND.default, "the project's default branch");
      continue;
    }
    if (CORE_BRANCH_NAMES.includes(name)) {
      keepRow(branch, KIND.core, "a core branch — production, demo and demo-base are never pruned");
      continue;
    }
    if (keepSet.has(name)) {
      keepRow(branch, KIND.keepList, "listed in DEMO_KEEP_BRANCHES");
      continue;
    }
    if (EXPERIMENT_BRANCHES.includes(name)) {
      keepRow(branch, KIND.experiment, "an experiment branch — the owner's call, never this job's");
      continue;
    }

    const parsed = parsePreserved(name);
    if (parsed === null) {
      keepRow(branch, KIND.notPreserved, "not a <branch>-preserved-<stamp> branch");
      continue;
    }

    const top = newest.get(parsed.stem);
    if (top !== null && top.branch.id !== branch.id) {
      candidates.push({
        id: branch.id,
        name,
        kind: KIND.superseded,
        at: parsed.at,
        reason: `not the newest preserved state for "${parsed.stem}" — ${top.branch.name} is`,
      });
      continue;
    }

    const ageDays = (now.getTime() - parsed.at.getTime()) / DAY_MS;
    if (ageDays > maxAgeDays) {
      candidates.push({
        id: branch.id,
        name,
        kind: KIND.aged,
        at: parsed.at,
        reason: `older than ${maxAgeDays} day(s) (${Math.floor(ageDays)} days old)`,
      });
      continue;
    }

    keepRow(
      branch,
      KIND.newestPreserved,
      `the newest preserved state for "${parsed.stem}", ${Math.floor(ageDays)} day(s) old`,
    );
  }

  // Oldest first: a run that can only free one slot frees the least useful one.
  candidates.sort((left, right) => left.at.getTime() - right.at.getTime());

  return {
    count: branches.length,
    ceiling,
    free: ceiling - branches.length,
    children,
    candidates,
    kept,
  };
}

/**
 * `null` when the restore has room, otherwise the refusal sentence the run prints instead of a
 * raw `422`.
 *
 * `needed` defaults to **1**, and that is measured rather than assumed: the run at 10 of 10 sent
 * the plain body (`children none — the body carries no preserve_under_name`, run 43263203497) and
 * was answered `branches limit exceeded`, so a restore spends a branch slot even when it preserves
 * nothing. A restore that also carries `preserve_under_name` creates the preserved branch on top
 * of that; the caller says so in its own line rather than folding it into the refusal, because a
 * project one slot short would otherwise be refused for a run that might have fit.
 *
 * @param {{
 *   branchName: string,
 *   count: number,
 *   ceiling: number,
 *   needed?: number,
 *   prunable?: { name: string, reason: string }[],
 *   kept?: { name: string, reason: string }[],
 * }} input
 * @returns {string | null}
 */
export function capacityRefusal({
  branchName,
  count,
  ceiling,
  needed = 1,
  prunable = [],
  kept = [],
}) {
  if (count + needed <= ceiling) return null;

  const prunableLine =
    prunable.length === 0
      ? "no branch in this project is prunable by the preserved-branch policy"
      : `prunable by the preserved-branch policy: ${prunable
          .map((entry) => `${entry.name} (${entry.reason})`)
          .join("; ")}`;
  const keptLine =
    kept.length === 0
      ? ""
      : ` Kept on purpose: ${kept.map((entry) => `${entry.name} — ${entry.reason}`).join("; ")}.`;

  return `cannot reset "${branchName}": the project holds ${count} branch(es) and its limit is ${ceiling}, and a restore needs ${needed} free slot(s) — a restore creates a branch even when "${branchName}" has no children, so at the ceiling it is refused before it starts. ${prunableLine}.${keptLine} Delete a branch in the Neon console (or name one you want kept in DEMO_KEEP_BRANCHES), then re-run. Nothing was changed.`;
}

/**
 * Deletes the branches `prunePlan()` named, one `DELETE /projects/{p}/branches/{b}` each.
 *
 * A failed deletion does not abort the rest: the caller re-reads the branch list and lets
 * `capacityRefusal()` decide with the truth, which is the only thing that makes the run's next
 * sentence accurate. Errors are collected by name, never thrown as a raw API body.
 *
 * @param {{
 *   projectId: string,
 *   plan: ReturnType<typeof prunePlan>,
 *   call: (method: string, path: string) => Promise<unknown>,
 *   dryRun?: boolean,
 * }} input
 * @returns {Promise<{ deleted: { id: string, name: string }[], failed: { name: string, error: string }[] }>}
 */
export async function prunePreservedBranches({ projectId, plan, call, dryRun = false }) {
  const deleted = [];
  const failed = [];
  if (dryRun) return { deleted, failed };

  for (const candidate of plan.candidates) {
    try {
      await call(
        "DELETE",
        `/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(candidate.id)}`,
      );
      deleted.push({ id: candidate.id, name: candidate.name });
    } catch (error) {
      failed.push({ name: candidate.name, error: error?.message ?? String(error) });
    }
  }
  return { deleted, failed };
}
