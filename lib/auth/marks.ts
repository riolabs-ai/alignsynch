/**
 * The illustration marks the signed-in-adjacent screens draw, selected by brand **on the server**.
 *
 * Three surfaces read this table, and each one drew a quiz glyph on the alignment build until it
 * was told not to:
 *
 *   `/login`      one large mark on the illustration panel and the same glyph small on the mobile
 *                 header (`hero`). The card's two tiles are a different mechanism — their mark is
 *                 the fixture's stat id — and are untouched.
 *   `/register`   the same `hero` pair, plus the glyph inside the final "Create Account" button
 *                 (`action`).
 *   `/not-found`  the mark beside the fact band (`fact`) — the one statement about the status
 *                 code itself, which is where a quiz trophy sat on both builds.
 *
 * On QuizHub those are a book and a trophy — the product *is* a quiz, and a book beside "join"
 * reads as study. On the alignment build that vocabulary belongs to a product the visitor did not
 * come to use, so the screens draw a pair mark instead: the unit of AlignSynch is two people
 * answering the same questions, which is what `users` and `handshake` say and what a book does
 * not; the 404 gets `compass`, an address that is on no map this product draws.
 *
 * The *choice* is the server's, exactly like `AFTER_SIGN_IN_BY_BRAND` next door (#351):
 * `components/auth/register-view.tsx` is a client module, so it may not import `data/brand` as a
 * value (zod in the browser bundle), may not import `lib/flags.ts` (`resolveBrand` throws in a
 * browser), and must never learn which brand it is. It receives the mark **ids** below and maps
 * them to glyphs itself. Ids, not components, because a React component is not a serialisable
 * prop across the server→client boundary — the map lives in `components/auth/mark-icon.tsx`, a
 * module with no directive, so the client views and the server 404 read the same table.
 *
 * `Record<BrandId, AuthMarkSet>` is the point rather than a convenience: a third brand fails
 * `tsc` here until somebody chooses its marks deliberately, which is the whole defect this
 * module exists to fix — one brand's marks inherited by another.
 */
import type { BrandId } from "@/data/brand";
import { brands } from "@/data/brand";

/**
 * A glyph these surfaces can draw. Each id is one entry in `MARK_ICONS`
 * (`components/auth/mark-icon.tsx`) — except `brand-mark`, which is not a glyph at all: it is the
 * brand's own generated app mark, drawn from `AUTH_MARK_SRC_BY_BRAND` below.
 */
export type AuthMarkId = "book-open" | "trophy" | "users" | "handshake" | "compass" | "brand-mark";

/** The marks one brand's screens draw. */
export type AuthMarkSet = {
  /** The large panel mark, and the same glyph in the mobile header. */
  hero: AuthMarkId;
  /** The mark inside the final "Create Account" button. */
  action: AuthMarkId;
  /**
   * The mark beside the 404's fact band — the one statement about the status code itself.
   *
   * It is here rather than in `app/not-found.tsx` for the reason this module exists: the 404 is
   * the page a dead link lands on, so it is the first thing a new customer of *either* product
   * sees, and it used to draw a quiz trophy on both builds. A named field makes the brand choose
   * a glyph for it, and the next surface that needs one inherits the same table.
   */
  fact: AuthMarkId;
};

/**
 * The marks each brand draws.
 *
 * - `quizhub` — `book-open` and `trophy`: byte-for-byte the glyphs `/register` has always drawn,
 *   and the 404's trophy, so the quiz brand does not change.
 * - `alignsynch` — `brand-mark` for the hero: the brand's **own mark**, generated from
 *   `data/brands/alignsynch.ts`'s `mark` (the AS monogram) exactly as the tab icon is. It used to
 *   be `users` — a lucide person pair standing in for "two people answer the same questions" —
 *   which put a white silhouette on the brand's blue on every auth screen while the monogram sat
 *   unused. A glyph can say what the product *is*; it cannot be the product's mark. `handshake` is
 *   still the action mark (the agreement those answers produce), and `compass` is the 404's: an
 *   address that is on no map this product draws.
 */
export const AUTH_MARKS_BY_BRAND: Readonly<Record<BrandId, AuthMarkSet>> = {
  quizhub: { hero: "book-open", action: "trophy", fact: "trophy" },
  alignsynch: { hero: "brand-mark", action: "handshake", fact: "compass" },
};

/**
 * The image the `brand-mark` id draws, per brand — the generated app mark (`brand.icon`).
 *
 * A glyph id and an image path are different kinds of value, which is why this is a table beside
 * the marks rather than a fourth field inside `AuthMarkSet` (whose three entries are all ids a
 * client view can look up in one table). It is derived from the brand id through the same
 * `brandIconPaths` the icon generator and the manifest use, and a test holds it equal to the
 * record's own `icon`, so "the card shows the tab icon" is structural rather than a coincidence
 * of two strings.
 *
 * **It is the icon itself, not a second raster.** An earlier revision shipped a
 * `-mark-192.png` because the icon spent a third of its canvas on a painted ground the card's own
 * tile already supplied. The icon set is now the mark on transparency (owner, 2026-11-03), so
 * drawing `brand.icon` in the tile *is* the mark at the card's size — 0.78 × 40 px ≈ 31 px of ink,
 * the size that measured crisp — and a second file would have been the same pixels under a
 * different name.
 *
 * Only a brand whose set names `brand-mark` reads it; QuizHub's entry is here for the same reason
 * `Record<BrandId, …>` is the type — a third brand must decide, not inherit.
 */
export const AUTH_MARK_SRC_BY_BRAND: Readonly<Record<BrandId, string>> = Object.fromEntries(
  Object.entries(brands).map(([id, brand]) => [id, brand.icon]),
) as Record<BrandId, string>;
