/**
 * Which help articles a build publishes — the brand-aware half of the knowledge base (#309).
 *
 * Two fixtures, one per product, and this table is the only place a build chooses between them:
 *
 *   quizhub      `data/knowledge-base-data.ts` — the quiz catalogue: getting started, account
 *                setup, subscription management, quiz creation, tournaments, privacy,
 *                troubleshooting, community guidelines, and one draft
 *   alignsynch   `data/knowledge-base-alignsynch-data.ts` — account and sign-in, invitations and
 *                their expiry, the Gap
 *
 * Why a table rather than a field on the article: `content/article.ts` models what an article
 * *says*, and `KbArticle` is `strict()`, so an article that carried a `brands` key would not parse.
 * Why not delete the quiz articles on the alignment build: they are QuizHub's catalogue and
 * QuizHub still renders them, so the choice is which *set* a build reads, not which articles
 * exist. `lib/article-records.ts` holds the union in its record store (so `data:check` and the
 * record test still see every article and its status row) and narrows the reads a surface calls.
 *
 * `Record<BrandId, …>` and not a lookup with a default: a third brand fails `tsc` until somebody
 * decides which articles it publishes, instead of silently inheriting the quiz set — the failure
 * this issue is about.
 */
import type { KbArticle } from "../content/article";
import type { BrandId } from "./brand";
import { alignSynchArticlesData } from "./knowledge-base-alignsynch-data";
import { articlesData } from "./knowledge-base-data";

export const kbArticlesByBrand: Readonly<Record<BrandId, readonly KbArticle[]>> = {
  quizhub: articlesData,
  alignsynch: alignSynchArticlesData,
};
