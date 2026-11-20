// template-ancestor: components/categories/category-tile.tsx   (variation: a record's cover is one realm outline icon on a flat tint, not a seeded gradient with a monogram — the catalog's art identifies the *area*, because twenty-seven monograms are twenty-seven shapes a reader cannot sort, while seven icons are a taxonomy they can)

import type { MediaEntry } from "@/content/media";
import { Media } from "@/components/media/media";
import type { RealmArt } from "@/lib/relationship-art";

/**
 * The shared record-art slot — one realm icon on one flat tint, plus the two-party mark.
 *
 * This is the piece `CATALOG-UI-SYSTEM.md` (§ Record artwork) calls `RecordArtwork`, and the
 * thing it replaces is deliberate: `mutedGradientFor()` drew an arbitrary HSL cover per slug with
 * the record's initials over it, so two templates in the same realm looked unrelated and no card
 * told a reader which area they were browsing. The realm is the only field the taxonomy groups by,
 * so the realm is what the art shows.
 *
 * **The icon is masked, not drawn.** `data/media.ts` holds the outline SVG, and a CSS mask paints
 * it in the realm's ink over the realm's tint — which is how the approved stylesheet does it, and
 * the reason to keep it is that the bundle's SVGs carry `stroke="#000"` and would otherwise paint
 * black on every tint. A mask also means one file serves both the card and a future compact row at
 * any size.
 *
 * **The values arrive as props.** Neither the icon path, the tint nor the ink is written here:
 * `lib/relationship-art.ts` owns the map and resolves the registry key, so this component cannot
 * drift from the four other places the same realm is drawn.
 *
 * **The two-party mark is a cue, not a state.** It sits at the band's trailing edge because every
 * record on this page is a two-person record; it never encodes status, role or permission, and the
 * band is `aria-hidden` for the same reason a decorative image is.
 *
 * **The band has two arms, and the record decides which one draws (#t_f96ad328).** A record the
 * featured-art tranche has reached carries a picture — a file out of `data/media.ts` — and the
 * band paints it, cropped to the band's box by `object-cover`. Every other record draws the realm
 * art above, which is the fallback and the state twenty-four of the twenty-seven records are in;
 * the band is not "empty" for those, it is the approved catalogue art. The picture arrives as a
 * prop because the choice between the two arms is `lib/featured-art.ts`'s, not this file's: a
 * component that held a registry key would be a picture a fixture edit could never reach.
 */
export function TemplateArt({
  art,
  mark,
  featured,
  className,
}: {
  art: RealmArt;
  /** The two-party mark's `src`, or `undefined` where the surface does not draw it. */
  mark?: string;
  /**
   * The record's featured art, when the tranche has reached it (#t_f96ad328). A **file entry**
   * resolved by `lib/featured-art.ts`; absent means "this record has no picture yet", and the
   * band draws the realm art instead. The band never picks a picture itself — it draws the one
   * it is handed.
   */
  featured?: MediaEntry;
  className?: string;
}) {
  /**
   * The band's box, shared by both arms: the same height, the same rule, and the same
   * compact-card collapse. Only what fills it differs, so a record with a picture and a record
   * without one still line up in the grid.
   */
  const band = `h-[72px] shrink-0 overflow-hidden border-b border-border/60 max-[620px]:h-auto max-[620px]:min-h-full max-[620px]:border-r max-[620px]:border-b-0 ${className ?? ""}`;

  if (featured !== undefined) {
    return (
      <div
        className={`relative ${band}`}
        data-featured-art=""
        style={{ backgroundColor: art.tint }}
      >
        {/*
          `Media` owns the failure: a file that 404s paints a generated default seeded by its own
          path instead of a broken icon, and `fill` inside this `relative` parent is what gives the
          picture a box — a generated entry has no intrinsic size, so an unfilled slot would
          collapse the band the moment the bytes failed (#t_f96ad328).
        */}
        <Media
          entry={featured}
          fill
          className="object-cover"
          sizes="(min-width: 1000px) 33vw, (min-width: 621px) 50vw, 84px"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-between gap-3 px-4 max-[620px]:flex-col max-[620px]:justify-center max-[620px]:gap-2 max-[620px]:px-[5px] max-[620px]:py-2.5 ${band}`}
      data-realm-art=""
      style={{ backgroundColor: art.tint }}
    >
      <span
        className="block h-[46px] w-[46px] shrink-0 max-[620px]:h-10 max-[620px]:w-10"
        data-realm-icon=""
        style={{
          backgroundColor: art.ink,
          WebkitMaskImage: `url(${art.icon})`,
          maskImage: `url(${art.icon})`,
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      {mark !== undefined && (
        <TwoPartyMark
          className="block h-[26px] w-auto shrink-0 opacity-90 max-[620px]:h-auto max-[620px]:w-[53px]"
          src={mark}
        />
      )}
    </div>
  );
}

/**
 * The two-party mark, at a size a caller sets.
 *
 * A plain element rather than `next/image`, for the reason `components/auth/mark-icon.tsx` gives:
 * this build runs with `images.unoptimized` (`next.config.mjs`), so the app's image component
 * would add a wrapper, an intrinsic-size contract and an optimizer round-trip that never happens
 * for 503 bytes of already-vector art. The `biome-ignore` is that decision, written down once
 * here instead of at each of the three call sites.
 */
export function TwoPartyMark({ src, className }: { src: string; className?: string }) {
  // Decorative: the caption beside it already says what the picture is, and a description would
  // make a screen reader announce the two-person model twice.
  // biome-ignore lint/performance/noImgElement: a generated SVG asset, not content media — `next/image` would route it through an optimizer this build turns off (`images.unoptimized`).
  return <img alt="" className={className} src={src} />;
}

export default TemplateArt;
