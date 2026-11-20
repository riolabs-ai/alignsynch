/**
 * The featured-image slot, authored — which record shows which picture, and what happens when
 * a record has none.
 *
 * This file is **data**, and that is the point. A band that decided its own picture would put a
 * string array inside a component, where `data:check` **E21** fails pasted fixture text and
 * **E17** fails a `public/` path written in a `.tsx` — and, worse, where a picture could only
 * ever change by editing a component. Here a row is a record id and an ordered list of media
 * registry **keys**; `lib/featured-art.ts` resolves them, and the band on the card draws what it
 * gets.
 *
 * THE CHAIN, IN ORDER (resolved in `lib/featured-art.ts`, never here):
 *
 *   1. the record's own row in `FEATURED_ART`, first key that resolves to a file under `public/`
 *      — the tranche. A row may list more than one key so a record can name a second picture
 *      and let the tier order pick (`content/media.ts::pickMedia`), which is why this is a list
 *      and not a single key;
 *   2. no row, or no key that resolves — the record's **realm band**, the art the catalogue has
 *      drawn since #889: one outline icon on the realm's flat tint (`lib/relationship-art.ts`).
 *      That is the fallback for the twenty-four records the tranche has not reached, and it is
 *      already authored data, so the tail of the chain is not re-declared here;
 *   3. the picture loads and the bytes die (a 404, a truncated file) — `components/media/media.tsx`
 *      paints a **generated default** seeded by the file's own path, so a failed image degrades to
 *      a drawn plate instead of a broken icon. No row and no component decides that; the media
 *      layer already does (`content/media.ts::fallbackOf`).
 *
 * A TRANCHE, NOT A CATALOGUE. There are twenty-seven purchasable Relationship Types and the
 * approved catalogue draws them all from seven realm icons; painting all twenty-seven would be
 * twenty-seven pictures to keep true to a stylesheet that never asked for them. This first
 * tranche is **three** — one Home, one Office, one Social record — chosen so the three realms a
 * reader reaches first each show the slot working, and the other twenty-four show the fallback
 * proving itself on the same page. Adding a record is one row plus a file plus
 * `node scripts/gen-media.mjs`; nothing else changes.
 *
 * `keys` is `readonly MediaKey[]`, so a key that `data/media.ts` does not hold is a **type
 * error**, not a 404 at render time; and `data/media.ts` is generated from `public/`, so a row
 * naming a file that does not exist cannot survive `pnpm data:check` (E18).
 */
import type { MediaKey } from "@/data/media";

/** One record's featured image: the registry keys to try, in order. */
export interface FeaturedArtRow {
  /** The record's id — `data/relationship-types.ts::relationshipTypes[].id`. */
  readonly record: string;
  /** Ordered media registry keys. The first that resolves to a file under `public/` wins. */
  readonly keys: readonly MediaKey[];
}

/**
 * The records whose featured art has shipped.
 *
 * Sorted by record id so the list reads like the registry it points into, and so two people
 * adding a row do not fight over the tail of the file.
 */
export const FEATURED_ART: readonly FeaturedArtRow[] = [
  { record: "friends", keys: ["relationship-types.featured.friends"] },
  { record: "spouses", keys: ["relationship-types.featured.spouses"] },
  { record: "staff-manager", keys: ["relationship-types.featured.staff-manager"] },
];

/**
 * A record's authored keys, or an empty chain when the tranche has not reached it.
 *
 * `Object.freeze` is not used: the rows above are already `readonly` by type, and the array is
 * consumed on the server where a caller cannot mutate what it did not create.
 */
export function featuredArtKeys(record: string): readonly MediaKey[] {
  return FEATURED_ART.find((row) => row.record === record)?.keys ?? [];
}
