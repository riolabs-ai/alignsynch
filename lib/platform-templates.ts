/**
 * The platform's template set — the **one** list a public surface may advertise and the seed
 * writes to the database (#1099).
 *
 * ## The defect this module closes
 *
 * `/relationship-templates` drew its cards straight from `data/relationship-types.ts` (the
 * taxonomy) while `/dashboard/templates/<slug>/create` resolved from the **database**
 * (`readLibraryTemplate`). Two sources, no check: production's catalogue advertised 27 create
 * links and 25 of them answered 404, because only the four fixture-era template rows had ever
 * been written there. The demo served them all, so nothing local could see it.
 *
 * The taxonomy is still where a card's *words* come from — name, roles, realm, price — and it
 * must be: a template does not price itself (#798). What it must not do is decide *which*
 * templates exist. That set is this one, derived from `data/assessments.ts`, which is both what
 * the seed writes to `record` and therefore what any read can resolve. An advertised-but-unserved
 * template is therefore a set-membership question, answerable in a test with no database.
 *
 * ## Published, because a draft is not readable by a stranger
 *
 * `readLibraryTemplate` returns a `draft` to its author only, so a draft template is invisible to
 * a signed-out visitor by design — advertising one would be the same dead link in a different
 * state. The fixture marks every template the platform offers `published`; a draft here means
 * "not offered yet", and it stays out of both the catalogue and the count.
 *
 * `data/assessments.ts` stays the **seed source**, never the page's paint: this module is a
 * projection of it (which slugs, not what the page prints), and `scripts/db-templates-import.mjs`
 * writes exactly these rows. `tests/catalogue-served-templates.test.ts` holds the two ends equal.
 *
 * Free of React, Next and `lib/db/**` — the catalogue is prerendered and the gate runs with no
 * `DATABASE_URL`, so the guarantee this module offers has to be static.
 */
import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";

/**
 * Every template the platform serves: the fixture's published records.
 *
 * The order is `data/assessments.ts`'s own (the hand-authored four, then the taxonomy's
 * catalogue), which is not the order a surface draws them in — the catalogue groups by realm, in
 * the taxonomy's order. Nothing should depend on this order except the import's own report.
 */
export const platformTemplates: readonly Assessment[] = assessments.filter(
  (template) => template.status === "published",
);

/** The slugs of `platformTemplates`, in the same order. */
export const platformTemplateSlugs: readonly string[] = platformTemplates.map(
  (template) => template.slug,
);

/** Is `<slug>` a template the platform serves to a signed-out visitor? */
export function isPlatformTemplate(slug: string): boolean {
  return platformTemplateSlugs.includes(slug);
}
