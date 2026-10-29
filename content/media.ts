/**
 * MediaEntry — the one object P2 introduces on the media side.
 *
 * A registry key addresses exactly one file under `public/`: the key is derived from the
 * path (`/how-it-works/create-quiz.png` -> `how-it-works.create-quiz`), so the map is
 * exhaustive by construction and E18 can prove both directions (key -> file, file -> key).
 * `data/media.ts` is generated from the filesystem by `scripts/gen-media.mjs`; this module
 * is the shape it must satisfy and the union a component switches on.
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
export const zMediaEntry = z
  .object({
    /** Public URL path exactly as `next/image` wants it: `/avatars/alex.png`. */
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

export type MediaEntry = z.infer<typeof zMediaEntry>;

/**
 * The registry as one object: keys are path-derived strings, values are strict entries.
 * A record, not an array — the key *is* the join (a fixture or component asks for
 * `quiz.q1`, never for `entries.find(...)`).
 */
export const zMediaRegistry = z.record(z.string().min(1), zMediaEntry);
export type MediaRegistry = z.infer<typeof zMediaRegistry>;
