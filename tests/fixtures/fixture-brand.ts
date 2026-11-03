/**
 * The fixture brand: **a template id this tree does not ship**, and the whole of it (#509).
 *
 * The admin console is a template capability (`product.admin` in `data/flags.ts`), and the card that
 * added it asks for a brand with the capability *off* so the 404 can be proved without flipping a
 * shipped product. In this tree a brand's capabilities are the flag record's `templates` field — the
 * same field `product.quiz-surfaces` uses to ship on `quizhub` and not on `alignsynch` — so the
 * fixture brand is a template id the record does not name: `default: false` is then the answer, which
 * is exactly the "a derived product turned it off" state.
 *
 * **Why not a `Brand` record under `data/brands/`.** `resolveBrand()` refuses a brand the `brands`
 * table does not carry, so a record would have to be registered there to be reachable — which would
 * make `BRAND=fixture-no-admin` a legal build for a real deployment and force every `switch
 * (BrandId)` in the tree (`app/(marketing)/page.tsx`, `lib/nav.ts`) to answer for a product that
 * must never ship. The switch under test is per-template, and a template id is what it resolves
 * against.
 *
 * Read by `tests/parity/parity.check.ts` (which stubs `BRAND` to it and asserts the console's entry
 * points answer 404 while the rest of the product still renders) and by `tests/flags.test.ts` (which
 * proves the resolver's answer without a render). Imported from a leaf module on purpose: both of
 * those files must not drag the page modules in for one string.
 */
export const FIXTURE_TEMPLATE_WITHOUT_ADMIN = "fixture-no-admin";
