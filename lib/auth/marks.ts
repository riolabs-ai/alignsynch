/**
 * The illustration marks the auth screens draw, selected by brand **on the server**.
 *
 * `/register` draws three marks: one large on the illustration panel, the same glyph small on
 * the mobile header, and one inside the final "Create Account" button. On QuizHub those are a
 * book and a trophy — the product *is* a quiz, and a book beside "join" reads as study. On the
 * alignment build that vocabulary belongs to a product the visitor did not come to use, so the
 * screen draws a pair mark instead: the unit of AlignSynch is two people answering the same
 * questions, which is what `users` and `handshake` say and what a book does not.
 *
 * The *choice* is the server's, exactly like `AFTER_SIGN_IN_BY_BRAND` next door (#351):
 * `components/auth/register-view.tsx` is a client module, so it may not import `data/brand` as a
 * value (zod in the browser bundle), may not import `lib/flags.ts` (`resolveBrand` throws in a
 * browser), and must never learn which brand it is. It receives the mark **ids** below and maps
 * them to glyphs itself. Ids, not components, because a React component is not a serialisable
 * prop across the server→client boundary — the map lives in the view, like `STAT_MARKS` in
 * `components/auth/login-view.tsx`.
 *
 * `Record<BrandId, AuthMarkSet>` is the point rather than a convenience: a third brand fails
 * `tsc` here until somebody chooses its marks deliberately, which is the whole defect this
 * module exists to fix — one brand's marks inherited by another.
 */
import type { BrandId } from "@/data/brand";

/** A glyph the auth screens can draw. Each id is one entry in the view's `MARK_ICONS` map. */
export type AuthMarkId = "book-open" | "trophy" | "users" | "handshake";

/** The marks one brand's auth screens draw. */
export type AuthMarkSet = {
  /** The large panel mark, and the same glyph in the mobile header. */
  hero: AuthMarkId;
  /** The mark inside the final "Create Account" button. */
  action: AuthMarkId;
};

/**
 * The marks each brand draws.
 *
 * - `quizhub` — `book-open` and `trophy`: byte-for-byte the glyphs `/register` has always drawn,
 *   so the quiz brand does not change.
 * - `alignsynch` — `users` for the pair who answer the questions and `handshake` for the
 *   agreement those answers produce. Neither is a quiz's vocabulary.
 */
export const AUTH_MARKS_BY_BRAND: Readonly<Record<BrandId, AuthMarkSet>> = {
  quizhub: { hero: "book-open", action: "trophy" },
  alignsynch: { hero: "users", action: "handshake" },
};
