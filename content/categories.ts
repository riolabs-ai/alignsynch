/**
 * content/categories.ts — the seed table. 25 quiz subjects + 20 editorial categories.
 *
 * One table, four scopes. This module is the migration target for
 *   data/categories.tsx (A, 22 rows)
 *   components/categories/categories-data.tsx (B, 14 rows)
 *   data/searchdata.ts categories (C, 4 rows + "Education")
 *   data/creator-tips-data.ts categories (6), data/news-data.ts categories (7),
 *   data/knowledge-base-data.ts article.category (7)
 *
 * Field provenance per row: `iconKey`/`description` = B's copy, `featured` = B's flag.
 * `image` = A's asset — and since issue #130 no quiz row carries one: the twenty-three
 * `public/category/*.webp` placeholders were one and the same PNG (blob `df44187d`), so
 * they were deleted and every subject's tile is now generated from its slug
 * (`components/categories/category-tile.tsx`). The field stays on the schema: a real,
 * distinct image is what earns an entry, and adding one is a data change plus
 * `node scripts/gen-media.mjs`.
 *
 * `count` is absent everywhere by design: see deriveCategoryCounts().
 */
import { type Category, makeCategoryNameResolver, type QuizCategorySlug } from "./category";

/** 25 canonical quiz subjects, in A's browse order, with the 3 added subjects last. */
export const quizCategories: readonly Category[] = [
  {
    id: "animal",
    scope: "quiz",
    slug: "animal",
    name: "Animal",
    featured: false,
  },
  {
    id: "architecture",
    scope: "quiz",
    slug: "architecture",
    name: "Architecture",
    description:
      "Explore questions about famous buildings, architectural styles, and renowned architects.",
    iconKey: "building-2",
    featured: false,
  },
  {
    id: "business",
    scope: "quiz",
    slug: "business",
    name: "Business",
    description:
      "Challenge yourself with questions about economics, companies, entrepreneurs, and financial concepts.",
    iconKey: "wallet",
    featured: false,
  },
  {
    id: "coding",
    scope: "quiz",
    slug: "coding",
    name: "Coding",
    featured: false,
  },
  {
    id: "comics",
    scope: "quiz",
    slug: "comics",
    name: "Comics",
    featured: false,
  },
  {
    id: "fashion",
    scope: "quiz",
    slug: "fashion",
    name: "Fashion",
    featured: false,
  },
  {
    id: "food",
    scope: "quiz",
    slug: "food",
    name: "Food",
    description:
      "Test your knowledge of cuisines, ingredients, cooking techniques, and famous chefs.",
    iconKey: "utensils",
    featured: false,
  },
  {
    id: "general-knowledge",
    scope: "quiz",
    slug: "general-knowledge",
    name: "General Knowledge",
    featured: false,
  },
  {
    id: "geography",
    scope: "quiz",
    slug: "geography",
    name: "Geography",
    description:
      "Test your knowledge of countries, capitals, landmarks, and geographical features.",
    iconKey: "globe",
    featured: false,
  },
  {
    id: "health",
    scope: "quiz",
    slug: "health",
    name: "Health",
    featured: false,
  },
  {
    id: "language",
    scope: "quiz",
    slug: "language",
    name: "Language",
    featured: false,
  },
  {
    id: "literature",
    scope: "quiz",
    slug: "literature",
    name: "Literature",
    description: "Test your knowledge of books, authors, and literary works.",
    iconKey: "book-open",
    featured: true,
  },
  {
    id: "math",
    scope: "quiz",
    slug: "math",
    name: "Math",
    description: "Challenge yourself with math problems, puzzles, and concepts.",
    iconKey: "lightbulb",
    featured: true,
  },
  {
    id: "movies",
    scope: "quiz",
    slug: "movies",
    name: "Movies",
    description: "Test your knowledge of films, TV shows, actors, directors, and pop culture.",
    iconKey: "popcorn",
    featured: false,
  },
  {
    id: "music",
    scope: "quiz",
    slug: "music",
    name: "Music",
    description:
      "Challenge yourself with questions about artists, songs, instruments, and music history.",
    iconKey: "music",
    featured: false,
  },
  {
    id: "politics",
    scope: "quiz",
    slug: "politics",
    name: "Politics",
    featured: false,
  },
  {
    id: "puzzle",
    scope: "quiz",
    slug: "puzzle",
    name: "Puzzle",
    featured: false,
  },
  {
    id: "space",
    scope: "quiz",
    slug: "space",
    name: "Space",
    description: "Test your knowledge of astronomy, space exploration, planets, and the universe.",
    iconKey: "rocket",
    featured: false,
  },
  {
    id: "sports",
    scope: "quiz",
    slug: "sports",
    name: "Sports",
    description:
      "Challenge yourself with questions about various sports, athletes, and competitions.",
    iconKey: "dumbbell",
    featured: true,
  },
  {
    id: "technology",
    scope: "quiz",
    slug: "technology",
    name: "Technology",
    description: "Explore questions about computers, gadgets, programming, and tech innovations.",
    iconKey: "code",
    featured: false,
  },
  {
    id: "trivia",
    scope: "quiz",
    slug: "trivia",
    name: "Trivia",
    featured: false,
  },
  {
    id: "video-game",
    scope: "quiz",
    slug: "video-game",
    name: "Video Game",
    featured: false,
  },
  // --- the three subjects the content actually uses; B had all three, A had none ---
  {
    id: "science",
    scope: "quiz",
    slug: "science",
    name: "Science",
    description: "Test your knowledge of scientific concepts, discoveries, and famous scientists.",
    iconKey: "atom",
    featured: true,
  },
  {
    id: "history",
    scope: "quiz",
    slug: "history",
    name: "History",
    description: "Explore historical events, figures, and civilizations from around the world.",
    iconKey: "landmark",
    featured: true,
  },
  {
    id: "art",
    scope: "quiz",
    slug: "art",
    name: "Art",
    description: "Explore questions about famous artworks, artists, movements, and techniques.",
    iconKey: "palette",
    featured: false,
  },
];

/** News (7) — was `data/news-data.ts::categories` (string[]). */
export const newsCategories: readonly Category[] = [
  { id: "news-quiz-tips", scope: "news", slug: "quiz-tips", name: "Quiz Tips", featured: false },
  {
    id: "news-platform-updates",
    scope: "news",
    slug: "platform-updates",
    name: "Platform Updates",
    featured: false,
  },
  { id: "news-community", scope: "news", slug: "community", name: "Community", featured: false },
  { id: "news-tutorials", scope: "news", slug: "tutorials", name: "Tutorials", featured: false },
  { id: "news-events", scope: "news", slug: "events", name: "Events", featured: false },
  {
    id: "news-success-stories",
    scope: "news",
    slug: "success-stories",
    name: "Success Stories",
    featured: false,
  },
  {
    id: "news-industry-news",
    scope: "news",
    slug: "industry-news",
    name: "Industry News",
    featured: false,
  },
];

/** Creator tips (6) — was `data/creator-tips-data.ts::categories` (id/name/description/icon/count). */
export const tipCategories: readonly Category[] = [
  {
    id: "tip-question-writing",
    scope: "tip",
    slug: "question-writing",
    name: "Question Writing",
    description: "Learn how to write effective and engaging quiz questions",
    iconKey: "pencil-line",
    featured: false,
  },
  {
    id: "tip-engagement",
    scope: "tip",
    slug: "engagement",
    name: "User Engagement",
    description: "Strategies to keep participants interested and coming back",
    iconKey: "users",
    featured: false,
  },
  {
    id: "tip-monetization",
    scope: "tip",
    slug: "monetization",
    name: "Monetization",
    description: "Tips for earning revenue from your quizzes",
    iconKey: "dollar-sign",
    featured: false,
  },
  {
    id: "tip-design",
    scope: "tip",
    slug: "design",
    name: "Quiz Design",
    description: "Best practices for quiz structure and flow",
    iconKey: "palette",
    featured: false,
  },
  {
    id: "tip-promotion",
    scope: "tip",
    slug: "promotion",
    name: "Promotion",
    description: "How to promote your quizzes and reach more people",
    iconKey: "megaphone",
    featured: false,
  },
  {
    id: "tip-technical",
    scope: "tip",
    slug: "technical",
    name: "Technical Tips",
    description: "Technical aspects of creating effective quizzes",
    iconKey: "settings",
    featured: false,
  },
];

/** Knowledge base (7) — was `article.category: string` (D16). Names derived from the slug; the fixture never had them. */
export const kbCategories: readonly Category[] = [
  { id: "kb-general", scope: "kb", slug: "general", name: "General", featured: false },
  { id: "kb-account", scope: "kb", slug: "account", name: "Account", featured: false },
  { id: "kb-billing", scope: "kb", slug: "billing", name: "Billing", featured: false },
  {
    id: "kb-quiz-creation",
    scope: "kb",
    slug: "quiz-creation",
    name: "Quiz Creation",
    featured: false,
  },
  { id: "kb-tournaments", scope: "kb", slug: "tournaments", name: "Tournaments", featured: false },
  { id: "kb-privacy", scope: "kb", slug: "privacy", name: "Privacy", featured: false },
  { id: "kb-technical", scope: "kb", slug: "technical", name: "Technical", featured: false },
];

/** The whole table: 45 rows, 25 quiz + 7 news + 6 tip + 7 kb. */
export const categories: readonly Category[] = [
  ...quizCategories,
  ...newsCategories,
  ...tipCategories,
  ...kbCategories,
];

/**
 * Display label for a category id — the ONE place a record's `categoryIds` become
 * text. Falls back to de-kebabing the id so an unknown id still renders something
 * legible; `data:check` rejects unknown ids long before this is reached.
 */
export const categoryName = makeCategoryNameResolver(categories);

/* ------------------------------------------------------------------ *
 * Quiz subjects: the selector a component is allowed to use
 * ------------------------------------------------------------------ */

const quizCategoryBySlugIndex: ReadonlyMap<string, Category> = new Map(
  quizCategories.map((category) => [category.slug, category]),
);

/**
 * The display label for a subject. A component picks a slug; the table owns the text.
 * `data:check` E20 fails any `components/**` file that types the label instead.
 *
 * The taxonomy is a frozen 25-row table, so a slug with no row is a programming error,
 * not a data condition: it throws instead of rendering a blank label no gate would see.
 */
export function quizCategoryLabel(slug: QuizCategorySlug): string {
  const row = quizCategoryBySlugIndex.get(slug);
  if (!row) throw new Error(`unknown quiz category slug "${slug}"`);
  return row.name;
}
