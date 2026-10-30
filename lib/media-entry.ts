/**
 * entryOf — a fixture's `ImageRef` as a registry entry, so a slot can hand `Media` one
 * `MediaEntry` instead of a path string (issue #155).
 *
 * `ImageRef.src` stays a plain path (decision D-P2-1): a record still says
 * `cover: { src: "/quiz/q1.jpg", alt: "…" }`, and the registry is what knows that path's
 * kind and intrinsic size. This module is the join, and it is the *only* place a component
 * is allowed to turn a path back into an entry — the lookup is by `src`, never by guessing a
 * key from a filename.
 *
 * It returns `undefined` for a path the registry does not address, and that is a supported
 * answer, not an error: `Media` then draws the generated default from the caller's seed. A
 * record with no cover, or one whose file was deleted, renders a picture rather than a 404.
 */
import { media } from "@/data/media";
import type { MediaEntry, MediaKind } from "@/content/media";

/** Path -> entry, built once. A query string or hash is stripped, like `next/image` does. */
const byPath = new Map<string, MediaEntry>(
  Object.values(media).flatMap((entry) =>
    "src" in entry ? [[entry.src, entry as MediaEntry] as const] : [],
  ),
);

/**
 * The registry entry a fixture's image addresses, or `undefined`.
 *
 * Accepts a whole `ImageRef` (`cover`) or a bare path (`quiz.image`, the map-based
 * surfaces still carry a `string | undefined`), because both shapes reach a card and the
 * call site should not have to wrap one in `{ src: … }` to satisfy a type.
 */
export function entryOf(ref: { src: string } | string | undefined | null): MediaEntry | undefined {
  if (ref === undefined || ref === null) return undefined;
  const src = typeof ref === "string" ? ref : ref.src;
  return byPath.get(src.split(/[?#]/)[0]);
}

/**
 * The `kind` a slot's drawn default carries, named once.
 *
 * It lives here rather than at the call site because `components/**` may not type leaf copy
 * literals (E23) and, more to the point, a media kind is the model's word for what an image
 * is *for* — the schema in `content/media.ts` closes the list, this names the one each slot
 * asks for when its record has no image.
 */
export const FALLBACK_KIND = {
  avatar: "avatar",
  background: "background",
  category: "category-art",
  illustration: "illustration",
  news: "news-art",
  quiz: "quiz-art",
  tip: "tip-art",
} as const satisfies Record<string, MediaKind>;

/**
 * The seed a person's **cover** is drawn from — the handle, one domain over from the avatar's
 * (issue #130).
 *
 * The avatar is seeded with the bare handle and the cover with `<handle>:cover`, so a profile
 * paints both from the same identity without painting the same picture twice: a disc sitting on
 * an identical gradient is invisible, and a banner in the disc's two colours reads as a mis-take
 * rather than as a surface. A suffix is still a pure function of the handle — no index, no clock,
 * no `Math.random()` — so the same person is the same banner everywhere that renders it, and two
 * handles can only collide if their FNV-1a hashes do.
 */
export function coverSeedOf(handle: string): string {
  return `${handle}:cover`;
}
