/**
 * The seed's cross-process lock — one advisory lock on the branch, held across **both** phases.
 *
 * `scripts/db-seed.mjs` is deliberately two transactions: phase 1 removes the demo accounts from
 * `neon_auth`, phase 2 re-creates them through the auth server's HTTP sign-up, because a sign-up
 * cannot see an uncommitted `DELETE`. The demo branch is shared fleet-wide, so two seeds that
 * overlap used to interleave into `HTTP 422 (USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL)`: A's phase 1
 * committed the deletes, B's phase 2 re-created the three accounts, and A's sign-up was told the
 * address was taken — while A's own phase 1 had legitimately reported `0` rows removed.
 *
 * A file lock would not help: the runs come from different worktrees, with different pids, on one
 * machine or several. The lock has to be on the shared resource, which is the branch, so it is a
 * Postgres **session-level advisory lock** taken on the seed's own connection before phase 1 and
 * released after phase 2 commits. Session-level and not transaction-level on purpose: a
 * transaction-level lock would be released at phase 1's `COMMIT`, which is exactly the window
 * that has to stay closed, and a session-level lock is also what a killed process cannot wedge —
 * the backend releases every lock the session holds when the connection dies.
 *
 * This module holds only what can be decided without a database: the key, the wait budget and the
 * two sentences a waiting seeder prints. `db-seed.mjs` runs its seed at import, so anything left
 * inside it is untestable; the rules live here and `tests/demo-verify.test.ts` proves them.
 */

/**
 * The lock's namespace: `0x616c676e` is "algn" spelled as ASCII bytes, so a `pg_locks` row is
 * recognisable as this repo's without a lookup table.
 *
 * **These two numbers must never change.** Two versions of `db-seed.mjs` running side by side —
 * an old worktree and a new one, which is the normal state of this fleet — only serialise against
 * each other if they take the *same* lock. Renumbering returns the race it was written to remove,
 * silently, on every pair of trees that straddle the change.
 */
export const SEED_LOCK_NAMESPACE = 0x616c676e; // 1634494318, "algn"
export const SEED_LOCK_ID = 1; // 1 = db:seed

/** How the wait is described to a human, and the label a `pg_locks` row is read back by. */
export const SEED_LOCK_LABEL = "algn/1 (alignsynch db:seed)";

/** How long a seeder waits for a concurrent seed before giving up. */
export const DEFAULT_WAIT_SECONDS = 300;

/** How often a waiting seeder retries `pg_try_advisory_lock`. */
export const SEED_LOCK_POLL_MS = 250;

/**
 * The wait budget, in milliseconds.
 *
 * `SEED_LOCK_WAIT_SECONDS` overrides the default for a machine that knows its seeds are slow. A
 * value that is not a positive number is ignored rather than treated as zero: a typo must not
 * turn "wait for the other seed" into "fail immediately", which would be a race by configuration.
 *
 * @param {{ SEED_LOCK_WAIT_SECONDS?: string }} [env]
 */
export function waitBudgetMs(env = process.env) {
  const raw = env?.SEED_LOCK_WAIT_SECONDS;
  const seconds = Number(String(raw ?? "").trim());
  if (String(raw ?? "").trim() === "" || !Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_WAIT_SECONDS * 1000;
  }
  return Math.round(seconds * 1000);
}

/** `3.2s` / `0.4s` / `12s` — one decimal below ten seconds, whole seconds above. */
function seconds(ms) {
  const value = ms / 1000;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}s`;
}

/**
 * The holder of the lock, as one short phrase: `pid 1234 ("db:seed" on neondb, active)`, or
 * `a session this role cannot see` when `pg_locks` names no backend.
 *
 * `application_name` is every `db:*` script's own label (`db:seed`, `demo:verify`, …), so the
 * phrase answers "which tool is holding my seed back" without naming a worktree, a person or a
 * connection string. Nothing here can carry a password: the row has no such column.
 *
 * An empty `state` is dropped rather than rendered as a stray comma, and a missing `pid` means the
 * join found no `pg_stat_activity` row — a role without `pg_read_all_stats` sees the lock and not
 * the session, and saying so is better than inventing a pid.
 */
export function holderDescription(row) {
  const pid = row?.pid;
  if (pid === undefined || pid === null) return "a session this role cannot see";
  const name =
    typeof row.application_name === "string" && row.application_name.trim() !== ""
      ? `"${row.application_name.trim()}"`
      : "an unnamed session";
  const database =
    typeof row.datname === "string" && row.datname.trim() !== "" ? ` on ${row.datname.trim()}` : "";
  const state =
    typeof row.state === "string" && row.state.trim() !== "" ? `, ${row.state.trim()}` : "";
  return `pid ${pid} (${name}${database}${state})`;
}

/**
 * The line a seeder prints once, when it finds the lock taken.
 *
 * It names the wait budget and the holder, because the alternative — a silent hang — is
 * indistinguishable from a seed that died, and the operator's next move (wait, or look at the
 * other pid) depends on both facts.
 */
export function lockWaitNotice({ holder, budgetMs }) {
  return [
    `  · seed lock: ${SEED_LOCK_LABEL} is held by ${holderDescription(holder)} —`,
    `    waiting up to ${seconds(budgetMs)} for that seed to finish (two seeds on one branch collide).`,
  ].join("\n");
}

/** The line printed when the wait produced the lock. */
export function lockAcquiredNotice({ waitedMs }) {
  return `  · seed lock: acquired after ${seconds(waitedMs)} — the other seed finished.`;
}

/**
 * Why this seed is stopping, when the lock never came free.
 *
 * Deliberately not the sign-up error this defect used to produce: nothing here is a credential
 * problem, a wrong `NEON_AUTH_BASE_URL`, or a broken tree, and a message that sends the reader
 * after those costs an hour. The recovery is named, because a seed that gave up leaves the
 * branch's demo identities to the next successful run rather than to this one.
 */
export function lockTimeoutMessage({ holder, budgetMs }) {
  return [
    `the seed lock ${SEED_LOCK_LABEL} is still held by ${holderDescription(holder)} after ${seconds(budgetMs)}.`,
    "Another `pnpm db:seed` (or `pnpm demo:verify`, which seeds) is working on this branch — this is not",
    "a credentials problem and not a broken tree. Re-run when that one finishes; if it never does, the",
    "pid above is a Postgres session: clear it with pg_terminate_backend(<pid>) (a killed seed releases",
    "the lock with its connection), or raise SEED_LOCK_WAIT_SECONDS.",
    "",
    "Nothing needs repairing by hand either way: a seed that gives up leaves the content rows alone and",
    "the demo identities to the next successful run, because phase 1 deletes by email and by stored id.",
  ].join("\n");
}
