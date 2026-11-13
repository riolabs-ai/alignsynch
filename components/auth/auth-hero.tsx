// template-ancestor: components/auth/login-view.tsx   (variation: the welcome panel alone, mounted by both auth pages instead of only sign-in)

/**
 * The auth pages' welcome hero — the mark, the heading, the sentence and the two tiles (#971).
 *
 * It was `login-view.tsx`'s left column and nothing else: `/login` explained the product beside the
 * form and `/register` opened on a bare card, so the first screen a new person saw on sign-up said
 * less than the one for somebody returning. The owner's decision (2026-11-13) is **one hero on both
 * full-page routes**, and the in-modal Account stage of the create flow stays compact — it is a step
 * in a flow, not a landing. One implementation mounted twice is what keeps the two from drifting;
 * a second copy of this markup in `register-view.tsx` is the defect the extraction exists to
 * prevent.
 *
 * What arrives as props, and why nothing here reads a fixture:
 *
 *   - `heading` / `subtitle` are the route's own page-level copy, already brand-selected by
 *     `lib/auth-copy.ts`. A hero is one thought on both brands, so the words stay the page's.
 *   - `tiles` is a whole `PageCopySection`, not an id. A section lookup has to resolve against the
 *     fixture of the route that renders it, and this component is reachable from two routes with two
 *     different fixtures — so the caller resolves the band (`heroTilesFor`) and this file asks for no
 *     section id at all, which keeps `data:check` E23 meaning the same thing on both surfaces.
 *   - `marks` / `markSrc` are the brand's glyph ids and its own mark path — a client module cannot
 *     learn which brand it is drawing (`components/auth/mark-icon.tsx` explains the split).
 *   - `children` is the panel's one variation: `/register` draws its two-step rail under the tiles,
 *     `/login` draws nothing there. Both are still one panel.
 *
 * The one number it owns is `platform.activePlayers`, formatted by `content/metrics.ts` and filled
 * into the fixture's `{count}` placeholder — a brand whose tile carries no placeholder renders no
 * count, which is how the alignment build's two sentences take the slots the quiz build fills with
 * numbers.
 *
 * **Not a `"use client"` module.** It has no hooks and no state; it is mounted by two client views,
 * so it joins their bundle as ordinary code — and a directive here would put a boundary inside a
 * boundary for no reason. Its one dependency on data is a pure fixture read (`lib/auth/marks.ts`'s
 * sibling pattern), never a server module.
 */
import { MarkGlyph, markBoxClass, markTileClass } from "@/components/auth/mark-icon";
import { formatCompactCount } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { metric } from "@/data/metrics";
import type { AuthMarkSet } from "@/lib/auth/marks";
import { fillLabel } from "@/lib/page-copy";
import { BookOpen, type LucideIcon, Scale, Trophy } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The mark each tile draws, by the id the build's fixture declares.
 *
 * An icon is chrome, not copy, so it stays in the component — but which tile is which belongs to the
 * fixture's ids, and a brand may word a tile the quiz build fills with a count (`stats-alignsynch`).
 * An id this map does not know gets the neutral mark rather than a quiz trophy: the tiles are the
 * same shape on both brands, and only the words move.
 */
const STAT_MARKS: Record<string, { icon: LucideIcon; tone: string }> = {
  players: { icon: Trophy, tone: "text-yellow-400" },
  categories: { icon: BookOpen, tone: "text-green-400" },
};

/** The mark for a tile the map above does not name. */
const NEUTRAL_MARK = { icon: Scale, tone: "text-white/80" };

export function AuthHero({
  heading,
  subtitle,
  tiles,
  marks,
  markSrc,
  children,
}: {
  /** The page's own headline (`copy.heading`, already the brand's). */
  heading: string;
  /** The sentence under it (`copy.subtitle`). Absent on a fixture with no hero sentence. */
  subtitle?: string | undefined;
  /** The two tiles, resolved by the caller — this component names no copy id. */
  tiles: PageCopySection;
  marks: AuthMarkSet;
  markSrc: string;
  /** The panel's one variation: `/register`'s step rail, absent on `/login`. */
  children?: ReactNode;
}) {
  const values = { count: formatCompactCount(metric("platform.activePlayers").value, "upper") };

  return (
    <div className="hidden lg:flex justify-center lg:w-1/2 bg-action relative overflow-hidden">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
        <div className="mb-8 max-w-md mx-auto">
          <div
            className={`${markTileClass(marks.hero, "w-20 h-20")} bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm`}
          >
            <MarkGlyph
              id={marks.hero}
              src={markSrc}
              className={`${markBoxClass(marks.hero, "w-10 h-10")} text-white`}
            />
          </div>
          <h2 className="text-4xl font-bold mb-4">{heading}</h2>
          <p className="text-xl text-white/90 leading-relaxed">{subtitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          {tiles.items?.map((stat) => {
            const mark = STAT_MARKS[stat.id] ?? NEUTRAL_MARK;
            const Icon = mark.icon;
            return (
              <div
                key={stat.id}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center"
              >
                <Icon className={`w-8 h-8 mx-auto mb-2 ${mark.tone}`} />
                {stat.value !== undefined && (
                  <div className="text-2xl font-bold">{fillLabel(stat.value, values)}</div>
                )}
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            );
          })}
        </div>
        {children}
      </div>
      {/* Decorative Elements */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
    </div>
  );
}
