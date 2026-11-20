/**
 * The featured-image slot, resolved — the one place a catalogue record's picture is chosen.
 *
 * `data/featured-art.ts` authors the rows; this module applies the chain (`file -> realm band ->
 * drawn default`, documented in that file) and hands the surface a plain `MediaEntry`. Two rules
 * it exists to keep:
 *
 * **The component never decides.** A band that asked `media[...]` itself would hold a registry
 * key, which is how a picture becomes unchangeable without a component edit — the same failure
 * E17 closed for paths. `TemplateArt` receives an entry or it receives nothing, and "nothing"
 * means "draw the realm band", which is decided here and not there.
 *
 * **A key that does not resolve is a defect, not a fallback.** `data/featured-art.ts` types its
 * keys as `MediaKey`, so a typo fails the typecheck; a key that survives the typecheck but is
 * missing from the map at runtime would mean `data/media.ts` was hand-edited away from the
 * filesystem, so this throws with the fix in the message (run `node scripts/gen-media.mjs`)
 * rather than silently drawing the realm band for a record whose art was supposed to ship.
 *
 * Server-only by construction rather than by directive: it imports the whole registry and is
 * called from `lib/templates-page.ts`, and the entry it returns is a plain object, so a client
 * component receives it as a prop (the same shape `lib/relationship-art.ts` established).
 */
import { isFileMedia, pickMedia, type FileMediaEntry, type MediaEntry } from "@/content/media";
import { FEATURED_ART, featuredArtKeys } from "@/data/featured-art";
import { media } from "@/data/media";

/**
 * One record's featured art, or `undefined` when the tranche has not reached it.
 *
 * `undefined` is the whole fallback signal: the caller draws the realm band it already has. It is
 * never an error — twenty-four of the twenty-seven catalogue records return it today, and that is
 * the designed state, not a gap.
 */
export function featuredArt(record: string): FileMediaEntry | undefined {
  const entries: MediaEntry[] = featuredArtKeys(record).map((key) => {
    const entry: MediaEntry | undefined = media[key];
    if (entry === undefined) {
      throw new Error(
        `featuredArt: data/media.ts has no "${key}" — data/featured-art.ts names a file the registry does not hold; run \`node scripts/gen-media.mjs\` after adding the file, and never inline the path`,
      );
    }
    return entry;
  });
  return pickFile(entries);
}

/**
 * The tier order, applied: a file wins, and a generated or remote entry in a row is not a
 * catalogue picture (a remote URL is somebody else's server and a generated entry has no bytes),
 * so it is skipped rather than painted into a band that expects an intrinsic size.
 */
function pickFile(entries: readonly MediaEntry[]): FileMediaEntry | undefined {
  const picked = pickMedia(...entries);
  return picked !== undefined && isFileMedia(picked) ? picked : undefined;
}

/**
 * Every record the tranche covers, for the page model and for the tests that hold the two
 * directions together: a row without a file is impossible (E18) and a file without a row is dead
 * weight, so the only question left is which records the catalogue actually draws.
 */
export function featuredArtRecords(): readonly string[] {
  return FEATURED_ART.map((row) => row.record);
}
