/**
 * The media registry — every thing a component draws, addressed by a key.
 *
 * Storage, not a projection: a component asks for a key and gets the one thing it names,
 * so no `.tsx` holds a literal `/image.png` any more (E17).
 *
 * Two kinds of entry live here, and `content/media.ts` is the union:
 *
 *   - a **file** under `public/`. Keys are derived from the path, never invented
 *     (`mediaKeyOf` in `scripts/media-refs.ts`), so key <-> file is a bijection and both
 *     directions are checked (E18). `ImageRef.src` in `data/` stays a path in P2
 *     (D-P2-1) and must equal an entry's `src` (E19).
 *   - a **generated default** — `generated: true`, no `src`, no size. Issue #130 deleted
 *     the twenty-three identical `public/category/*.webp` placeholders (one blob,
 *     `df44187d`); a quiz subject's tile is now a gradient seeded by its slug plus a
 *     monogram from its name, drawn by `components/categories/category-tile.tsx`. No
 *     bytes, so nothing for the build to request.
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
  "about-affiliate": {
    src: "/about-affiliate.png",
    alt: "About Affiliate",
    width: 1024,
    height: 1024,
    kind: "illustration",
  },
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
  "avatars.alex": {
    src: "/avatars/alex.png",
    alt: "Alex avatar",
    width: 120,
    height: 120,
    kind: "avatar",
  },
  "avatars.brain": {
    src: "/avatars/brain.png",
    alt: "Brain avatar",
    width: 120,
    height: 120,
    kind: "avatar",
  },
  "avatars.champion": {
    src: "/avatars/champion.png",
    alt: "Champion avatar",
    width: 1024,
    height: 1024,
    kind: "avatar",
  },
  "avatars.genious": {
    src: "/avatars/genious.png",
    alt: "Genious avatar",
    width: 120,
    height: 120,
    kind: "avatar",
  },
  "avatars.guru": {
    src: "/avatars/guru.png",
    alt: "Guru avatar",
    width: 120,
    height: 120,
    kind: "avatar",
  },
  "avatars.king": {
    src: "/avatars/king.webp",
    alt: "King avatar",
    width: 416,
    height: 437,
    kind: "avatar",
  },
  "avatars.master": {
    src: "/avatars/master.png",
    alt: "Master avatar",
    width: 120,
    height: 120,
    kind: "avatar",
  },
  "avatars.mind": {
    src: "/avatars/mind.webp",
    alt: "Mind avatar",
    width: 416,
    height: 437,
    kind: "avatar",
  },
  "avatars.sarah": {
    src: "/avatars/sarah.webp",
    alt: "Sarah avatar",
    width: 416,
    height: 437,
    kind: "avatar",
  },
  "avatars.wizard": {
    src: "/avatars/wizard.webp",
    alt: "Wizard avatar",
    width: 416,
    height: 437,
    kind: "avatar",
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
    alt: "",
    kind: "category-art",
  },
  "category.architecture": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.art": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.business": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.coding": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.comics": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.fashion": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.food": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.general-knowledge": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.geography": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.health": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.history": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.language": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.literature": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.math": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.movies": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.music": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.politics": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.puzzle": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.science": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.space": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.sports": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.technology": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.trivia": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "category.video-game": {
    generated: true,
    alt: "",
    kind: "category-art",
  },
  "classic-novels-quiz": {
    src: "/classic-novels-quiz.png",
    alt: "Classic Novels Quiz",
    width: 1024,
    height: 1024,
    kind: "illustration",
  },
  "earn-reward": {
    src: "/earn-reward.png",
    alt: "Earn Reward",
    width: 2048,
    height: 2048,
    kind: "illustration",
  },
  "gift-box-coins": {
    src: "/gift-box-coins.png",
    alt: "Gift Box Coins",
    width: 1024,
    height: 1024,
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
  "how-it-works.earn-rewards": {
    src: "/how-it-works/earn-rewards.png",
    alt: "Earn Rewards",
    width: 1024,
    height: 1024,
    kind: "illustration",
  },
  "marvel-cinematic-universe": {
    src: "/marvel-cinematic-universe.png",
    alt: "Marvel Cinematic Universe",
    width: 1024,
    height: 1024,
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
  "news.news1": {
    src: "/news/news1.png",
    alt: "News article image 1",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news2": {
    src: "/news/news2.png",
    alt: "News article image 2",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news3": {
    src: "/news/news3.png",
    alt: "News article image 3",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news4": {
    src: "/news/news4.png",
    alt: "News article image 4",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news5": {
    src: "/news/news5.png",
    alt: "News article image 5",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news6": {
    src: "/news/news6.png",
    alt: "News article image 6",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news7": {
    src: "/news/news7.png",
    alt: "News article image 7",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news8": {
    src: "/news/news8.png",
    alt: "News article image 8",
    width: 1280,
    height: 720,
    kind: "news-art",
  },
  "news.news9": {
    src: "/news/news9.png",
    alt: "News article image 9",
    width: 1280,
    height: 720,
    kind: "news-art",
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
  "quiz-banner": {
    src: "/quiz-banner.png",
    alt: "Quiz Banner",
    width: 1280,
    height: 720,
    kind: "illustration",
  },
  "quiz-design-strategies": {
    src: "/quiz-design-strategies.png",
    alt: "Quiz Design Strategies",
    width: 1024,
    height: 1024,
    kind: "illustration",
  },
  "quiz.marvel": {
    src: "/quiz/marvel.png",
    alt: "Marvel quiz artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q1": {
    src: "/quiz/q1.jpg",
    alt: "Quiz question 1 artwork",
    width: 896,
    height: 504,
    kind: "quiz-art",
  },
  "quiz.q10": {
    src: "/quiz/q10.png",
    alt: "Quiz question 10 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q11": {
    src: "/quiz/q11.png",
    alt: "Quiz question 11 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q12": {
    src: "/quiz/q12.png",
    alt: "Quiz question 12 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q13": {
    src: "/quiz/q13.png",
    alt: "Quiz question 13 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q14": {
    src: "/quiz/q14.png",
    alt: "Quiz question 14 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q15": {
    src: "/quiz/q15.png",
    alt: "Quiz question 15 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q17": {
    src: "/quiz/q17.png",
    alt: "Quiz question 17 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q18": {
    src: "/quiz/q18.png",
    alt: "Quiz question 18 artwork",
    width: 1280,
    height: 720,
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
  "quiz.q6": {
    src: "/quiz/q6.png",
    alt: "Quiz question 6 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q7": {
    src: "/quiz/q7.png",
    alt: "Quiz question 7 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q8": {
    src: "/quiz/q8.png",
    alt: "Quiz question 8 artwork",
    width: 1280,
    height: 720,
    kind: "quiz-art",
  },
  "quiz.q9": {
    src: "/quiz/q9.png",
    alt: "Quiz question 9 artwork",
    width: 1280,
    height: 720,
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
  "sports-trivia-quiz": {
    src: "/sports-trivia-quiz.png",
    alt: "Sports Trivia Quiz",
    width: 1024,
    height: 1024,
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
  "tips.tip-1": {
    src: "/tips/tip-1.png",
    alt: "Creator tip illustration 1",
    width: 1280,
    height: 720,
    kind: "tip-art",
  },
  "tips.tip-2": {
    src: "/tips/tip-2.png",
    alt: "Creator tip illustration 2",
    width: 1280,
    height: 720,
    kind: "tip-art",
  },
  "tips.tip-3": {
    src: "/tips/tip-3.png",
    alt: "Creator tip illustration 3",
    width: 1280,
    height: 720,
    kind: "tip-art",
  },
  "tips.tip-4": {
    src: "/tips/tip-4.png",
    alt: "Creator tip illustration 4",
    width: 1280,
    height: 720,
    kind: "tip-art",
  },
  "tips.tip-5": {
    src: "/tips/tip-5.png",
    alt: "Creator tip illustration 5",
    width: 1280,
    height: 720,
    kind: "tip-art",
  },
  "tips.tip-6": {
    src: "/tips/tip-6.png",
    alt: "Creator tip illustration 6",
    width: 1280,
    height: 720,
    kind: "tip-art",
  },
  "world-landmarks": {
    src: "/world-landmarks.png",
    alt: "World Landmarks",
    width: 1024,
    height: 1024,
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
