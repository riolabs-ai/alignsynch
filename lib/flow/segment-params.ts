/**
 * The one translation between a segment named `[id]` and a stage that wants a slug (#1109).
 *
 * **Why a helper and not two lines in each of five routes.** Next refuses two different dynamic
 * segment names at the same level, so the create flow — whose URLs carry a template **slug** — had to
 * live under the editor's `[id]` segment at `/dashboard/templates/<x>/create…`. Nothing else about
 * the flow changed: the stage modules still take `params: Promise<{ slug: string }>` and still mean
 * slug. This is the seam, written once so five route files cannot drift into five slightly different
 * readings of the same parameter, and so the reason is stated where the rename actually happens.
 *
 * Renaming the parameter a URL carries is a fact about how Next names segments, not a change to what
 * the flow reads: `resolveTemplateHandle()` in `lib/db/template-library.ts` is still what turns that
 * slug into the `record.id` the draft cookie and the writers key on.
 */
export function slugFromSegmentParams(params: Promise<{ id: string }>): Promise<{ slug: string }> {
  return params.then(({ id }) => ({ slug: id }));
}
