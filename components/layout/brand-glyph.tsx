/**
 * The product mark, as the chrome draws it — the open book, one geometry with the icon set.
 *
 * This is the in-app half of the mark: the same two paths `scripts/gen-brand-icons.mjs` writes
 * into the favicon and the maskable set, rendered as an inline SVG so a page and a tab agree on
 * what the product looks like. It replaces three `BookOpen` imports (footer, sidebar, 404) that
 * each bound to lucide's copy of the shape — a fourth copy of the mark, free to drift from the
 * generated files the moment one of them is edited by hand.
 *
 * The glyph carries no colour: it strokes `currentColor` and inherits the `text-*` token of the
 * box around it (`text-action-foreground` on the footer mark, `text-primary` in the sidebar,
 * `text-white` on the 404 disc). So the palette rule is untouched — the hex still lives only in
 * `data/brand.ts`, painted through the token, and this file holds no literal.
 */
import { MARK_PATHS, MARK_VIEW_BOX } from "@/lib/brand-icon";

/**
 * The book glyph, lucide's stroke settings reproduced (`fill="none"`, `stroke-width="2"`,
 * round caps and joins) so the in-app mark is pixel-identical to the old `BookOpen` render.
 */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox={MARK_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
