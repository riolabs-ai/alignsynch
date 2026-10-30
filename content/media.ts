/**
 * MediaEntry — one thing a renderer can draw, in three tiers (issue #155, phase 1).
 *
 * A registry key, a fixture or a component asks for media and gets one of:
 *
 *   - a **file** under `public/`, addressed by a path-derived key
 *     (`/how-it-works/create-quiz.png` -> `how-it-works.create-quiz`). Those entries are
 *     exhaustively generated from the filesystem, so E18 can prove both directions
 *     (key -> file, file -> key).
 *   - a **remote** URL somebody else serves (`https://flagcdn.com/16x12/us.png`). It has a
 *     `url`, an optional intrinsic size, and a **required fallback seed** — a remote image
 *     is the one tier that can fail after the page has shipped, so it always carries the
 *     identity of the default that replaces it.
 *   - a **generated default** — no bytes, no path (`generated: true`), drawn from a `seed`.
 *     Issue #130 deleted the 23 identical `public/category/*.webp` placeholders and drew the
 *     tiles instead; issue #152 deleted the nine shared avatar files and drew the faces.
 *     Phase 1 of #155 deletes the two remaining shared blobs (`00c56c3b` x29, `6d0d1561` x9)
 *     and draws those slots too.
 *
 * THE ORDER IS THE POINT. `pickMedia` resolves candidates file -> remote -> generated, and
 * `components/media/media.tsx` is the only component that renders the winner, so a slot
 * never decides for itself which tier it is on. When a rendered file or remote **fails** (a
 * 404, a dead CDN), the same component swaps to the generated default for the entry's seed
 * instead of painting a broken icon.
 *
 * `data/media.ts` is generated from the filesystem (plus the category taxonomy) by
 * `scripts/gen-media.mjs`; this module is the shape it must satisfy and the union a
 * component switches on.
 *
 * `ImageRef` does not change (decision D-P2-1): a fixture still says
 * `src: "/quiz/q1.jpg"`, and E19 holds that string to a registry `src`. Moving fixtures to
 * `{ key }` is the P3 JSON manifest (ENV-SPEC §7), not this gate — and a record gaining a
 * `media` field of its own is phase 2 of #155 (after the backend, #145), not this file.
 */
import { z } from "zod";

/**
 * What a media file is *for*. Closed on purpose: a component that branches on media picks
 * one of these, so adding "banner" is a schema change, not a string at a call site.
 */
export const MEDIA_KINDS = [
  "avatar",
  "background",
  "category-art",
  "fallback",
  "illustration",
  "news-art",
  "quiz-art",
  "tip-art",
] as const;

export const zMediaKind = z.enum(MEDIA_KINDS);
export type MediaKind = z.infer<typeof zMediaKind>;

/**
 * One file, with the facts a renderer must not re-invent. `strict()` like every other
 * object here: an unknown key is a fixture drift, not a carried field.
 *
 * `alt` may be empty — a CSS background and a placeholder are decorative, and inventing
 * alt text for them makes a screen reader read decoration aloud. Everything informational
 * carries a real description.
 */
export const zFileMediaEntry = z
  .object({
    /**
     * Public URL path exactly as `next/image` wants it: `/avatars/champion.png`. A
     * generated entry has no `src` at all — see the `generated` literal below.
     */
    src: z.string().regex(/^\/[^?#\s]*\.(?:png|jpe?g|webp|svg|gif|avif|ico)$/i, {
      message: "must be a public-rooted image path with no query string",
    }),
    alt: z.string(),
    /** Intrinsic pixel size, read from the file's bytes. `next/image` 500s in dev without it. */
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    kind: zMediaKind,
  })
  .strict();

/**
 * An image somebody else serves (issue #155).
 *
 * HTTPS only: an `http://` image on a page served over TLS is blocked by the browser, and a
 * slot that renders nothing is worse than one that admits it has no image. `width` and
 * `height` are optional — a remote host does not always tell you, and the slot's own layout
 * is what reserves the box — but when they are given both must be, because a half-specified
 * aspect ratio is a layout bug the schema can refuse.
 *
 * `fallbackSeed` is required. The remote tier is the only one that can die between deploys,
 * so the entry that can die carries the identity of the default that replaces it: the
 * resolver draws generated media from this seed on `onError`, deterministically, so the
 * fallback is the same picture on every render and in every screenshot.
 */
export const zRemoteMediaEntry = z
  .object({
    url: z.string().regex(/^https:\/\/[^\s]+$/, {
      message: "must be an https URL (an http image is blocked on a TLS page)",
    }),
    alt: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    /** Seeds the generated default that replaces this image when it fails to load. */
    fallbackSeed: z.string().min(1),
    kind: zMediaKind,
  })
  .strict()
  .refine(
    (entry) => (entry.width === undefined) === (entry.height === undefined),
    "width and height are optional together: give both, or neither",
  );

/**
 * A default the renderer generates from data it already holds (issues #130, #152, #155).
 *
 * No `src`, no `width`/`height`: there is no file to address and nothing to size, and
 * accepting them here would let an entry describe a request the build must not make.
 * `generated: true` is the flag a component branches on — the literal, not a boolean, so
 * TypeScript narrows the union.
 *
 * `seed` is required because a drawn default is only worth having if it is deterministic:
 * the same seed is the same gradient and the same mark on the server, in the browser and in
 * a screenshot diff. A seed derived from an array index re-colours every tile when a
 * fixture is reordered, and `Math.random()` is the hydration bug AGENTS.md warns about, so
 * the seed is a stable identity (a slug, a record id, a path) and nothing else.
 */
export const zGeneratedMediaEntry = z
  .object({
    generated: z.literal(true),
    /** Input to the drawn default: same seed, same output, always. */
    seed: z.string().min(1),
    /** Decorative by definition: the tile's own label is its accessible name. */
    alt: z.string(),
    kind: zMediaKind,
  })
  .strict();

export const zMediaEntry = z.union([zFileMediaEntry, zRemoteMediaEntry, zGeneratedMediaEntry]);

export type FileMediaEntry = z.infer<typeof zFileMediaEntry>;
export type RemoteMediaEntry = z.infer<typeof zRemoteMediaEntry>;
export type GeneratedMediaEntry = z.infer<typeof zGeneratedMediaEntry>;
export type MediaEntry = z.infer<typeof zMediaEntry>;

/** A file-backed entry — the only kind that has a path to render. Narrows the union. */
export function isFileMedia(entry: MediaEntry): entry is FileMediaEntry {
  return "src" in entry;
}

/** A remote entry — somebody else's server, and therefore the one that can 404. */
export function isRemoteMedia(entry: MediaEntry): entry is RemoteMediaEntry {
  return "url" in entry;
}

/** A generated default — no bytes, drawn from `seed` by the resolver. */
export function isGeneratedMedia(entry: MediaEntry): entry is GeneratedMediaEntry {
  return !isFileMedia(entry) && !isRemoteMedia(entry);
}

/**
 * The tier order, in one function: file wins over remote, remote wins over generated, and
 * the first candidate of the winning tier wins. `undefined` candidates are skipped, so a
 * call site can hand over a record's optional image without writing a conditional.
 */
export function pickMedia(...candidates: (MediaEntry | undefined)[]): MediaEntry | undefined {
  const present = candidates.filter((entry): entry is MediaEntry => entry !== undefined);
  return present.find(isFileMedia) ?? present.find(isRemoteMedia) ?? present.find(isGeneratedMedia);
}

/** A generated default for `seed`. The builder a slot uses when its record has no image. */
export function generatedMedia(
  seed: string,
  kind: MediaKind = "illustration",
  alt = "",
): GeneratedMediaEntry {
  return { generated: true, seed, alt, kind };
}

/** A remote entry. `fallbackSeed` is the identity of what replaces it if it fails. */
export function remoteMedia(
  url: string,
  fallbackSeed: string,
  options: { alt?: string; kind?: MediaKind; width?: number; height?: number } = {},
): RemoteMediaEntry {
  return {
    url,
    alt: options.alt ?? "",
    fallbackSeed,
    kind: options.kind ?? "illustration",
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.height === undefined ? {} : { height: options.height }),
  };
}

/**
 * The generated default an entry falls back to when its own bytes fail to render.
 *
 * A generated entry is already the default, so it is its own fallback. A **file** seeds from
 * its path (stable across renders, unique per file, and truthful about which image the
 * picture was standing in for). A **remote** entry seeds from its `fallbackSeed`, because
 * that is the one identity the author chose for exactly this moment.
 */
export function fallbackOf(entry: MediaEntry): GeneratedMediaEntry {
  if (isFileMedia(entry)) return generatedMedia(entry.src, entry.kind, entry.alt);
  if (isRemoteMedia(entry)) return generatedMedia(entry.fallbackSeed, entry.kind, entry.alt);
  return entry;
}

/**
 * The registry as one object: keys are path-derived strings, values are strict entries.
 * A record, not an array — the key *is* the join (a fixture or component asks for
 * `quiz.q1`, never for `entries.find(...)`).
 */
export const zMediaRegistry = z.record(z.string().min(1), zMediaEntry);
export type MediaRegistry = z.infer<typeof zMediaRegistry>;
