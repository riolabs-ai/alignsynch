// template-ancestor: components/layout/brand-glyph.tsx   (variation: one mark chosen by id — a glyph, or the brand's own generated mark — where BrandGlyph is the one product mark)
/**
 * The mark for each `AuthMarkId`, in one table both a client view and a server page can read.
 *
 * The *choice* of mark is the server's and lives in `lib/auth/marks.ts` (`AUTH_MARKS_BY_BRAND`,
 * keyed by `BrandId`, so a third brand fails `tsc`). This module is only the second half of that
 * contract: an id in, the thing that draws it out.
 *
 * There are two kinds of mark, and they are two because a brand's mark is not always a glyph.
 * `MARK_ICONS` holds one `lucide-react` component per glyph id — the `Record` type makes a missing
 * one a compile error, so "a mark left behind" cannot render as nothing at all. `brand-mark` is not
 * in that table: it is the brand's own generated app mark, the image at `AUTH_MARK_SRC_BY_BRAND[id]`,
 * and it renders as one. That id exists because the alignment build spent months drawing a lucide
 * person pair where its AS monogram belonged — a glyph can say what the product *is* (a pair, an
 * agreement, a quiz) and cannot be the product's mark.
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
 * Nothing here reads a brand, a fixture or a clock: it holds no sentence, no colour, and the one
 * path it draws is handed in as a prop.
 */
import type { AuthMarkId } from "@/lib/auth/marks";
import { BookOpen, Compass, Handshake, Trophy, Users, type LucideIcon } from "lucide-react";

/** The ids a lucide component can draw: every mark except the brand's own image. */
export type GlyphMarkId = Exclude<AuthMarkId, "brand-mark">;

/**
 * One glyph per id.
 *
 * Why `users` is still here though no brand names it now: it is the mark the alignment build *did*
 * name, kept because a brand may choose it deliberately (a pair of people is a real statement about
 * this product) and because deleting a glyph is how a table silently loses an option. What changed
 * is the mark for a brand that has a mark of its own — that brand names `brand-mark`.
 *
 * The book and the trophy are kept because QuizHub is those things: a body of questions and a
 * score. `compass` is the 404's: an address that is on no map this product draws.
 *
 * Exported for `tests/register-view.test.tsx`, which renders every id a brand can name and fails
 * on one neither this table nor the brand mark can draw.
 */
export const MARK_ICONS: Record<GlyphMarkId, LucideIcon> = {
  "book-open": BookOpen,
  trophy: Trophy,
  users: Users,
  handshake: Handshake,
  compass: Compass,
};

/**
 * One mark, drawn. The class names are the caller's (each surface sizes and tones the mark in its
 * own layout), so this component adds no wrapper element and no style of its own: the SVG a page
 * renders for `book-open` is byte for byte the `<BookOpen className=… />` it used to write inline.
 *
 * `src` is required in practice for `brand-mark` and unused for every glyph. It is not a union type
 * because every call site passes it from `AUTH_MARK_SRC_BY_BRAND` whether or not its brand names
 * the image id — a conditional prop at six call sites is a bug waiting for the seventh. A missing
 * one throws by name instead of rendering an empty box: an absent mark is the one failure on this
 * surface that looks like a styling accident rather than a defect.
 */
export function MarkGlyph({
  id,
  src,
  className,
}: {
  id: AuthMarkId;
  /** The image `brand-mark` draws — `AUTH_MARK_SRC_BY_BRAND[brandId]`. */
  src?: string;
  className?: string;
}) {
  if (id === "brand-mark") {
    if (src === undefined) {
      throw new Error(
        "MarkGlyph: this brand's mark is `brand-mark` but no image path was passed — read it " +
          "from AUTH_MARK_SRC_BY_BRAND (lib/auth/marks.ts) on the server and hand it down",
      );
    }
    // `alt=""`: the mark is decoration beside a heading that already names the product, and a
    // description here would make a screen reader announce the brand twice.
    // biome-ignore lint/performance/noImgElement: a generated SVG asset, not content media — `next/image` would route it through an optimizer this build turns off (`images.unoptimized`).
    return <img src={src} alt="" className={className} />;
  }
  const Icon = MARK_ICONS[id];
  return <Icon className={className} />;
}

/**
 * The box a mark needs inside the tile these cards draw it in — the mark's own size.
 *
 * A glyph's paths reach the edge of the box they are given; a mark *file* is ink floating in a
 * transparent canvas at `APP_GLYPH_FRACTION` (62 %), so the same box shows a smaller thing. `h-6`
 * (24 px) was right for a lucide glyph and puts the AS monogram at ≈15 px of ink, where it read as
 * a generic avatar smudge. The box the tile gives a mark is the tile itself — `h-10` (40 px) × 0.62
 * ≈ 25 px of ink, measured crisp by compositing candidates into the 64 px tile `markTileClass`
 * gives it. The card is ~400 px wide, so the mark is a seal beside the heading rather than a hero
 * image (owner, 2026-11-04: the 96 px tile the register screen drew was oversized).
 *
 * `glyphBox` is the caller's box for a glyph id, and it defaults to `h-6 w-6` — the size the 48 px
 * tiles have always given a glyph — so the five auth cards render the class strings they always
 * have on QuizHub. A surface that draws its glyph larger (the register panel's 48 px, the login
 * panel's 40) passes its own and keeps it.
 */
export function markBoxClass(id: AuthMarkId, glyphBox = "h-6 w-6"): string {
  return id === "brand-mark" ? "h-10 w-10" : glyphBox;
}

/**
 * The tile the mark is centred in, per kind — the box `markBoxClass` is measured against.
 *
 * A glyph and a mark file need different tiles, and the owner's correction on `/register` is that
 * the mark's tile had become a hero: 96 px on a card ~400 px wide, with the mark itself at 48. The
 * fix is one size for the whole auth family — a 64 px tile holding the 40 px mark, so the mark
 * reads as a seal beside the heading rather than as the page's subject — and `brand-mark` is the
 * only id that changes. A glyph keeps the literal `glyphTile` its surface passes: QuizHub's five
 * cards render the class strings they always have, byte for byte, which is why this takes the
 * caller's box instead of owning a second table.
 */
export function markTileClass(id: AuthMarkId, glyphTile: string): string {
  return id === "brand-mark" ? "h-16 w-16" : glyphTile;
}

/**
 * The ground the auth cards paint behind a mark — `bg-action`, or nothing at all.
 *
 * A glyph is ink and needs a ground: white paths on the brand's `action` is the tile these cards
 * have drawn since the template had one brand. A brand's *own mark* is a file — full colour, with
 * its own white keyline — and the owner's decision (2026-11-03) is that nothing is painted behind
 * it on any surface. Measured on the rendered card, the ground was also the bug: on the graphite
 * `#37474f` the mark's dark S and navy A merge into the tile, and a ~30 px monogram reads as a
 * smudge; on the card's own light ground the blue A and the black S separate and the mark is
 * legible at the same size.
 *
 * So the ground is a property of the *kind* of mark, not of the surface: `brand-mark` gets `""`
 * and every glyph id keeps `bg-action` byte-for-byte, which is what leaves QuizHub's auth cards
 * exactly as they were. A full-bleed brand *panel* (the login/register split screen) is not a tile
 * and keeps its `bg-action` — that panel carries the page's copy, not just the mark.
 */
export function markGroundClass(id: AuthMarkId): string {
  return id === "brand-mark" ? "" : "bg-action";
}
