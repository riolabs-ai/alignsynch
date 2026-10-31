/**
 * The article record store: one record shape under `/news`, `/creator-tips` and
 * `/support` (issue #165).
 *
 * The claims this file proves, in the card's own terms:
 *
 *   1. every article the three editorial fixtures carry projects to a record —
 *      `type: "article"`, a title, a summary, a body, one date, a status, a category —
 *      and **no items**. The absence is structural, so it is asserted at the type level
 *      and at runtime.
 *   2. an index lists published records, newest first, and nothing else: the one `draft`
 *      in the fixtures is in the store and in neither the list nor the detail lookup.
 *   3. the detail lookup is by slug, and the old help-centre id shape maps to it (the
 *      redirect lives in `next.config.mjs`; that the id is `kb-` + the slug is asserted
 *      here, because the pattern is only correct if that holds).
 *   4. the store is the single read path: a record's title reaches the index and the
 *      detail from one authored field, which is why this file also pins that no second
 *      copy of the three collections exists.
 */
import { describe, expect, it } from "vitest";

import type { KbArticle } from "@/content/article";
import { zRecord } from "@/content/record";
import { articlePublication } from "@/data/article-publication";
import { brand, brandIdOf, type BrandId } from "@/data/brand";
import { tips } from "@/data/creator-tips-data";
import { kbArticlesByBrand } from "@/data/knowledge-base";
import { articlesData } from "@/data/knowledge-base-data";
import { newsData } from "@/data/news-data";
import {
  articleCategoryRows,
  articlePath,
  articleRecords,
  articleRecordsOf,
  publishedArticle,
  publishedArticles,
  relatedArticles,
  searchArticles,
  type ArticleRecordBase,
} from "@/lib/article-records";

/* ------------------------------------------------------------------ *
 * 1. It is a record, and it holds no items
 * ------------------------------------------------------------------ */

/** `false` compiles only if `items` is not a key of the record — the absence, not a rule. */
type ArticlesCarryNoItems = "items" extends keyof ArticleRecordBase ? true : false;
const articlesCarryNoItems: ArticlesCarryNoItems = false;

describe("article records", () => {
  it("projects every fixture article to a record that parses as the shared Record", () => {
    expect(articleRecords).toHaveLength(
      newsData.length +
        tips.length +
        kbArticlesByBrand.quizhub.length +
        kbArticlesByBrand.alignsynch.length,
    );

    for (const record of articleRecords) {
      const parsed = zRecord.safeParse({
        id: record.id,
        slug: record.slug,
        type: record.type,
        status: record.status,
        date: record.date,
        title: record.title,
        summary: record.summary,
      });
      expect(parsed.success, `${record.id}: ${parsed.success ? "" : parsed.error.message}`).toBe(
        true,
      );
      expect(record.type).toBe("article");
      expect(record.body.length).toBeGreaterThan(0);
      expect(record.categoryIds.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(record.date))).toBe(false);
    }
  });

  it("carries no items — that absence is what makes it an article", () => {
    expect(articlesCarryNoItems).toBe(false);
    for (const record of articleRecords) {
      expect("items" in record, `${record.id} carries items`).toBe(false);
    }
  });

  it("keeps ids globally unique and slugs unique within a kind", () => {
    const ids = new Set<string>();
    for (const record of articleRecords) {
      expect(ids.has(record.id), `duplicate id ${record.id}`).toBe(false);
      ids.add(record.id);
    }

    for (const kind of ["news", "tip", "kb"] as const) {
      const slugs = articleRecordsOf(kind).map((record) => record.slug);
      expect(new Set(slugs).size, `${kind} slugs are URLs`).toBe(slugs.length);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 2. Publication state is authored, and it is the only filter
 * ------------------------------------------------------------------ */

describe("publication", () => {
  it("names exactly the articles the fixtures carry — one row each, no orphans", () => {
    const fixtureIds = new Set(articleRecords.map((record) => record.id));
    const rowIds = articlePublication.map((row) => row.id);

    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect([...rowIds].sort()).toEqual([...fixtureIds].sort());
  });

  it("lists published records only, newest first", () => {
    for (const kind of ["news", "tip", "kb"] as const) {
      const published = publishedArticles(kind);
      const all = articleRecordsOf(kind);

      expect(published.length).toBeGreaterThan(0);
      expect(published.length).toBeLessThanOrEqual(all.length);
      for (const record of published) expect(record.status).toBe("published");

      const dates = published.map((record) => record.date);
      expect(dates).toEqual([...dates].sort((left, right) => right.localeCompare(left)));
    }
  });

  it("hides the draft from the index and answers 404 on its detail", () => {
    const draft = articleRecords.find((record) => record.status === "draft");
    expect(draft, "the fixtures carry one draft, so the rule is exercised").toBeDefined();
    if (!draft) return;

    const index = publishedArticles(draft.kind);
    expect(index.some((record) => record.id === draft.id)).toBe(false);
    expect(publishedArticle(draft.kind, draft.slug)).toBeUndefined();

    // It is still a record: the store knows it, the reader cannot reach it.
    expect(articleRecordsOf(draft.kind).some((record) => record.id === draft.id)).toBe(true);
  });

  it("resolves a published article by slug, like the news and tip routes", () => {
    for (const kind of ["news", "tip", "kb"] as const) {
      for (const record of publishedArticles(kind)) {
        expect(publishedArticle(kind, record.slug)?.id).toBe(record.id);
      }
    }
    expect(publishedArticle("kb", "no-such-article")).toBeUndefined();
  });

  it("keeps the help centre's old id shape exactly one prefix away from its slug", () => {
    // next.config.mjs redirects `/support/articles/kb-:slug` -> `/support/articles/:slug`,
    // so every kb id must be `kb-` + its own slug, and no slug may start with `kb-`.
    for (const record of publishedArticles("kb")) {
      expect(record.id).toBe(`kb-${record.slug}`);
      expect(record.slug.startsWith("kb-")).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 3. The reads the three surfaces call
 * ------------------------------------------------------------------ */

describe("reads", () => {
  it("builds each detail URL from the kind and the slug", () => {
    const [news] = publishedArticles("news");
    const [tip] = publishedArticles("tip");
    const [kb] = publishedArticles("kb");

    expect(articlePath(news)).toBe(`/news/${news.slug}`);
    expect(articlePath(tip)).toBe(`/creator-tips/${tip.slug}`);
    expect(articlePath(kb)).toBe(`/support/articles/${kb.slug}`);
  });

  it("offers related articles of the same kind, never itself, sharing a category", () => {
    for (const kind of ["news", "tip", "kb"] as const) {
      for (const article of publishedArticles(kind)) {
        const related = relatedArticles(article);
        expect(related.length).toBeLessThanOrEqual(3);
        for (const other of related) {
          expect(other.kind).toBe(article.kind);
          expect(other.id).not.toBe(article.id);
          expect(other.status).toBe("published");
          expect(other.categoryIds.some((id) => article.categoryIds.includes(id))).toBe(true);
        }
      }
    }
  });

  it("searches title and summary, and returns the list for an empty query", () => {
    const tips = publishedArticles("tip");
    const [first] = tips;

    expect(searchArticles(tips, "")).toHaveLength(tips.length);
    expect(searchArticles(tips, "   ")).toHaveLength(tips.length);

    const hit = searchArticles(tips, first.title.slice(0, 12).toLowerCase());
    expect(hit.some((article) => article.id === first.id)).toBe(true);
  });

  it("derives each surface's category counts from its published records", () => {
    for (const kind of ["news", "tip", "kb"] as const) {
      const rows = articleCategoryRows(kind);
      const published = publishedArticles(kind);
      expect(rows.reduce((total, row) => total + row.count, 0)).toBeLessThanOrEqual(
        published.length * rows.length,
      );
      for (const row of rows) {
        expect(row.count).toBe(
          published.filter((record) => record.categoryIds.includes(row.id)).length,
        );
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * 4. The help centre is per product (#309)
 * ------------------------------------------------------------------ */

/** Every word an article prints, in order — the same text a reader sees on the page. */
function textOf(article: KbArticle): string {
  return article.body
    .flatMap((block) => {
      if (block.type === "list") return block.items;
      if (block.type === "image") return [block.caption ?? ""];
      return [block.text];
    })
    .join("\n");
}

describe("the help centre is per product", () => {
  it("gives every help article to exactly one brand", () => {
    const owner = new Map<string, BrandId>();
    for (const [id, articles] of Object.entries(kbArticlesByBrand) as [
      BrandId,
      readonly KbArticle[],
    ][]) {
      for (const article of articles) {
        expect(
          owner.has(article.id),
          `${article.id} is in both ${owner.get(article.id)} and ${id}`,
        ).toBe(false);
        owner.set(article.id, id);
      }
    }
    for (const record of articleRecordsOf("kb")) {
      expect(owner.has(record.id), `${record.id} belongs to no brand's fixture`).toBe(true);
    }
  });

  it("renders only the active brand's published help articles", () => {
    const published = new Set(
      articlePublication.filter((row) => row.status === "published").map((row) => row.id),
    );
    const expected = kbArticlesByBrand[brandIdOf(brand)]
      .map((article) => article.id)
      .filter((id) => published.has(id))
      .sort();

    expect(
      publishedArticles("kb")
        .map((record) => record.id)
        .sort(),
    ).toEqual(expected);
  });

  it("answers 404 on another product's help article, by slug and by id", () => {
    const active = brandIdOf(brand);
    for (const id of Object.keys(kbArticlesByBrand) as BrandId[]) {
      if (id === active) continue;
      for (const article of kbArticlesByBrand[id]) {
        expect(publishedArticle("kb", article.slug), `${article.slug} from ${id}`).toBeUndefined();
      }
    }
  });

  it("keeps QuizHub's quiz articles, titles intact", () => {
    // The catalogue is an asset: the alignment build filters it, nobody deletes it (#309).
    const titles = kbArticlesByBrand.quizhub.map((article) => article.title);
    expect(titles).toContain("Creating Your First Tournament");
    expect(titles).toContain("Managing Your Subscription");
    expect(
      kbArticlesByBrand.quizhub.some((article) => article.id === "kb-reporting-a-problem"),
    ).toBe(true);
  });

  it("publishes no AlignSynch article about a product this build does not ship", () => {
    /** The families #309 is about. Adding one means AlignSynch ships it — a decision, not a copy. */
    const banned =
      /\b(?:tournaments?|payouts?|earnings?|premium|subscriptions?|tiers?|native apps?|mobile apps?)\b/i;

    for (const article of kbArticlesByBrand.alignsynch) {
      const words = `${article.title}\n${article.summary}\n${textOf(article)}`;
      const hit = words.match(banned);
      expect(
        hit?.[0],
        `${article.id} documents "${hit?.[0]}" for a product that does not have it`,
      ).toBe(undefined);
    }
  });
});
