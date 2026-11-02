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

/**
 * A glyph these surfaces can draw. Each id is one entry in `MARK_ICONS`
 * (`components/auth/mark-icon.tsx`).
 */
export type AuthMarkId = "book-open" | "trophy" | "users" | "handshake" | "compass";

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
 * - `alignsynch` — `users` for the pair who answer the questions, `handshake` for the agreement
 *   those answers produce, and `compass` on the 404: an address that is on no map this product
 *   draws. A trophy there was a quiz score in the moment the product had already failed.
 */
export const AUTH_MARKS_BY_BRAND: Readonly<Record<BrandId, AuthMarkSet>> = {
  quizhub: { hero: "book-open", action: "trophy", fact: "trophy" },
  alignsynch: { hero: "users", action: "handshake", fact: "compass" },
};
