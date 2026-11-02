// template-ancestor: components/layout/brand-glyph.tsx   (variation: one glyph chosen by id, where BrandGlyph is the one product mark)
/**
 * The glyph for each `AuthMarkId`, in one table both a client view and a server page can read.
 *
 * The *choice* of mark is the server's and lives in `lib/auth/marks.ts` (`AUTH_MARKS_BY_BRAND`,
 * keyed by `BrandId`, so a third brand fails `tsc`). This module is only the second half of that
 * contract: an id in, a `lucide-react` component out. There is exactly one entry per id — the
 * `Record<AuthMarkId, LucideIcon>` type makes a missing one a compile error, so "a mark left
 * behind" cannot render as nothing at all.
 *
 * **Why it is not a `"use client"` module.** The surfaces that draw a brand mark are split across
 * the boundary: `/login` and `/register` are client views, while `/not-found` is a server module
 * (it parses a zod fixture, so it cannot be a client boundary). A server component that imports a
 * *value* from a `"use client"` module gets a client reference, not the map — reading `MARK_ICONS`
 * there throws at render time. And wrapping the glyph in a client child instead would put the
 * whole module graph of the other views — `lib/auth/client` and the Neon auth SDK among it — into
 * the 404's own bundle. So the table lives in a module with no directive and no hooks: React
 * renders these icons on the server exactly as `app/not-found.tsx` already renders `Home`,
 * `Search` and `Trophy`, and the client views bundle the same file as ordinary code.
 *
 * Nothing here reads a brand, a fixture or a clock: it holds no sentence and no colour.
 */
import type { AuthMarkId } from "@/lib/auth/marks";
import { BookOpen, Compass, Handshake, Trophy, Users, type LucideIcon } from "lucide-react";

/**
 * One glyph per id.
 *
 * Why `users` means alignment and not just "an account": that product's unit is **two** people
 * answering the same questions and comparing the answers, so the mark is the pair — one figure in
 * front, one behind — where a single `User` would say "a person signed up" and nothing about a
 * second party. The book and the trophy are kept because QuizHub is those things: a body of
 * questions and a score. `compass` is the 404's: an address that is on no map this product draws.
 *
 * Exported for `tests/register-view.test.tsx`, which renders every id a brand can name and fails
 * on one this table has no glyph for.
 */
export const MARK_ICONS: Record<AuthMarkId, LucideIcon> = {
  "book-open": BookOpen,
  trophy: Trophy,
  users: Users,
  handshake: Handshake,
  compass: Compass,
};

/**
 * One mark, drawn. The class names are the caller's (each surface sizes and tones the glyph in its
 * own layout), so this component adds no wrapper element and no style of its own: the SVG a page
 * renders for `book-open` is byte for byte the `<BookOpen className=… />` it used to write inline.
 */
export function MarkGlyph({ id, className }: { id: AuthMarkId; className?: string }) {
  const Icon = MARK_ICONS[id];
  return <Icon className={className} />;
}
