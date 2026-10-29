/**
 * types/content/article.ts — C3 editorial: news · tip · knowledge-base.
 *
 * ONE article model, ONE body type:
 *
 *     body: ContentBlock[]
 *
 * `content: string | section[]` (news: `section{heading,paragraphs,image?,...}`,
 * kb: `section{heading,paragraphs,list?,note?}`, tip: markdown string) is retired,
 * together with the fourth inline re-declaration of the news section shape at
 * `components/news/news-article.tsx:145` (D8).
 *
 * Locked decisions implemented here (see editorial-migration.md §0):
 *  1. one discriminated block union, 6 variants, every object `strict()`
 *  2. adapters live in `blocks.ts` and are lossless (inverse functions prove it)
 *  3. `markdown` is a LEGACY block: allowed in `tip` only, and only as the sole block
 *  4. `summary` ← description/excerpt, `readMinutes` ← readTime, `publishedAt` ISO instant
 *  5. `featured: z.literal(true).optional()` — omit-or-true, `false` is unrepresentable
 *  6. one `zPersonRef` (avatar required for editorial), no 2-field vs 4-field author
 *  7. scoped category vocabularies, ids are `<scope>-<slug>` (see §2)
 *  8. kb categories == the `SupportCategory` union minus its `"all"` filter sentinel
 */
import { z } from "zod";

import { zContentBase, zId, zImageRef, zIsoDateTime, zPersonRef } from "./core";
import type { CategoryScope } from "./category";

/* ================================================================== *
 * 1. Content blocks
 * ================================================================== */

/**
 * A block image must be DESCRIBED. `zImageRef.alt` defaults to "" because a cover
 * image is decorative (the title carries the meaning); an in-body image is content,
 * so an empty alt is a migration bug, not a default. 22/22 news images have an alt.
 */
export const zBlockImage = zImageRef.extend({ alt: z.string().trim().min(1) });

export const zHeadingBlock = z
  .object({
    type: z.literal("heading"),
    text: z.string().min(1),
    /** 2 = section heading (was `section.heading`), 3 = sub-heading inside a section. */
    level: z.union([z.literal(2), z.literal(3)]).default(2),
  })
  .strict();

export const zParagraphBlock = z
  .object({ type: z.literal("paragraph"), text: z.string().min(1) })
  .strict();

export const zListBlock = z
  .object({
    type: z.literal("list"),
    items: z.array(z.string().min(1)).min(1),
    ordered: z.boolean().default(false),
  })
  .strict();

/** Callout. Was kb `section.note`, rendered as a styled aside. */
export const zNoteBlock = z.object({ type: z.literal("note"), text: z.string().min(1) }).strict();

export const zImageBlock = z
  .object({
    type: z.literal("image"),
    image: zBlockImage,
    /** Was `section.imageCaption`; always present together with alt in the fixture. */
    caption: z.string().min(1).optional(),
  })
  .strict();

/**
 * LEGACY: a verbatim markdown payload carried over from `Tip.content` so tips can
 * migrate without rewriting 1,099–1,905 characters of copy per record. It is a
 * migration escape hatch, not an authoring format: see `zTip` (sole block only) and
 * `zNewsArticle`/`zKbArticle` (forbidden outright).
 */
export const zMarkdownBlock = z
  .object({ type: z.literal("markdown"), text: z.string().min(1) })
  .strict();

export const zContentBlock = z.discriminatedUnion("type", [
  zHeadingBlock,
  zParagraphBlock,
  zListBlock,
  zNoteBlock,
  zImageBlock,
  zMarkdownBlock,
]);

/**
 * Every block EXCEPT `markdown`. News and kb bodies are this; a tip body is either
 * this or a single legacy markdown block — nothing in between. That is locked
 * decision 3 expressed in the type system instead of in a code review comment.
 */
export const zAuthoredBlock = z.discriminatedUnion("type", [
  zHeadingBlock,
  zParagraphBlock,
  zListBlock,
  zNoteBlock,
  zImageBlock,
]);

/** Any body: the base `zArticle` accepts all six block types. */
export const zArticleBody = z.array(zContentBlock).min(1);
/** Authored body (news, kb, and new tips). */
export const zAuthoredBody = z.array(zAuthoredBlock).min(1);
/** Tip body: one legacy markdown block, or authored blocks. Never a mix. */
export const zTipBody = z.union([z.tuple([zMarkdownBlock]), zAuthoredBody]);

export type HeadingBlock = z.infer<typeof zHeadingBlock>;
export type ParagraphBlock = z.infer<typeof zParagraphBlock>;
export type ListBlock = z.infer<typeof zListBlock>;
export type NoteBlock = z.infer<typeof zNoteBlock>;
export type ImageBlock = z.infer<typeof zImageBlock>;
export type MarkdownBlock = z.infer<typeof zMarkdownBlock>;
export type ContentBlock = z.infer<typeof zContentBlock>;
export type ContentBlockType = ContentBlock["type"];

/* ================================================================== *
 * 2. Editorial category vocabularies (locked decision 7)
 *
 * Slugs are the vocabulary; the id written into `categoryIds` is scope-prefixed
 * (`news-platform-updates`, `tip-technical`, `kb-technical`) because `technical`
 * exists in two vocabularies and a bare slug cannot be disambiguated. The prefix
 * also satisfies `zId` (kebab-case only — a `"tip:technical"` id would not parse).
 * Display names/labels/descriptions belong to the C2 taxonomy table, not here.
 * ================================================================== */

export const NEWS_CATEGORY_SLUGS = [
  "quiz-tips",
  "platform-updates",
  "community",
  "tutorials",
  "events",
  "success-stories",
  "industry-news",
] as const;

export const TIP_CATEGORY_SLUGS = [
  "question-writing",
  "engagement",
  "monetization",
  "design",
  "promotion",
  "technical",
] as const;

/**
 * The seven real `SupportCategory` members. `"all"` is a UI filter sentinel in
 * `components/support/support-page.tsx`, not a category an article can carry, so it
 * is excluded — the assertions below prove the two sets match exactly.
 */
export const KB_CATEGORY_SLUGS = [
  "account",
  "billing",
  "quiz-creation",
  "tournaments",
  "privacy",
  "technical",
  "general",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORY_SLUGS)[number];
export type TipCategory = (typeof TIP_CATEGORY_SLUGS)[number];
export type KbCategory = (typeof KB_CATEGORY_SLUGS)[number];

export const zNewsCategory = z.enum(NEWS_CATEGORY_SLUGS);
export const zTipCategory = z.enum(TIP_CATEGORY_SLUGS);
export const zKbCategory = z.enum(KB_CATEGORY_SLUGS);

/**
 * The support UI's filter sentinel (`"all"`) plus the seven real categories.
 * Declared HERE, once: the support page imports it instead of keeping a second
 * hand-written copy of the union (that duplicate WAS drift D16).
 */
export type SupportCategory = "all" | KbCategory;

export const CATEGORY_SLUGS_BY_SCOPE = {
  news: NEWS_CATEGORY_SLUGS,
  tip: TIP_CATEGORY_SLUGS,
  kb: KB_CATEGORY_SLUGS,
} as const;

/** The one place a category id is composed, so scope and slug can never drift apart. */
export const editorialCategoryId = (scope: CategoryScope, slug: string): string =>
  `${scope}-${slug}`;

export type NewsCategoryId = `news-${NewsCategory}`;
export type TipCategoryId = `tip-${TipCategory}`;
export type KbCategoryId = `kb-${KbCategory}`;
export type EditorialCategoryId = NewsCategoryId | TipCategoryId | KbCategoryId;

const NEWS_CATEGORY_IDS = NEWS_CATEGORY_SLUGS.map((s) => editorialCategoryId("news", s));
const TIP_CATEGORY_IDS = TIP_CATEGORY_SLUGS.map((s) => editorialCategoryId("tip", s));
const KB_CATEGORY_IDS = KB_CATEGORY_SLUGS.map((s) => editorialCategoryId("kb", s));

const membership = (allowed: readonly string[], scope: CategoryScope) =>
  zId.refine((v) => allowed.includes(v), {
    message: `must be a ${scope} category id (one of: ${allowed.join(", ")})`,
  });

/**
 * Category ids are checked by MEMBERSHIP, at the field, not by a cross-field refine:
 * a `news` article can physically only hold a `news-*` id and a `tip` article only a
 * `tip-*` id, so `tip-technical` and `kb-technical` can never be confused (the shared
 * `technical` slug is separated by scope, which a bare string could not do).
 */
export const zNewsCategoryId = membership(NEWS_CATEGORY_IDS, "news");
export const zTipCategoryId = membership(TIP_CATEGORY_IDS, "tip");
export const zKbCategoryId = membership(KB_CATEGORY_IDS, "kb");

/* ================================================================== *
 * 3. Author contract (locked decision 6, D17)
 * ================================================================== */

/**
 * Editorial authors are `zPersonRef` with a required avatar: all 9 news and all 6 tip
 * authors have one (4-field and 2-field inline objects respectively). `id` stays
 * optional and is absent on all 15 entries — no author is joined to a `User` today
 * (2 of the 14 distinct names, Alex Johnson and Sarah Williams, exist in
 * `lib/data/users.ts`, but the fixture links neither). C4 owns that reconciliation.
 */
export const zEditorialAuthor = zPersonRef.extend({ avatar: zImageRef });

/* ================================================================== *
 * 4. Article schemas
 * ================================================================== */

export const ARTICLE_KINDS = ["news", "tip", "kb"] as const;
export type ArticleKind = (typeof ARTICLE_KINDS)[number];

/**
 * Fields every editorial article has. Derived from `zContentBase` rather than
 * re-declared, so there is exactly one definition of id/slug/title/summary/
 * categoryIds/tags. `featured` is overridden to omit-or-true (locked decision 5;
 * §3's `z.boolean().default(false)` would have made `false` representable).
 */
export const zArticle = zContentBase
  .omit({
    kind: true,
    featured: true,
    author: true,
    cover: true,
    publishedAt: true,
    readMinutes: true,
  })
  .extend({
    kind: z.enum(ARTICLE_KINDS),
    featured: z.literal(true).optional(),
    publishedAt: zIsoDateTime,
    readMinutes: z.number().int().positive(),
    author: zEditorialAuthor,
    cover: zImageRef,
    body: zArticleBody,
  });

export const zNewsArticle = zArticle.extend({
  kind: z.literal("news"),
  categoryIds: z.array(zNewsCategoryId).min(1),
  body: zAuthoredBody,
});

export const zTip = zArticle.extend({
  kind: z.literal("tip"),
  categoryIds: z.array(zTipCategoryId).min(1),
  body: zTipBody,
});

/**
 * Knowledge-base articles are the only kind with no publication instant: the
 * fixture has no `date` field at all (0/8) and nothing renders one. `publishedAt`
 * is therefore optional HERE ONLY — news 9/9 and tips 6/6 always carry it. Absence
 * is recorded as absence; no epoch is invented (see editorial-migration.md §5, F1).
 */
export const zKbArticle = zArticle.omit({ author: true, cover: true, publishedAt: true }).extend({
  kind: z.literal("kb"),
  publishedAt: zIsoDateTime.optional(),
  categoryIds: z.array(zKbCategoryId).min(1),
  body: zAuthoredBody,
});

/** The collection validator: one discriminated union covering all three kinds. */
export const zAnyArticle = z.discriminatedUnion("kind", [zNewsArticle, zTip, zKbArticle]);

export type Article = z.infer<typeof zArticle>;
export type NewsArticle = z.infer<typeof zNewsArticle>;
export type Tip = z.infer<typeof zTip>;
export type KbArticle = z.infer<typeof zKbArticle>;
export type AnyArticle = z.infer<typeof zAnyArticle>;

/* ================================================================== *
 * 5. Collection helpers used by data:check (see editorial-invariants.md)
 * ================================================================== */

/**
 * Collection-level gate: the two invariants a per-record schema structurally cannot
 * see (D3). `id` is unique across ALL kinds; `slug` is unique per kind.
 */
export const zArticleCollection = z
  .object({
    news: z.array(zNewsArticle),
    tips: z.array(zTip),
    kb: z.array(zKbArticle),
  })
  .superRefine((collection, ctx) => {
    const ids = new Map<string, number>();
    const slugs = new Map<string, number>();
    const walk = (list: readonly AnyArticle[], field: "news" | "tips" | "kb") => {
      list.forEach((article, i) => {
        if (ids.has(article.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field, i, "id"],
            message: `duplicate article id "${article.id}" (ids are globally unique, kind-prefixed)`,
          });
        }
        ids.set(article.id, (ids.get(article.id) ?? 0) + 1);

        const key = `${article.kind}:${article.slug}`;
        if (slugs.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field, i, "slug"],
            message: `duplicate ${article.kind} slug "${article.slug}" (slugs are URLs: unique per kind, never reused)`,
          });
        }
        slugs.set(key, (slugs.get(key) ?? 0) + 1);
      });
    };
    walk(collection.news, "news");
    walk(collection.tips, "tips");
    walk(collection.kb, "kb");
  });

export type ArticleCollection = z.infer<typeof zArticleCollection>;
