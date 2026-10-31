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
