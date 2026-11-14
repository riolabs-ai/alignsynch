// template-ancestor: components/auth/login-view.tsx   (variation: the welcome panel's two tiles alone, so both auth pages draw the same pair)

/**
 * The two welcome tiles — one surface, mounted by both full-page auth routes (#971).
 *
 * `/login` has drawn this pair beside its form since the split panel was built; `/register` drew
 * its own, older panel without them, so the sign-up screen introduced the product with a sentence
 * and nothing else. The owner's decision (2026-11-13) is that the pair belongs on both pages, while
 * each page keeps its own headline — the register panel's `h1` is its own words, and the tiles
 * render beneath it.
 *
 * The pair is **one component** rather than two copies for the reason the template doctrine gives:
 * a copied tile drifts, and the two pages would then argue about what the product claims. The
 * panels around it deliberately stay separate — the register panel carries the sign-up step rail
 * and its own headline, which is sign-up's expression of the same surface, not a second hero. That
 * is why this file is the tiles and nothing else: extracting the whole panel would have replaced a
 * page's `h1` with sign-in's `h2` and changed the sizing of a panel the card told us not to
 * restyle.
 *
 * What it reads and what it is handed:
 *
 *   - `tiles` is a whole `PageCopySection`, resolved by the caller. A section id would have to be
 *     looked up against the fixture of the route that renders it, and this component is reachable
 *     from two routes — so the caller resolves the band (`heroTilesFor`) and this file names no
 *     copy id at all.
 *   - the one number (`platform.activePlayers`) is the panel's own: it is formatted here and filled
 *     into a tile's `{count}` placeholder. A brand whose tiles carry no placeholder renders no
 *     count, which is how the alignment build's two sentences take the slots the quiz build fills
 *     with numbers.
 *   - `className` is the caller's spacing, because the two panels place the pair differently
 *     (`/register` puts it under its subtitle; `/login` already has a margins on its own block).
 *     The grid's own classes are fixed here, so the pair cannot be restyled page by page.
 *
 * **Not a `"use client"` module.** It has no hooks and no state; its two callers are client views,
 * so it joins their bundle as ordinary code. It imports no server module — `data/metrics.ts` is a
 * fixture, not a database read.
 */
import type { PageCopySection } from "@/content/pages";
import { formatCompactCount } from "@/content/metrics";
import { metric } from "@/data/metrics";
import { fillLabel } from "@/lib/page-copy";
import { BookOpen, type LucideIcon, Scale, Trophy } from "lucide-react";

/**
 * The mark each tile draws, by the id the build's fixture declares.
 *
 * An icon is chrome, not copy, so it stays in the component — but which tile is which belongs to
 * the fixture's ids, and a brand may word a tile the quiz build fills with a count
 * (`stats-alignsynch`). An id this map does not know gets the neutral mark rather than a quiz
 * trophy: the tiles are the same shape on both brands, and only the words move.
 */
const STAT_MARKS: Record<string, { icon: LucideIcon; tone: string }> = {
  players: { icon: Trophy, tone: "text-yellow-400" },
  categories: { icon: BookOpen, tone: "text-green-400" },
};

/** The mark for a tile the map above does not name. */
const NEUTRAL_MARK = { icon: Scale, tone: "text-white/80" };

export function AuthHeroTiles({
  tiles,
  className,
}: {
  /** The two tiles, resolved by the caller — this component names no copy id. */
  tiles: PageCopySection;
  /** The caller's spacing only; the grid's own classes are owned here. */
  className?: string;
}) {
  const values = { count: formatCompactCount(metric("platform.activePlayers").value, "upper") };

  return (
    <div className={`grid grid-cols-2 gap-4 w-full max-w-md${className ? ` ${className}` : ""}`}>
      {tiles.items?.map((stat) => {
        const mark = STAT_MARKS[stat.id] ?? NEUTRAL_MARK;
        const Icon = mark.icon;
        return (
          <div key={stat.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
            <Icon className={`w-8 h-8 mx-auto mb-2 ${mark.tone}`} />
            {stat.value !== undefined && (
              <div className="text-2xl font-bold">{fillLabel(stat.value, values)}</div>
            )}
            <div className="text-sm text-white/80">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
