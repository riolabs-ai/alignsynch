/**
 * ONE category table for four vocabularies.
 *
 * Locked decisions this file implements:
 *  - a single `Category` type discriminated by `scope`; no per-vocabulary type
 *  - `image` (the browse tiles' assets) and `iconKey` (the icon nav) are both
 *    optional and merge per subject
 *  - `count` is never stored: `deriveCategoryCounts()` computes it from content
 *  - `categoryIds` on content are ids from this table, and the scope must match
 *    the content kind
 *
 * Id rules (the only thing this file adds to the core):
 *  - `quiz` scope: `id === slug` — `/categories/[slug]` resolves by slug and
 *    search rows join by id, so the two must be the same string.
 *  - editorial scopes: `id === "<scope>-<slug>"`. Vocabulary words collide across
 *    scopes (`technical` is both a tip and a kb category); ids may not.
 */
import { z } from "zod";
import { zContentKind, zId, zImageRef, zSlug } from "./core";

/** The four vocabularies. One join mechanism, four namespaces. */
export const zCategoryScope = zContentKind;
export type CategoryScope = z.infer<typeof zCategoryScope>;
export type ContentKind = CategoryScope;

const EDITORIAL_SCOPES = ["news", "tip", "kb"] as const;

const zIconKey = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "iconKey must be a kebab-case registry key (lucide name, kebabed)",
  );

export const zCategory = z
  .object({
    /** unique across ALL scopes; kind-prefixed for editorial scopes */
    id: zId,
    scope: zCategoryScope,
    /** URL identity within its scope */
    slug: zSlug,
    name: z.string().min(1),
    /** Description copy; absent for the subjects that never had one */
    description: z.string().min(1).optional(),
    /** Browse-tile asset; absent for the subjects added from the content */
    image: zImageRef.optional(),
    /** Icon-nav glyph, as a registry key instead of JSX: `Atom` -> `atom` */
    iconKey: zIconKey.optional(),
    featured: z.boolean().default(false),
    // NO count. Derived by deriveCategoryCounts().
  })
  .strict()
  .superRefine((category, ctx) => {
    if (category.scope === "quiz") {
      if (category.slug !== category.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slug"],
          message: `quiz-scope slug must equal id (got id="${category.id}", slug="${category.slug}")`,
        });
      }
      if (EDITORIAL_SCOPES.some((scope) => category.id.startsWith(`${scope}-`))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["id"],
          message: `quiz-scope id "${category.id}" uses a reserved editorial prefix`,
        });
      }
    } else if (category.id !== `${category.scope}-${category.slug}`) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id"],
        message: `${category.scope}-scope id must be "${category.scope}-${category.slug}" (got "${category.id}")`,
      });
    }
  });

export type Category = z.infer<typeof zCategory>;

export const zCategories = z.array(zCategory).superRefine((rows, ctx) => {
  const ids = new Map<string, number>();
  const slugs = new Map<string, number>();
  rows.forEach((category, index) => {
    const firstId = ids.get(category.id);
    if (firstId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "id"],
        message: `duplicate category id "${category.id}" (also row ${firstId})`,
      });
    } else {
      ids.set(category.id, index);
    }

    const slugKey = `${category.scope}/${category.slug}`;
    const firstSlug = slugs.get(slugKey);
    if (firstSlug !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "slug"],
        message: `duplicate slug "${category.slug}" in scope ${category.scope} (also row ${firstSlug})`,
      });
    } else {
      slugs.set(slugKey, index);
    }
  });
});

/** 25 quiz subjects — the canonical taxonomy. Order is the display order. */
export const QUIZ_CATEGORY_SLUGS = [
  "animal",
  "architecture",
  "business",
  "coding",
  "comics",
  "fashion",
  "food",
  "general-knowledge",
  "geography",
  "health",
  "language",
  "literature",
  "math",
  "movies",
  "music",
  "politics",
  "puzzle",
  "space",
  "sports",
  "technology",
  "trivia",
  "video-game",
  "science",
  "history",
  "art",
] as const;
export type QuizCategorySlug = (typeof QUIZ_CATEGORY_SLUGS)[number];

/** content kind -> the only category scope it may point into */
export const SCOPE_OF_KIND: Readonly<Record<ContentKind, CategoryScope>> = {
  quiz: "quiz",
  news: "news",
  tip: "tip",
  kb: "kb",
};

export interface CategoryCountable {
  readonly kind: ContentKind;
  readonly categoryIds: readonly string[];
}

/**
 * `category.count` — derived from live content, never stored.
 *
 *   count[id] = number of live records whose `categoryIds` contains `id`
 *
 * "Live" is the caller's decision (published + visible). Because
 * `assertCategoryScopes()` guarantees a record only points at categories of its
 * own scope, counting by id needs no scope map: a quiz can never inflate
 * `kb-technical`. Ids with no content are absent from the result.
 */
export function deriveCategoryCounts(
  content: readonly CategoryCountable[],
): Record<string, number> {
  const counts: Record<string, number> = Object.create(null);
  for (const item of content) {
    if (!SCOPE_OF_KIND[item.kind]) continue;
    for (const id of new Set(item.categoryIds)) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Every category in the table with its derived count, 0 included. Table order preserved. */
export function countRows(categories: readonly Category[], content: readonly CategoryCountable[]) {
  const counts = deriveCategoryCounts(content);
  return categories.map((category) => ({
    id: category.id,
    scope: category.scope,
    slug: category.slug,
    name: category.name,
    count: counts[category.id] ?? 0,
  }));
}

/**
 * Renderability — a data:check invariant, not a schema rule.
 *
 * Before issue #130 this reported a quiz category with neither `image` nor `iconKey`:
 * every subject had to own an asset. That rule is gone with the twenty-three identical
 * `public/category/*.webp` placeholders — a tile with no artwork is now *drawn*, from a
 * gradient seeded by the slug and a monogram from the name, and the registry says so with
 * a `generated: true` entry that has no `src`.
 *
 * What is still a defect is a subject nothing can draw: no `image`, and no generated
 * default for its key. `hasGenerated` is passed in because `data/media.ts` is data, not
 * content — `data:check` answers it from the registry, and a category with no entry would
 * otherwise render a blank tile no gate could see.
 */
export function assertRenderableCategories(
  categories: readonly Category[],
  hasGenerated: (key: string) => boolean,
): string[] {
  return categories
    .filter(
      (category) =>
        category.scope === "quiz" &&
        category.image === undefined &&
        !hasGenerated(`category.${category.slug}`),
    )
    .map(
      (category) =>
        `quiz category "${category.id}" has no tile: no image and no generated media entry "category.${category.slug}"`,
    );
}

export function categoryIndex(categories: readonly Category[]): Map<string, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}

export function quizCategoryBySlug(
  categories: readonly Category[],
  slug: string,
): Category | undefined {
  return categories.find((category) => category.scope === "quiz" && category.slug === slug);
}

/** The `CategoryNameResolver` `selectQuizCard` expects, built from the table. */
export function makeCategoryNameResolver(
  categories: readonly Category[],
): (id: string) => string | undefined {
  const byId = categoryIndex(categories);
  return (id) => byId.get(id)?.name;
}

/**
 * The scope invariant, as a collection-level check for `data:check`.
 * Returns human-readable violations instead of throwing, so the caller prints all of them.
 */
export function assertCategoryScopes(
  content: readonly (CategoryCountable & { readonly id: string })[],
  categories: readonly Category[],
): string[] {
  const byId = categoryIndex(categories);
  const problems: string[] = [];
  for (const item of content) {
    const expected = SCOPE_OF_KIND[item.kind];
    if (item.categoryIds.length === 0)
      problems.push(`${item.kind} "${item.id}": categoryIds is empty`);
    for (const id of item.categoryIds) {
      const category = byId.get(id);
      if (!category) problems.push(`${item.kind} "${item.id}": unknown categoryId "${id}"`);
      else if (category.scope !== expected) {
        problems.push(
          `${item.kind} "${item.id}": categoryId "${id}" has scope "${category.scope}", expected "${expected}"`,
        );
      }
    }
    if (new Set(item.categoryIds).size !== item.categoryIds.length) {
      problems.push(`${item.kind} "${item.id}": duplicate categoryIds`);
    }
  }
  return problems;
}
