/**
 * The demo's source rule, as a pure function (#185 follow-up).
 *
 * The demo branch is restored from a **source branch**, so the source is the demo's whole supply
 * of data. Until the cutover that source was `production`, which meant every nightly reset copied
 * the live branch's runtime rows and real auth accounts onto the branch the public URL serves, for
 * as long as the emptying took. The source is now `demo-base`, a schema-only base, so production
 * data never enters the demo at all.
 *
 * That decision is only worth something if the source cannot silently drift back, so the
 * comparison lives here rather than in a comment or in someone's memory: `assertSourceResettable()`
 * in `scripts/demo-reset.mjs` refuses whatever this returns, and `tests/demo-reset.test.ts` proves
 * both directions without a Neon API key, a network call or a fake.
 *
 * It is deliberately a check on the **source**, not on the target's parent. A branch cut before
 * `demo-base` existed has `production` for a parent nobody chose, and Neon does not let a branch be
 * re-parented through the API (`PATCH …/branches/{id}` answers `nothing to update` for
 * `parent_id`). Aiming the rule at the source keeps the whole guarantee — live rows cannot reach
 * the branch a public URL serves — while letting the source be named explicitly.
 */

/**
 * The refusal for a source that is the project's default branch, or `null` when it is a named base
 * branch.
 *
 * Deliberately a *message* rather than a boolean: a pure check that returns `true` proves the
 * comparison, and a message proves the operator was told why. `null` also covers a source that is
 * not the default whatever its name, because the comparison is by id and not by string — a project
 * whose default branch is renamed is still refused. The no-source-at-all case is a different
 * refusal with its own sentence, owned by `resolveSource()`, because two rules for one case can
 * disagree.
 *
 * @param {{ name: string, id: string }} branch — the branch being reset
 * @param {{ name: string, id: string, requested: boolean, defaultBranchId: string | null }} source
 * @returns {string | null}
 */
export function sourceRefusal(branch, source) {
  if (source.defaultBranchId === null || source.id !== source.defaultBranchId) return null;

  const how = source.requested
    ? `DEMO_SOURCE_BRANCH="${source.name}" (${source.id})`
    : `its parent "${source.name}" (${source.id})`;
  return `"${branch.name}" (${branch.id}) is reset from ${how}, which is the project's default branch — a restore would copy live rows and real accounts onto the branch a public URL serves. The demo's source must be the schema-only base branch (for example "demo-base"), never production: set DEMO_SOURCE_BRANCH to that branch and re-run. Nothing was changed.`;
}
