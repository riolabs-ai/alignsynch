/**
 * content/search.ts — the search index is DERIVED, never authored.
 *
 * Today's `data/searchdata.ts` is a fourth, unrelated catalog: 4 quizzes (`q1`…`q4`) that exist in no
 * collection, 4 categories whose `quizCount` (42/38/65/29) matches nothing, 3 creators whose
 * `quizCount` (87/34/56) matches no user, and 15 pages — the only correct rows. A second inline copy
 * lives in `components/search/search-results.tsx` with 8 quizzes, 6 categories and 4 creators, none of
 * which exist either. Both are replaced by `buildSearchIndex()`.
 *
 * ## Derivation rules (one row per source record, one field per source field)
 *
 * | index row      | source                                              | fields                                                                 |
 * |----------------|-----------------------------------------------------|------------------------------------------------------------------------|
 * | `quizzes[]`    | live quiz collection, `visibility === "public"`      | `id`, `slug`, `title`, `difficulty`, `categoryIds` copied verbatim      |
 * |                |                                                     | `path` = `/quiz/<slug>` (slug is URL identity, not id)                  |
 * | `categories[]` | category table, `scope === "quiz"`, `count > 0`      | `id`, `scope`, `slug`, `name`, `path` = `/categories/<slug>`            |
 * |                |                                                     | `count` = number of indexed quizzes with that categoryId                |
 * | `creators[]`   | users collection                                    | `id`, `username`, `name`, `path` = `/profile/<username>`                |
 * |                |                                                     | `quizCount` = number of indexed quizzes with `author.id === user.id`    |
 * | `pages[]`      | route manifest, static + indexable routes only      | `id` = `page-<path>`, `title` (curated, else de-slugged), `path`        |
 *
 * Rules that follow:
 *  - No authored text beyond page titles. Every number is a count of rows in another collection.
 *  - Private quizzes never enter the index (`visibility: "public"` only; `unlisted` opt-in via options).
 *  - `quizCount` is a derived count, so it is 0 for a creator with no quizzes — today's 87/34/56 are fiction
 *    and the real number is 0/0/0 until authorship is backfilled (migration note in
 *    docs/p1-migration/MIGRATION.md#consequences-worth-knowing).
 *  - Every `path` is validated with `isValidRoute()`; a path that does not resolve is a hard error, which is
 *    how the two dead notification routes and `/categories/<16 A slugs>` became impossible to re-introduce.
 *  - Output order is deterministic (quizzes by title, categories by count desc then name, creators by
 *    username, pages by path) so the index can be snapshot-tested and diffed in CI.
 */
import { z } from "zod";
import { zId, zDifficulty, type Difficulty } from "./core";
import { zCategoryScope, deriveCategoryCounts, type Category } from "./category";
import { indexablePages, isValidRoute, routeTitle, type RouteManifest } from "./route-manifest";

// ---------------------------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------------------------

export const zSearchQuizRow = z
  .object({
    id: zId,
    slug: z.string().min(1),
    title: z.string().min(1),
    path: z.string().startsWith("/"),
    categoryIds: z.array(zId).min(1),
    difficulty: zDifficulty,
  })
  .strict();

export const zSearchCategoryRow = z
  .object({
    id: zId,
    scope: zCategoryScope,
    slug: z.string().min(1),
    name: z.string().min(1),
    path: z.string().startsWith("/"),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const zSearchCreatorRow = z
  .object({
    id: zId,
    username: z.string().min(1),
    name: z.string().min(1),
    path: z.string().startsWith("/"),
    quizCount: z.number().int().nonnegative(),
  })
  .strict();

export const zSearchPageRow = z
  .object({
    id: zId,
    title: z.string().min(1),
    path: z.string().startsWith("/"),
  })
  .strict();

export const zSearchIndex = z
  .object({
    quizzes: z.array(zSearchQuizRow),
    categories: z.array(zSearchCategoryRow),
    creators: z.array(zSearchCreatorRow),
    pages: z.array(zSearchPageRow),
  })
  .strict();

export type SearchIndex = z.infer<typeof zSearchIndex>;
export type SearchQuizRow = z.infer<typeof zSearchQuizRow>;
export type SearchCategoryRow = z.infer<typeof zSearchCategoryRow>;
export type SearchCreatorRow = z.infer<typeof zSearchCreatorRow>;
export type SearchPageRow = z.infer<typeof zSearchPageRow>;

// ---------------------------------------------------------------------------------------------
// Inputs (structural — the index only needs these fields, not the whole content model)
// ---------------------------------------------------------------------------------------------

export interface SearchableQuiz {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly categoryIds: readonly string[];
  readonly visibility: "public" | "unlisted" | "private";
  readonly author?: { readonly id?: string };
}

export interface SearchableUser {
  readonly id: string;
  readonly username: string;
  readonly name: string;
}

export interface BuildSearchIndexOptions {
  /** include `visibility: "unlisted"` quizzes (shareable links). Default false. */
  readonly includeUnlisted?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------------

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function pageIdForPath(path: string): string {
  return `page-${path === "/" ? "home" : path.slice(1).replace(/\//g, "-")}`;
}

export function buildSearchIndex(
  quizzes: readonly SearchableQuiz[],
  categories: readonly Category[],
  users: readonly SearchableUser[],
  routeManifest: RouteManifest,
  options: BuildSearchIndexOptions = {},
): SearchIndex {
  const visible = quizzes.filter(
    (q) =>
      q.visibility === "public" ||
      (options.includeUnlisted === true && q.visibility === "unlisted"),
  );

  const quizRows: SearchQuizRow[] = visible
    .map((q) => ({
      id: q.id,
      slug: q.slug,
      title: q.title,
      path: `/quiz/${q.slug}`,
      categoryIds: [...new Set(q.categoryIds)],
      difficulty: q.difficulty,
    }))
    .sort((a, b) => byString(a.title, b.title) || byString(a.id, b.id));

  // counts over the *indexed* set, not the whole collection: a search hit's count must match what
  // searching that category actually returns.
  const counts = deriveCategoryCounts(
    visible.map((q) => ({ kind: "quiz" as const, categoryIds: q.categoryIds })),
  );

  const categoryRows: SearchCategoryRow[] = categories
    .filter((c) => c.scope === "quiz" && (counts[c.id] ?? 0) > 0)
    .map((c) => ({
      id: c.id,
      scope: c.scope,
      slug: c.slug,
      name: c.name,
      path: `/categories/${c.slug}`,
      count: counts[c.id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count || byString(a.name, b.name));

  const quizCountByAuthor = new Map<string, number>();
  for (const q of visible) {
    const authorId = q.author?.id;
    if (!authorId) continue;
    quizCountByAuthor.set(authorId, (quizCountByAuthor.get(authorId) ?? 0) + 1);
  }

  const creatorRows: SearchCreatorRow[] = users
    .map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      path: `/profile/${u.username}`,
      quizCount: quizCountByAuthor.get(u.id) ?? 0,
    }))
    .sort((a, b) => byString(a.username, b.username));

  const pageRows: SearchPageRow[] = indexablePages(routeManifest)
    .map((p) => ({ id: pageIdForPath(p.path), title: p.title || routeTitle(p.path), path: p.path }))
    .sort((a, b) => byString(a.path, b.path));

  const index: SearchIndex = {
    quizzes: quizRows,
    categories: categoryRows,
    creators: creatorRows,
    pages: pageRows,
  };

  const problems = validateSearchIndex(index, categories, routeManifest);
  if (problems.length > 0)
    throw new Error(
      `buildSearchIndex: ${problems.length} invalid row(s)\n  - ${problems.join("\n  - ")}`,
    );
  // The schema is the contract, not documentation: a row that gains or loses a field
  // has to fail here, exactly like a `data/` fixture fails `pnpm data:check`.
  return zSearchIndex.parse(index);
}

// ---------------------------------------------------------------------------------------------
// Validation (also used by data:check and by the C2 verification script)
// ---------------------------------------------------------------------------------------------

export function validateSearchIndex(
  index: SearchIndex,
  categories: readonly Category[],
  routeManifest: RouteManifest,
): string[] {
  const problems: string[] = [];
  const catById = new Map(categories.map((c) => [c.id, c]));

  for (const row of index.quizzes) {
    if (!isValidRoute(routeManifest, row.path))
      problems.push(`quiz "${row.id}": path ${row.path} does not resolve`);
    for (const id of row.categoryIds) {
      const cat = catById.get(id);
      if (!cat) problems.push(`quiz "${row.id}": unknown categoryId "${id}"`);
      else if (cat.scope !== "quiz")
        problems.push(`quiz "${row.id}": categoryId "${id}" is ${cat.scope}-scoped`);
    }
  }

  for (const row of index.categories) {
    if (!isValidRoute(routeManifest, row.path))
      problems.push(`category "${row.id}": path ${row.path} does not resolve`);
    if (row.scope !== "quiz")
      problems.push(`category "${row.id}": non-quiz scope in the search index`);
    const recounted = index.quizzes.filter((q) => q.categoryIds.includes(row.id)).length;
    if (row.count !== recounted)
      problems.push(`category "${row.id}": count ${row.count} != ${recounted} indexed quizzes`);
  }

  for (const row of index.creators) {
    if (!isValidRoute(routeManifest, row.path))
      problems.push(`creator "${row.id}": path ${row.path} does not resolve`);
  }

  for (const row of index.pages) {
    if (!isValidRoute(routeManifest, row.path))
      problems.push(`page "${row.id}": path ${row.path} does not resolve`);
    if (row.path.includes("[")) problems.push(`page "${row.id}": dynamic route in the index`);
  }

  const ids = [...index.quizzes, ...index.categories, ...index.creators, ...index.pages].map(
    (r) => r.id,
  );
  if (new Set(ids).size !== ids.length) problems.push("index row ids are not globally unique");

  return problems;
}
