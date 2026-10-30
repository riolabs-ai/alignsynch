/**
 * The media registry — every thing a component draws, addressed by a key.
 *
 * Storage, not a projection: a component asks for a key and gets the one thing it names,
 * so no `.tsx` holds a literal `/image.png` any more (E17).
 *
 * TWO OF THE THREE TIERS LIVE HERE. An entry is either a **file** under `public/` (key
 * derived from the path, never invented, so key <-> file is a bijection and both directions
 * are checked — E18) or a **generated default** (`generated: true`, a `seed`, no `src`, no
 * size). The third tier — a **remote** URL (`content/media.ts::zRemoteMediaEntry`) — is never
 * stored here: it addresses somebody else's server, so it is built at the call site from the
 * record it belongs to (`remoteMedia(player.countryCode …)`) and carries its own
 * `fallbackSeed`.
 *
 * Issue #130 deleted the twenty-three identical `public/category/*.webp` placeholders (one
 * blob, `df44187d`); a quiz subject's tile is now a gradient seeded by its slug plus a
 * monogram from its name, drawn by `components/categories/category-tile.tsx`. Issue #155
 * deleted the last two shared blobs, so every slot those files filled is drawn by
 * `components/media/media.tsx` from a seed instead of borrowing one picture.
 *
 * GENERATED — do not hand-edit. `node scripts/gen-media.mjs` rewrites this file from
 * `public/` plus `content/category.ts`; `pnpm data:check` is what fails when the two
 * disagree. A JSON manifest is a P3 decision, not a P2 one (ENV-SPEC §7).
 *
 * `kind` is what the media is *for* — a component switches on it (avatar vs background is
 * layout, not styling). `width`/`height` are read from the file's bytes, because
 * `next/image` needs an intrinsic size and dev renders a 500 without one; a generated
 * entry has neither, because it has no file to size.
 */
import type { MediaEntry } from "@/content/media";

export const media = {
  "abstract-geometric-shapes": {
    src: "/abstract-geometric-shapes.png",
    alt: "Abstract Geometric Shapes",
    width: 1024,
    height: 680,
    kind: "illustration",
  },
  "ancient-civilizations-quiz": {
    src: "/ancient-civilizations-quiz.png",
    alt: "Ancient Civilizations Quiz",
    width: 1024,
    height: 440,
    kind: "illustration",
  },
  "brain-teasers-puzzles": {
    src: "/brain-teasers-puzzles.png",
    alt: "Brain Teasers Puzzles",
    width: 1024,
    height: 574,
    kind: "illustration",
  },
  "brand.as2-logo_v2_cl": {
    src: "/brand/as2-logo_v2_cl.png",
    alt: "As2 Logo V2 Cl",
    width: 818,
    height: 127,
    kind: "illustration",
  },
  "browse-category": {
    src: "/browse-category.png",
    alt: "Browse Category",
    width: 2048,
    height: 2048,
    kind: "illustration",
  },
  "card-cover": {
    src: "/card-cover.png",
    alt: "Card Cover",
    width: 300,
    height: 100,
    kind: "illustration",
  },
  "category.animal": {
    generated: true,
    seed: "animal",
    alt: "",
    kind: "category-art",
  },
  "category.architecture": {
    generated: true,
    seed: "architecture",
    alt: "",
    kind: "category-art",
  },
  "category.art": {
    generated: true,
    seed: "art",
    alt: "",
    kind: "category-art",
  },
  "category.business": {
    generated: true,
    seed: "business",
    alt: "",
    kind: "category-art",
  },
  "category.coding": {
    generated: true,
    seed: "coding",
    alt: "",
    kind: "category-art",
  },
  "category.comics": {
    generated: true,
    seed: "comics",
    alt: "",
    kind: "category-art",
  },
  "category.fashion": {
    generated: true,
    seed: "fashion",
    alt: "",
    kind: "category-art",
  },
  "category.food": {
    generated: true,
    seed: "food",
    alt: "",
    kind: "category-art",
  },
  "category.general-knowledge": {
    generated: true,
    seed: "general-knowledge",
    alt: "",
    kind: "category-art",
  },
  "category.geography": {
    generated: true,
    seed: "geography",
    alt: "",
    kind: "category-art",
  },
  "category.health": {
    generated: true,
    seed: "health",
    alt: "",
    kind: "category-art",
  },
  "category.history": {
    generated: true,
    seed: "history",
    alt: "",
    kind: "category-art",
  },
  "category.language": {
    generated: true,
    seed: "language",
    alt: "",
    kind: "category-art",
  },
  "category.literature": {
    generated: true,
    seed: "literature",
    alt: "",
    kind: "category-art",
  },
  "category.math": {
    generated: true,
    seed: "math",
    alt: "",
    kind: "category-art",
  },
  "category.movies": {
    generated: true,
    seed: "movies",
    alt: "",
    kind: "category-art",
  },
  "category.music": {
    generated: true,
    seed: "music",
    alt: "",
    kind: "category-art",
  },
  "category.politics": {
    generated: true,
    seed: "politics",
    alt: "",
    kind: "category-art",
  },
  "category.puzzle": {
    generated: true,
    seed: "puzzle",
    alt: "",
    kind: "category-art",
  },
  "category.science": {
    generated: true,
    seed: "science",
    alt: "",
    kind: "category-art",
  },
  "category.space": {
    generated: true,
    seed: "space",
    alt: "",
    kind: "category-art",
  },
  "category.sports": {
    generated: true,
    seed: "sports",
    alt: "",
    kind: "category-art",
  },
  "category.technology": {
    generated: true,
    seed: "technology",
    alt: "",
    kind: "category-art",
  },
  "category.trivia": {
    generated: true,
    seed: "trivia",
    alt: "",
    kind: "category-art",
  },
  "category.video-game": {
    generated: true,
    seed: "video-game",
    alt: "",
    kind: "category-art",
  },
  "earn-reward": {
    src: "/earn-reward.png",
    alt: "Earn Reward",
    width: 2048,
    height: 2048,
    kind: "illustration",
  },
  "hero-bg": {
    src: "/hero-bg.jpg",
    alt: "",
    width: 1607,
    height: 400,
    kind: "background",
  },
  "history-mysteries": {
    src: "/history-mysteries.png",
    alt: "History Mysteries",
    width: 1024,
    height: 511,
    kind: "illustration",
  },
  "how-it-works.answer-questions": {
    src: "/how-it-works/answer-questions.png",
    alt: "Answer Questions",
    width: 1024,
    height: 586,
    kind: "illustration",
  },
  "how-it-works.create-quiz": {
    src: "/how-it-works/create-quiz.png",
    alt: "Create Quiz",
    width: 1024,
    height: 604,
    kind: "illustration",
  },
  "math-puzzles-quiz": {
    src: "/math-puzzles-quiz.png",
    alt: "Math Puzzles Quiz",
    width: 1024,
    height: 509,
    kind: "illustration",
  },
  "music-quiz": {
    src: "/music-quiz.png",
    alt: "Music Quiz",
    width: 1024,
    height: 510,
    kind: "illustration",
  },
  "newsletter-bg": {
    src: "/newsletter-bg.png",
    alt: "",
    width: 1024,
    height: 680,
    kind: "background",
  },
  placeholder: {
    src: "/placeholder.svg",
    alt: "",
    width: 1200,
    height: 1200,
    kind: "fallback",
  },
  "placeholder-logo": {
    src: "/placeholder-logo.svg",
    alt: "",
    width: 215,
    height: 48,
    kind: "fallback",
  },
  "portrait-of-sarah": {
    src: "/portrait-of-sarah.png",
    alt: "Portrait Of Sarah",
    width: 1024,
    height: 609,
    kind: "illustration",
  },
  "qr-code-generic": {
    src: "/qr-code-generic.png",
    alt: "Qr Code Generic",
    width: 1024,
    height: 1024,
    kind: "illustration",
  },
  "quiz-ai-illustration": {
    src: "/quiz-ai-illustration.png",
    alt: "Quiz Ai Illustration",
    width: 1024,
    height: 1024,
    kind: "illustration",
  },
  "quiz-answering": {
    src: "/quiz-answering.png",
    alt: "Quiz Answering",
    width: 1024,
    height: 664,
    kind: "illustration",
  },
  "quiz.q1": {
    src: "/quiz/q1.jpg",
    alt: "Quiz question 1 artwork",
    width: 896,
    height: 504,
    kind: "quiz-art",
  },
  "quiz.q2": {
    src: "/quiz/q2.jpg",
    alt: "Quiz question 2 artwork",
    width: 896,
    height: 504,
    kind: "quiz-art",
  },
  "quiz.q3": {
    src: "/quiz/q3.jpg",
    alt: "Quiz question 3 artwork",
    width: 896,
    height: 504,
    kind: "quiz-art",
  },
  "quiz.q4": {
    src: "/quiz/q4.jpg",
    alt: "Quiz question 4 artwork",
    width: 896,
    height: 504,
    kind: "quiz-art",
  },
  "quiz.q5": {
    src: "/quiz/q5.jpg",
    alt: "Quiz question 5 artwork",
    width: 896,
    height: 504,
    kind: "quiz-art",
  },
  "refer-bg": {
    src: "/refer-bg.png",
    alt: "",
    width: 608,
    height: 344,
    kind: "background",
  },
  "space-exploration-quiz": {
    src: "/space-exploration-quiz.png",
    alt: "Space Exploration Quiz",
    width: 1024,
    height: 681,
    kind: "illustration",
  },
  "take-quiz": {
    src: "/take-quiz.png",
    alt: "Take Quiz",
    width: 2048,
    height: 2048,
    kind: "illustration",
  },
  "technology-quiz": {
    src: "/technology-quiz.png",
    alt: "Technology Quiz",
    width: 1024,
    height: 508,
    kind: "illustration",
  },
  "world-map-quiz": {
    src: "/world-map-quiz.png",
    alt: "World Map Quiz",
    width: 1024,
    height: 570,
    kind: "illustration",
  },
} as const satisfies Record<string, MediaEntry>;

/** Every key the registry can address. A typo is a type error, not a 404. */
export type MediaKey = keyof typeof media;

/**
 * The keys that address a file on disk — every key except a generated default (#130).
 * A component that needs a path (an `Image`, an avatar) takes this, so passing a generated
 * tile is a type error rather than an `undefined` src at runtime.
 */
export type FileMediaKey = {
  [K in MediaKey]: (typeof media)[K] extends { readonly src: string } ? K : never;
}[MediaKey];

/** The entry for a key. Exists so a component can take a `MediaKey` instead of a path. */
export function mediaEntry(key: MediaKey): MediaEntry {
  return media[key];
}

/** The public path for a file-backed key — the one string `next/image` needs. */
export function mediaSrc(key: FileMediaKey): string {
  return media[key].src;
}
