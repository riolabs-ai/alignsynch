/**
 * Publication state for the editorial articles — the half of an article record the
 * editorial schema does not carry.
 *
 * `content/article.ts` models what an article *says*: title, summary, body, categories,
 * author, cover. It has no `status`, because a news post that never went live is a fact
 * about the record, not about the prose. `content/record.ts::zRecord` does carry
 * `status` — a record is `draft | published | archived` — so this fixture is the record
 * layer: one row per article id, authored once, read by `lib/article-records.ts`.
 *
 * It is a table and not a default on purpose. A default (`published` unless listed)
 * would publish the next article somebody adds to a fixture without anyone deciding
 * that it ships; an explicit row makes the decision a line in the diff. The store
 * refuses to build a record whose id has no row here, and `tests/article-records.test.ts`
 * proves the table and the three fixtures name exactly the same ids.
 *
 * `kb-reporting-a-problem` is the one `draft`. It renders nowhere (an unpublished
 * record is absent from its index and its detail 404s) and it exists so that rule is
 * a fixture every gate run exercises, not a sentence in a pull request.
 */
import type { PublishStatus } from "../content/core";

export interface ArticlePublication {
  /** The article record's id, `news-*` | `tip-*` | `kb-*`. */
  readonly id: string;
  readonly status: PublishStatus;
}

export const articlePublication: readonly ArticlePublication[] = [
  // news — the nine published posts
  { id: "news-10-strategies-for-creating-engaging-quizzes", status: "published" },
  { id: "news-new-quiz-analytics-features", status: "published" },
  { id: "news-quiz-hub-community-spotlight-may", status: "published" },
  { id: "news-quiz-accessibility-guidelines", status: "published" },
  { id: "news-summer-quiz-championship-announcement", status: "published" },
  { id: "news-quiz-monetization-strategies-2025", status: "published" },
  { id: "news-ai-powered-quiz-creation-tools", status: "published" },
  { id: "news-quiz-design-psychology", status: "published" },
  { id: "news-quiz-trends-2025", status: "published" },

  // creator tips — the six published tips
  { id: "tip-1", status: "published" },
  { id: "tip-2", status: "published" },
  { id: "tip-3", status: "published" },
  { id: "tip-4", status: "published" },
  { id: "tip-5", status: "published" },
  { id: "tip-6", status: "published" },

  // support — seven published help articles, one still being written
  { id: "kb-getting-started", status: "published" },
  { id: "kb-account-setup", status: "published" },
  { id: "kb-subscription-management", status: "published" },
  { id: "kb-quiz-creation-basics", status: "published" },
  { id: "kb-tournament-creation", status: "published" },
  { id: "kb-privacy-settings", status: "published" },
  { id: "kb-troubleshooting-quiz-issues", status: "published" },
  { id: "kb-community-guidelines", status: "published" },
  { id: "kb-reporting-a-problem", status: "draft" },

  // support, AlignSynch's three (#309) — published, and selected by
  // `data/knowledge-base.ts` on `BRAND=alignsynch` instead of the quiz catalogue
  { id: "kb-account-and-sign-in", status: "published" },
  { id: "kb-invitations-and-expiry", status: "published" },
  { id: "kb-how-the-gap-is-computed", status: "published" },
];
