/**
 * The demo's source rule, as a pure function (#185 follow-up).
 *
 * The demo branch is reset from its **parent**, so the parent is the demo's whole supply of data.
 * Until the cutover the parent was `production`, which meant every nightly reset copied the live
 * branch's runtime rows and real auth accounts onto the branch the public URL serves, for as long
 * as the emptying took. The topology is now `demo ← demo-base`, a schema-only base, so production
 * data never enters the demo at all.
 *
 * That decision is only worth something if a re-parented branch cannot silently undo it, so the
 * comparison lives here rather than in a comment or in someone's memory: `assertResettable()` in
 * `scripts/demo-reset.mjs` refuses whatever this returns, and `tests/demo-reset.test.ts` proves
 * both directions without a Neon API key, a network call or a fake.
 */

/**
 * The refusal for a branch whose parent is the project's default branch, or `null` when the
 * parent is a named base branch.
 *
 * Deliberately a *message* rather than a boolean: a pure check that returns `true` proves the
 * comparison, and a message proves the operator was told why. `null` also covers the no-parent
 * case — that is a different refusal, with its own sentence, and owning it twice would mean two
 * rules that can disagree.
 *
 * @param {{ parentId: string | null, parentName?: string | null, name: string, id: string,
 *           defaultBranchId: string | null, defaultBranchName?: string | null }} branch
 * @returns {string | null}
 */
export function parentRefusal(branch) {
  if (branch.parentId === null) return null;
  if (branch.defaultBranchId === null || branch.parentId !== branch.defaultBranchId) return null;

  const parent = branch.parentName ?? branch.defaultBranchId;
  const defaultName = branch.defaultBranchName ?? parent;
  return `"${branch.name}" (${branch.id}) is reset from its parent "${parent}" (${branch.parentId}), which is the project's default branch${defaultName === parent ? "" : ` ("${defaultName}")`} — the demo's source must be the schema-only base branch (for example "demo-base"), never production, so a restore cannot copy live data onto the branch a public URL serves. Re-parent the demo branch onto the base in the Neon console, then re-run. Nothing was changed.`;
}
