/**
 * The brand boundary — what the quiz product is allowed to say under the alignment brand (#300).
 *
 * The tree ships two products from one build. `BRAND` picks the template, and most differences are
 * copy (the front page, the shell, the footer's columns). The quiz product is different: it is not
 * a *skin* of the alignment product, it is a product that does not exist there. Its catalogue, its
 * records, its authoring pair and its games answered `200` on the AlignSynch build, which is how
 * fifty-two wrong statements about quizzes ended up served under an alignment product's name — the
 * surfaces were speaking for a business they are not.
 *
 * So the boundary is a **gate**, not a deletion. Every affected route, fixture and component stays
 * exactly where it is (they are the catalogue asset, and the quiz build still ships them); the
 * route simply answers 404 for a brand that does not sell it.
 *
 * ## Why a flag and not `BRAND === "alignsynch"`
 *
 * A second brand check would be a second place that knows which product a build is, and the repo
 * already has one: `data/flags.ts`'s `templates` field ("an explicit per-template on") resolved by
 * `lib/flags.ts`. `product.quiz-surfaces` is `default: false, templates: ["quizhub"]`, so this gate
 * is the same resolver `/leaderboard` reads, and the operator's `FLAG_PRODUCT_QUIZ_SURFACES=1`
 * escape hatch comes for free — a reviewer can look at the quiz product on an alignment build
 * without editing code.
 *
 * ## One helper, not twenty-two copies
 *
 * The pages call `requireQuizProduct()` and nothing else; the flag name, the resolution and the
 * `notFound()` live here. A page that wants to know whether to *link* somewhere should read
 * `hiddenNavHrefs()` (the same flag, the nav's half) instead — this module throws, so it is for a
 * route, never for a component deciding what to draw.
 *
 * ## The order
 *
 * `notFound()` is the first statement of each gated page, ahead of `await params` and ahead of
 * every fixture or row read — the order `/leaderboard` documents. A gated surface that renders
 * nothing because nothing was read is what a 404 is supposed to mean; a gated surface that reads
 * first and hides afterwards has already done the work, and a 403 would have told the visitor the
 * surface exists.
 *
 * ## The second capability (#509)
 *
 * `requireAdminProduct()` below is the same idea for the operator console: a *capability* a
 * template inherits or turns off, rather than a product one template sells. It reads its own flag
 * (`product.admin`) through the same resolver, for the same reasons, and lands before the console's
 * `requireAdmin()` so a template without the console answers a 404 rather than a sign-in page. The
 * twenty-two quiz routes and the three console entry points are the only surfaces either gate
 * covers; nothing else in the tree is closed by a brand.
 */
import type { FlagName } from "@/data/flags";
import { isEnabled } from "@/lib/flags";
import { notFound } from "next/navigation";

/**
 * The gate's flag. Typed as `FlagName`, so renaming it in `data/flags.ts` fails `tsc` here rather
 * than resolving an undeclared name at request time.
 */
export const QUIZ_PRODUCT_FLAG: FlagName = "product.quiz-surfaces";

/**
 * Does **this build** ship the quiz product? `true` on `BRAND=quizhub`, `false` on
 * `BRAND=alignsynch`, unless the environment override says otherwise.
 *
 * Server-only, because `isEnabled` is: the brand is a build constant, so nothing about this is a
 * value a browser may decide.
 */
export function quizProductShipped(): boolean {
  return isEnabled(QUIZ_PRODUCT_FLAG);
}

/**
 * The route gate. Call it first in a page the quiz product owns:
 *
 * ```ts
 * export default async function Page({ params }: { params: Promise<{ id: string }> }) {
 *   requireQuizProduct();
 *   const { id } = await params;
 *   …
 * }
 * ```
 *
 * Returns nothing when the surface exists on this build, and throws Next's not-found when it does
 * not — the same 404 an unknown URL gets, so a visitor cannot tell a surface this product does not
 * sell from one that never existed.
 */
export function requireQuizProduct(): void {
  if (!quizProductShipped()) notFound();
}

/* ------------------------------------------------------------------ *
 * The admin console, as the second capability (#509)
 * ------------------------------------------------------------------ */

/**
 * The console's switch. `product.admin`, beside `product.quiz-surfaces` in `data/flags.ts`.
 *
 * The question is the same one at a different scale: the quiz product is a *product* one template
 * sells and another does not, and the operator console is a *capability* a template inherits or
 * turns off. A derived product must be able to say "no console" without editing six pages or, worse,
 * without the pages being written on the assumption that the console is always there — which is why
 * this switch lands before the Admin 2.0 screens (#500/#509) rather than after them.
 *
 * **Why a flag, and not a field on the `Brand` record.** The card that asked for this named the
 * brand record, and the tree's answer is more specific: the per-template record of *which surfaces a
 * template claims* is `data/flags.ts`'s `templates` field, and `product.quiz-surfaces` — the
 * capability this one sits beside — lives there. A second field on `Brand` would be a second switch
 * with a different resolver, no env lever, and no `hiddenNavHrefs()` half, and the next screen would
 * have to guess which one it read. One resolver, one operator lever (`FLAG_PRODUCT_ADMIN=0`), one
 * place a reviewer reads.
 *
 * **On for both templates that exist today.** `templates: ["quizhub", "alignsynch"]`, `default:
 * false`: every brand a build can select right now ships the console, and a template that has not
 * named itself does not. That is the "fixture brand" the tests use — a template id the record does
 * not carry — and it is a template id rather than a `Brand` record on purpose: `resolveBrand()`
 * refuses a brand this tree does not ship, so a fake record would have to be registered in
 * `brands`, would become a legal `BRAND` value, and would force every `switch (BrandId)` to answer
 * for a product that must never ship.
 */
export const ADMIN_PRODUCT_FLAG: FlagName = "product.admin";

/** Does **this build** ship the operator console? Server-only, like every flag read. */
export function adminProductShipped(): boolean {
  return isEnabled(ADMIN_PRODUCT_FLAG);
}

/**
 * The route gate for a surface the console owns:
 *
 * ```ts
 * export default async function Page() {
 *   requireAdminProduct();
 *   await requireAdmin({ next: "/admin/instances" });
 *   …
 * }
 * ```
 *
 * **Before `requireAdmin()`, always.** Two different refusals live on these routes and the order
 * decides which one a visitor gets: a template that does not sell the console answers `notFound()`
 * — the 404 an unknown URL gets, with no session read and no database work — while a template that
 * does sell it answers the role gate's three ways (redirect to `/login`, 404 for a member, render
 * for an admin). Calling them the other way round would make a product that does not have the
 * console send people to a sign-in page for a surface that does not exist there.
 *
 * Returns nothing when the capability is on, and throws Next's not-found when it is off.
 */
export function requireAdminProduct(): void {
  if (!adminProductShipped()) notFound();
}
