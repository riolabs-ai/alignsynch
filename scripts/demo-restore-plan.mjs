/**
 * The restore request `scripts/demo-reset.mjs` sends, as a pure function (#185 follow-up, t_d39323cc).
 *
 * `POST /projects/{p}/branches/{b}/restore` refuses a branch that **has children** unless the body
 * carries `preserve_under_name`:
 *
 *   > Name under which to save the current branch state before restoring. Required when the branch
 *   > has children … in those cases all existing child branches are moved to the newly created
 *   > branch. — Neon API, "Restore branch to a historical state"
 *
 * The nightly reset sent `source_branch_id` alone and died on `HTTP 422 — Branch has children,
 * preserve_under_name is required` for as long as the demo branch had any branch cut from it. That
 * is a defect in this request, not a flake: the same body is refused every time.
 *
 * Two things follow from the parameter's own definition, and they are the whole design here:
 *
 * 1. **The children move.** A restore with `preserve_under_name` creates that branch holding the
 *    target's *pre-restore* state and re-parents every child onto it. So this is a one-time
 *    topology repair per incident: the branch the reset targets comes out of the restore with no
 *    children, and the next nightly run needs nothing different. `restoreRequest()` still decides
 *    from the branch it was handed rather than from a remembered flag, so a child created later
 *    (a preview branch, a manual `neon branches create`) is handled the same night it appears.
 *
 * 2. **The name has to be new.** The preserved branch is a normal branch in the project, so a name
 *    already in use is a collision — the API answers `409`, and the reset fails on a request that
 *    was otherwise correct. The name therefore carries a UTC timestamp to the second, and is
 *    checked against the project's existing branch names before it is sent (a second run inside
 *    the same second, or a hand-made branch that already looks like a timestamp, gets `-2`, `-3`…).
 *
 * What a preserved branch costs, since the parameter buys it: one branch against the project's
 * branch limit, the storage its content occupies (copy-on-write from the parent, so the delta for
 * pages written since the last restore), and no compute unless an endpoint is added — nothing reads
 * the preserved branch, so it stays a cold recovery point. The reset retires the ones it does not
 * need to keep — a preserved state that is not the newest for its branch, and any older than
 * `DEMO_PRESERVED_MAX_AGE_DAYS` — through `demo-branch-prune.mjs` (#909), because these recovery
 * points are what filled the project's ten branches and refused the restore with a raw 422. What it
 * never touches is in that module's header.
 *
 * This lives in its own module because it is the part of the reset that can be wrong without a
 * Neon key: `tests/demo-restore-plan.test.ts` proves both bodies — with children and without — and
 * the script's own `restoreFromSource()` only sends what this returns.
 */

/** Neon branch names: letters, digits, `-`, `_`, `.` — anything else is folded to `-`. */
const UNSAFE_NAME_CHARS = /[^a-zA-Z0-9._-]+/g;

/** Neon's limit on a branch name. The timestamp is the unique part, so a long stem is cut from the left. */
const MAX_NAME_LENGTH = 63;

const pad = (value) => String(value).padStart(2, "0");

/**
 * The UTC stamp that makes one run's preserved branch name distinct from another's:
 * `20261106-163146`. Seconds, not minutes: the `demo-reset` concurrency group serialises runs but
 * does not make them a minute apart, and a name reused under a second is a `409`.
 */
export function stampFor(now) {
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join("");
}

/**
 * The name the pre-restore state is preserved under: `<branch>-preserved-<UTC stamp>`, made safe
 * for Neon's branch-name rules and kept under the length limit by cutting the *stem*, never the
 * stamp. `taken` is the project's existing branch names; a collision appends `-2`, `-3`, … so the
 * run can never fail with a name the script itself picked.
 *
 * @param {string} branchName — the branch being restored
 * @param {Date} now — the run's clock (passed in, so the name is a function of an instant)
 * @param {Iterable<string>} [taken] — branch names that already exist in the project
 * @returns {string}
 */
export function preservedUnderName(branchName, now, taken = []) {
  const suffix = `-preserved-${stampFor(now)}`;
  // The stem carries the branch's own name so a preserved branch names its target; it is cut to
  // leave room for the stamp and a `-NN` collision suffix, and the *stamp* is never cut.
  const stem = `${branchName}`
    .replace(UNSAFE_NAME_CHARS, "-")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/-+$/, "")
    .slice(0, MAX_NAME_LENGTH - suffix.length - 4);
  const base = `${stem === "" ? "demo" : stem}${suffix}`;

  const existing = new Set(taken);
  if (!existing.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
}

/**
 * The body of the restore call, and the name chosen when the branch has children.
 *
 * `children` is reported back so the caller can print which branches are about to move: a reset
 * that silently re-parents somebody's preview branch is a surprise, and the run log is the only
 * place that can say it first.
 *
 * With no children the body is exactly what it was before this module existed — the parameter is
 * only legal-when-required, and omitting it is what makes "the previous state is not preserved" the
 * normal case rather than a nightly accumulation of preserved branches.
 *
 * @param {{ id: string, name: string, children?: {id: string, name: string}[], allNames?: string[] }} branch
 * @param {{ id: string }} source
 * @param {Date} now
 * @returns {{ body: { source_branch_id: string, preserve_under_name?: string }, preservedUnder: string | null, children: {id: string, name: string}[] }}
 */
export function restoreRequest(branch, source, now) {
  const children = branch.children ?? [];
  if (children.length === 0) {
    return { body: { source_branch_id: source.id }, preservedUnder: null, children };
  }

  const preservedUnder = preservedUnderName(branch.name, now, branch.allNames ?? []);
  return {
    body: { source_branch_id: source.id, preserve_under_name: preservedUnder },
    preservedUnder,
    children,
  };
}
