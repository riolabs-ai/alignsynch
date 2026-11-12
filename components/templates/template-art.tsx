// template-ancestor: components/categories/category-tile.tsx   (variation: a record's cover is one realm outline icon on a flat tint, not a seeded gradient with a monogram — the catalog's art identifies the *area*, because twenty-seven monograms are twenty-seven shapes a reader cannot sort, while seven icons are a taxonomy they can)

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
 */
export function TemplateArt({
  art,
  mark,
  className,
}: {
  art: RealmArt;
  /** The two-party mark's `src`, or `undefined` where the surface does not draw it. */
  mark?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-[72px] shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-border/60 px-4 max-[620px]:h-auto max-[620px]:min-h-full max-[620px]:flex-col max-[620px]:justify-center max-[620px]:gap-2 max-[620px]:border-r max-[620px]:border-b-0 max-[620px]:px-[5px] max-[620px]:py-2.5 ${className ?? ""}`}
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
