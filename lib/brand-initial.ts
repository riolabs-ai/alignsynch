/**
 * A brand's initial — the one letter its mark is drawn with.
 *
 * Two surfaces draw the mark: `scripts/gen-brand-icons.mjs` writes
 * `public/brand/<id>-icon.svg` for the browser tab, and `lib/brand-og.tsx` draws the same
 * composition at 1200x630 for a share preview. They must be the same letter, so the
 * derivation lives here once. A second copy of `name.replace(/[^A-Za-z]/g, "")[0]` is a
 * second answer to "what is this brand's letter", and the day one of them grows a rule (a
 * two-letter mark, a skipped initial, a non-Latin name) the tab icon and the share card
 * disagree about the product in the two places a reader sees before any word of the page.
 *
 * No imports and no React, on purpose: the icon generator loads this file with plain node
 * (`node --import ./scripts/ts-modules.mjs`), where the content model's zod and `lib/`'s
 * React imports have no business running.
 */
export function brandInitial(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) throw new Error(`brand name ${JSON.stringify(name)} has no letters`);
  return letters[0].toUpperCase();
}
