/**
 * MediaEntry — the one object P2 introduces on the media side.
 *
 * A registry key addresses one thing a renderer can draw, and there are two kinds of
 * thing it can be:
 *
 *   - a **file** under `public/`, addressed by a path-derived key
 *     (`/how-it-works/create-quiz.png` -> `how-it-works.create-quiz`). Those entries are
 *     exhaustively generated from the filesystem, so E18 can prove both directions
 *     (key -> file, file -> key).
 *   - a **generated default** — no bytes, no path (`generated: true`). Issue #130 deleted
 *     the 23 identical `public/category/*.webp` placeholders; the tile is now a gradient
 *     seeded by the category slug plus a monogram from its name, so the registry can
 *     still say "this subject has media" without naming a file that must not exist.
 *
 * `data/media.ts` is generated from the filesystem (plus the category taxonomy) by
 * `scripts/gen-media.mjs`; this module is the shape it must satisfy and the union a
 * component switches on.
 *
 * `ImageRef` does not change in P2 (decision D-P2-1): a fixture still says
 * `src: "/quiz/q1.jpg"`, and E19 holds that string to a registry `src`. Moving fixtures to
 * `{ key }` is the P3 JSON manifest (ENV-SPEC §7), not this gate.
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
 * A default the renderer generates from data it already holds (issue #130).
 *
 * No `src`, no `width`/`height`: there is no file to address and nothing to size, and
 * accepting them here would let an entry describe a request the build must not make.
 * `generated: true` is the flag a component branches on — the literal, not a boolean, so
 * TypeScript narrows the union on `"src" in entry`.
 */
export const zGeneratedMediaEntry = z
  .object({
    generated: z.literal(true),
    /** Decorative by definition: the tile's own label is its accessible name. */
    alt: z.string(),
    kind: zMediaKind,
  })
  .strict();

export const zMediaEntry = z.union([zFileMediaEntry, zGeneratedMediaEntry]);

export type FileMediaEntry = z.infer<typeof zFileMediaEntry>;
export type GeneratedMediaEntry = z.infer<typeof zGeneratedMediaEntry>;
export type MediaEntry = z.infer<typeof zMediaEntry>;

/** A file-backed entry — the only kind that has a path to render. Narrows the union. */
export function isFileMedia(entry: MediaEntry): entry is FileMediaEntry {
  return "src" in entry;
}

/** A generated default — no bytes, drawn from the slug by the component. */
export function isGeneratedMedia(entry: MediaEntry): entry is GeneratedMediaEntry {
  return !isFileMedia(entry);
}

/**
 * The registry as one object: keys are path-derived strings, values are strict entries.
 * A record, not an array — the key *is* the join (a fixture or component asks for
 * `quiz.q1`, never for `entries.find(...)`).
 */
export const zMediaRegistry = z.record(z.string().min(1), zMediaEntry);
export type MediaRegistry = z.infer<typeof zMediaRegistry>;
