/**
 * `/dashboard/support/articles/[slug]` — one knowledge-base article, inside the dashboard (#542).
 *
 * **The same component as the public page, with two paths changed.** `ArticleDetail` draws the
 * article — the same record, the same blocks, the same help row — and this route hands it
 * `backHref="/dashboard/support"` and `articleHrefBase="/dashboard/support/articles"`, so the
 * breadcrumbs, the "browse articles" control and every related entry stay in the shell. The public
 * page (`app/(marketing)/support/articles/[slug]`) passes `/help`, and neither tree has to know
 * about the other.
 *
 * **The gate comes before the read.** `requireRole("member")` answers a signed-out request with
 * `/login?next=…` before the slug is even unwrapped — a refusal must not depend on the URL being
 * well-formed, the same rule the console's editor follows.
 *
 * **A slug that resolves to nothing is a 404**, exactly as the public route decides it: an
 * unpublished article and a slug that is not a record are one answer, so a draft's address cannot
 * be probed into existence.
 *
 * `force-dynamic` because the session is per-request: the build must pass with no auth environment.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleDetail } from "@/components/support/article-detail";
import { supportArticlePageCopy } from "@/data/pages/support-article";
import { requireRole } from "@/lib/auth/require-role";
import { publishedArticle, relatedArticles } from "@/lib/article-records";
import { DASHBOARD_ARTICLE_BASE, DASHBOARD_SUPPORT_PATH } from "@/lib/flow/paths";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = publishedArticle("kb", slug);
  return article === undefined
    ? { title: supportArticlePageCopy.heading }
    : { title: article.title, description: article.summary };
}

export default async function DashboardSupportArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("member", { next: DASHBOARD_SUPPORT_PATH });
  const { slug } = await params;

  const article = publishedArticle("kb", slug);
  if (article === undefined) notFound();

  return (
    <ArticleDetail
      article={article}
      relatedArticles={relatedArticles(article)}
      copy={supportArticlePageCopy}
      backHref={DASHBOARD_SUPPORT_PATH}
      articleHrefBase={DASHBOARD_ARTICLE_BASE}
    />
  );
}
