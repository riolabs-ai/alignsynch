/**
 * The article record store — the one read function under `/news`, `/creator-tips` and
 * `/support`.
 *
 * Under the shared record (issue #128, `content/record.ts`) a news post, a creator tip
 * and a help article are the same thing: a record of `type: "article"` with a title, a
 * summary, a body, a date, a status and a category — and **no items**. The absence is
 * what separates an article from a template: a template holds items with a response
 * scale, an article holds prose. `ArticleRecordBase` extends `Record`, so the seven
 * record fields cannot be dropped, and nothing here can grow an `items` key without
 * failing to compose with the record it claims to be.
 *
 * This module is the seam issue #165 asked for. Today the store is fixture-backed: it
 * projects the three editorial fixtures (`data/news-data.ts`,
 * `data/creator-tips-data.ts`, `data/knowledge-base-data.ts`) plus their record layer
 * (`data/article-publication.ts`, which supplies `status`) into records. When #145 lands
 * the tables, the same three functions — `publishedArticles`, `publishedArticle`,
 * `relatedArticles` — read the rows instead, and no component changes.
 *
 * The rules the surfaces rely on, in one place:
 *
 *   published only     every read here is `status === "published"`. A draft is absent
 *                      from its index and its detail is a 404, and there is no second
 *                      filter a surface has to remember.
 *   newest first       `date` descending; the index routes render them in that order.
 *   slugs are URLs     a detail route resolves `slug`, never `id`. The old id shape is
 *                      a redirect in `next.config.mjs` (`/support/articles/kb-<slug>`),
 *                      not a second lookup: an id is not a URL.
 *   one date           the article fixture's `publishedAt` is the record's `date` — the
 *                      instant it went live when published, the instant it was authored
 *                      while a draft. There is no second authored copy to drift from.
 */
import type {
  AnyArticle,
  ArticleKind,
  ContentBlock,
  KbArticle,
  NewsArticle,
  Tip,
} from "@/content/article";
import type { Category } from "@/content/category";
import { kbCategories, newsCategories, tipCategories } from "@/content/categories";
import type { PublishStatus } from "@/content/core";
import type { Record as ContentRecord } from "@/content/record";
import { articlePublication } from "@/data/article-publication";
import { tips } from "@/data/creator-tips-data";
import { articlesData } from "@/data/knowledge-base-data";
import { newsData } from "@/data/news-data";

/* ------------------------------------------------------------------ *
 * The record
 * ------------------------------------------------------------------ */

/**
 * What every article record has beyond the shared record: a kind (which editorial
 * surface reads it), the prose, the categories, and the reading time.
 *
 * There is no `items` field and none can be added here: `ContentRecord` is `strict()`
 * at the schema, so an article that carried one would not parse as a record at all.
 */
export interface ArticleRecordBase extends Omit<ContentRecord, "type"> {
  readonly type: "article";
  readonly kind: ArticleKind;
  readonly body: readonly ContentBlock[];
  readonly categoryIds: readonly string[];
  readonly readMinutes: number;
  /** Omit-or-true, like the schema: a list is featured or the key is absent. */
  readonly featured?: true;
}

/** A news post. News always has an author and a cover image (`content/article.ts`). */
export interface NewsRecord extends ArticleRecordBase {
  readonly kind: "news";
  readonly body: NewsArticle["body"];
  readonly categoryIds: NewsArticle["categoryIds"];
  readonly author: NewsArticle["author"];
  readonly cover: NewsArticle["cover"];
}

/** A creator tip. Authored blocks, or one legacy markdown block (`zTipBody`). */
export interface TipRecord extends ArticleRecordBase {
  readonly kind: "tip";
  readonly body: Tip["body"];
  readonly categoryIds: Tip["categoryIds"];
  readonly author: Tip["author"];
  readonly cover: Tip["cover"];
}

/** A support article. Help centre prose has no byline and no cover. */
export interface KbRecord extends ArticleRecordBase {
  readonly kind: "kb";
  readonly body: KbArticle["body"];
  readonly categoryIds: KbArticle["categoryIds"];
}

export type ArticleRecord = NewsRecord | TipRecord | KbRecord;

/* ------------------------------------------------------------------ *
 * Projection — the fixture-backed half
 * ------------------------------------------------------------------ */

const statusById: ReadonlyMap<string, PublishStatus> = new Map(
  articlePublication.map((row) => [row.id, row.status]),
);

function statusOf(id: string): PublishStatus {
  const status = statusById.get(id);
  if (status === undefined) {
    throw new Error(
      `article record "${id}" has no row in data/article-publication.ts — a record's status is authored, never defaulted`,
    );
  }
  return status;
}

/**
 * The record's one date. The model keeps `publishedAt` optional on `kb` because the
 * help-centre fixture had no date at all (see `content/article.ts` §4); a record still
 * carries one, so a kb article without it is a projection error rather than a record
 * with an absent date, and no epoch is invented to fill the gap.
 */
function dateOf(article: AnyArticle): string {
  if (!article.publishedAt) {
    throw new Error(
      `article record "${article.id}" has no date — a record carries exactly one, so the fixture must author it`,
    );
  }
  return article.publishedAt;
}

function project(article: AnyArticle): ArticleRecord {
  const base = {
    id: article.id,
    slug: article.slug,
    type: "article" as const,
    status: statusOf(article.id),
    date: dateOf(article),
    title: article.title,
    summary: article.summary,
    readMinutes: article.readMinutes,
    ...(article.featured ? { featured: true as const } : {}),
  };

  switch (article.kind) {
    case "news":
      return {
        ...base,
        kind: "news",
        body: article.body,
        categoryIds: article.categoryIds,
        author: article.author,
        cover: article.cover,
      };
    case "tip":
      return {
        ...base,
        kind: "tip",
        body: article.body,
        categoryIds: article.categoryIds,
        author: article.author,
        cover: article.cover,
      };
    case "kb":
      return {
        ...base,
        kind: "kb",
        body: article.body,
        categoryIds: article.categoryIds,
      };
  }
}

/**
 * Every article record, published or not, in fixture order. `data:check` and the
 * record test read this; a surface reads a query below, so a draft can never leak
 * into a page by importing the list directly.
 */
export const articleRecords: readonly ArticleRecord[] = [...newsData, ...tips, ...articlesData].map(
  project,
);

/* ------------------------------------------------------------------ *
 * Reads — the three functions a surface may call
 * ------------------------------------------------------------------ */

/** Newest first. The tie-break keeps the order stable if two records share an instant. */
function newestFirst(left: ArticleRecord, right: ArticleRecord): number {
  const byDate = right.date.localeCompare(left.date);
  return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
}

/**
 * The reads are overloaded per kind rather than generic: a caller that passes `"tip"`
 * gets `TipRecord[]` back, so `tip.author` needs no guard and a `NewsRecord` cannot be
 * handed to the tips grid. The implementation is the `ArticleKind` signature.
 *
 * Every read is published-only except `articleRecordsOf`, which the record test uses to
 * see the drafts. A surface that wants a draft has to say `articleRecords` out loud.
 */

/** Every record of one kind, drafts included. Not for rendering — see `publishedArticles`. */
export function articleRecordsOf(kind: "news"): readonly NewsRecord[];
export function articleRecordsOf(kind: "tip"): readonly TipRecord[];
export function articleRecordsOf(kind: "kb"): readonly KbRecord[];
export function articleRecordsOf(kind: ArticleKind): readonly ArticleRecord[];
export function articleRecordsOf(kind: ArticleKind): readonly ArticleRecord[] {
  return articleRecords.filter((record) => record.kind === kind);
}

/** The index's list: published records of one kind, newest first. */
export function publishedArticles(kind: "news"): readonly NewsRecord[];
export function publishedArticles(kind: "tip"): readonly TipRecord[];
export function publishedArticles(kind: "kb"): readonly KbRecord[];
export function publishedArticles(kind: ArticleKind): readonly ArticleRecord[];
export function publishedArticles(kind: ArticleKind): readonly ArticleRecord[] {
  return articleRecordsOf(kind)
    .filter((record) => record.status === "published")
    .sort(newestFirst);
}

/**
 * The detail route's lookup, by slug. A draft and an unknown slug answer the same way —
 * `undefined` — because "not published" is not a URL that exists for a reader.
 */
export function publishedArticle(kind: "news", slug: string): NewsRecord | undefined;
export function publishedArticle(kind: "tip", slug: string): TipRecord | undefined;
export function publishedArticle(kind: "kb", slug: string): KbRecord | undefined;
export function publishedArticle(kind: ArticleKind, slug: string): ArticleRecord | undefined;
export function publishedArticle(kind: ArticleKind, slug: string): ArticleRecord | undefined {
  return publishedArticles(kind).find((record) => record.slug === slug);
}

/** Same kind, published, sharing a category. The related band under a detail page. */
export function relatedArticles(article: NewsRecord, count?: number): readonly NewsRecord[];
export function relatedArticles(article: TipRecord, count?: number): readonly TipRecord[];
export function relatedArticles(article: KbRecord, count?: number): readonly KbRecord[];
export function relatedArticles(article: ArticleRecord, count?: number): readonly ArticleRecord[];
export function relatedArticles(article: ArticleRecord, count = 3): readonly ArticleRecord[] {
  return publishedArticles(article.kind)
    .filter(
      (record) =>
        record.id !== article.id &&
        record.categoryIds.some((id) => article.categoryIds.includes(id)),
    )
    .slice(0, count);
}

/** Title/summary search over a list a surface already resolved. An empty query is the list. */
export function searchArticles(
  articles: readonly NewsRecord[],
  query: string,
): readonly NewsRecord[];
export function searchArticles(articles: readonly TipRecord[], query: string): readonly TipRecord[];
export function searchArticles(articles: readonly KbRecord[], query: string): readonly KbRecord[];
export function searchArticles(
  articles: readonly ArticleRecord[],
  query: string,
): readonly ArticleRecord[];
export function searchArticles(
  articles: readonly ArticleRecord[],
  query: string,
): readonly ArticleRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return articles;
  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(needle) ||
      article.summary.toLowerCase().includes(needle),
  );
}

/**
 * The URL a record is read at. Composed here and not in a component: the three surfaces
 * spell their detail route three ways, and a surface that hardcodes the wrong one is a
 * link that 404s (E10 cannot see a template literal).
 */
export function articlePath(article: ArticleRecord): string {
  switch (article.kind) {
    case "news":
      return `/news/${article.slug}`;
    case "tip":
      return `/creator-tips/${article.slug}`;
    case "kb":
      return `/support/articles/${article.slug}`;
  }
}

/** The taxonomy rows of one surface, with the count derived from its published records. */
export function articleCategoryRows(
  kind: ArticleKind,
): ReadonlyArray<Category & { readonly count: number }> {
  const table: Record<ArticleKind, readonly Category[]> = {
    news: newsCategories,
    tip: tipCategories,
    kb: kbCategories,
  };
  const published = publishedArticles(kind);
  return table[kind].map((category) => ({
    ...category,
    count: published.filter((record) => record.categoryIds.includes(category.id)).length,
  }));
}
