/**
 * The catalogue's record art — one realm, one outline icon, one flat tint.
 *
 * `CATALOG-UI-SYSTEM.md` (§ Record artwork) is the contract this file exists to satisfy, and it
 * replaces the thing it is easiest to reach for instead: a per-slug HSL cover with a monogram.
 * A catalogue card's art is **not** a function of the record's slug. It is a function of the
 * record's **realm**, because the realm is the only field the taxonomy groups by, and a reader
 * scanning seven headings learns more from seven icons than from twenty-seven monograms.
 *
 * Three values per realm, and they are the approved stylesheet's own:
 *
 *   icon   the outline SVG the bundle ships, copied under `public/relationship-types/icons/`
 *   tint   the flat pale surface the card's art band paints
 *   ink    the line colour the icon is drawn in, through a CSS mask
 *
 * The icon is addressed as a **media-registry key**, never as a path: `data/media.ts` is generated
 * from `public/`, so the key and the file cannot drift, and this file holds no `/public` literal
 * that could go stale. `realmArt()` resolves the key on the server and hands the caller a plain
 * `src`, which is what lets the catalogue's client-side search receive it as a prop instead of
 * importing the whole registry into the bundle.
 *
 * **Colour is a supporting cue only.** The realm's name is printed as text on every card and in
 * the realm menu, so a reader who cannot see the tint still knows the realm; nothing about
 * state, role or permission is ever carried by these two colours (`CATALOG-UI-SYSTEM.md`,
 * § Quality rules). The tints are transcribed from the approved bundle and live here — one home —
 * rather than in a component, so a card, a row and a detail band cannot each invent their own.
 */
import { isFileMedia } from "@/content/media";
import { media } from "@/data/media";
import type { Realm } from "@/data/relationship-types";

/** What one realm's art needs: a resolvable icon, a surface tint and the line colour. */
export interface RealmArt {
  readonly icon: string;
  readonly tint: string;
  readonly ink: string;
}

/**
 * Realm → icon key, tint and ink.
 *
 * The map is `Record<Realm, …>` so adding a realm to `REALMS` fails the typecheck until it has
 * art; a `Partial` here would render an untinted card for the eighth realm and nothing would say
 * so.
 */
const REALM_ART: Record<
  Realm,
  { readonly key: string; readonly tint: string; readonly ink: string }
> = {
  Office: { key: "relationship-types.icons.office", tint: "#e5f5fa", ink: "#087a9c" },
  Business: { key: "relationship-types.icons.business", tint: "#eaf3ed", ink: "#28734a" },
  Property: { key: "relationship-types.icons.property", tint: "#f2eee5", ink: "#846638" },
  School: { key: "relationship-types.icons.school", tint: "#eff3e6", ink: "#627c36" },
  Medical: { key: "relationship-types.icons.medical", tint: "#e5f2ef", ink: "#26786e" },
  Home: { key: "relationship-types.icons.home", tint: "#f5eee7", ink: "#98613c" },
  Social: { key: "relationship-types.icons.social", tint: "#eceff7", ink: "#586790" },
};

/**
 * One realm's art, with the icon resolved to a URL.
 *
 * Throws on a key the registry does not hold, for the reason `lib/template-catalogue.ts` throws
 * on a tier it cannot price: a card whose art band is empty is a defect the gate can catch here
 * (`pnpm data:check` regenerates and checks the registry) but a screenshot cannot.
 */
export function realmArt(realm: Realm): RealmArt {
  const entry = REALM_ART[realm];
  const icon = media[entry.key as keyof typeof media];
  if (icon === undefined || !isFileMedia(icon)) {
    throw new Error(
      `realmArt: data/media.ts has no file under the key "${entry.key}" — run \`pnpm gen\`'s sibling \`node scripts/gen-media.mjs\` after adding the icon, do not inline a path here`,
    );
  }
  return { icon: icon.src, tint: entry.tint, ink: entry.ink };
}

/**
 * The two-party mark the hero caption and the Aspect example draw.
 *
 * It is a secondary cue for the two-person model and carries no product state
 * (`CATALOG-UI-SYSTEM.md`, § Record artwork), which is why it is resolved here beside the realm
 * art rather than being drawn from `data/media.ts` at each call site.
 */
export function twoPartyMark(): RealmArt {
  const entry = media["relationship-types.two-party-mark"];
  if (entry === undefined || !isFileMedia(entry)) {
    throw new Error(
      "twoPartyMark: data/media.ts has no file under relationship-types.two-party-mark",
    );
  }
  return { icon: entry.src, tint: "transparent", ink: "currentColor" };
}
