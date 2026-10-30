/**
 * `brand.logo` -> the mark the chrome can draw, or nothing.
 *
 * A brand record carries one `logo`: a path into `data/media.ts`. That is all the schema
 * says, and it is not enough to draw with, because two different things arrive under it —
 * a designed lockup, and a stand-in file. QuizHub's `/placeholder-logo.svg` is the second
 * kind: the registry marks it `kind: "fallback"`, it is a black wordmark on nothing, and
 * the shell has always drawn its own icon and the brand word instead. AlignSynch's
 * `as2-logo_v2_cl.png` is the first kind: a real export, 818×127, with the monogram and the
 * wordmark in it.
 *
 * So the registry's `kind` decides, not the brand record and not a boolean nobody wrote:
 * a `fallback` entry is a placeholder and resolves to `undefined`, so the caller draws the
 * icon it drew before; anything else resolves to the intrinsic size and `src` `next/image`
 * needs. The consequence worth stating is the one the card asks for — the default build's
 * shell renders exactly the markup it rendered before this module existed, because its
 * logo is a fallback.
 *
 * The mark is returned by value, not as a media key, because the sidebar is a client
 * component: `app/(mainlayout)/layout.tsx` resolves it on the server and passes it down, so
 * the registry (100 entries) never enters the browser bundle. React-free on purpose —
 * `data:check` and a test can import it.
 */
import { media } from "@/data/media";

/** What the chrome needs to draw a brand's mark. Intrinsic size included, for `next/image`. */
export interface BrandMark {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The registry entry behind a brand's `logo`, or `undefined` when there is nothing to draw.
 *
 * An unregistered path is also `undefined`: a record whose logo drifted out of the media
 * registry is a broken image, and the icon is the honest degradation. (`data:check` fails
 * that case separately — `tests/brand-shell.test.ts` pins every brand's logo against the
 * registry — so this branch is a second line, not the only one.)
 */
export function brandMark(logo: string): BrandMark | undefined {
  const entry = Object.values(media).find((candidate) => candidate.src === logo);
  if (!entry || entry.kind === "fallback") return undefined;
  return { src: entry.src, width: entry.width, height: entry.height };
}
