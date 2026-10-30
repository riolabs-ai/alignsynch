import { ArticleDetail } from "@/components/support/article-detail";
import { supportArticlePageCopy } from "@/data/pages/support-article";
import { publishedArticle, relatedArticles } from "@/lib/article-records";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";

/**
 * The article's own title, from the record the slug resolves to. A slug that is not a
 * published help article has no title to show.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = publishedArticle("kb", slug);
  return article === undefined
    ? { title: "Support Article" }
    : { title: article.title, description: article.summary };
}

/**
 * `/support/articles/[slug]` — the route takes a **slug**, like the news and tip detail
 * routes (issue #165). It used to take the record id (`kb-account-setup`), which is not a
 * URL anybody should have to know: the old shape is a permanent redirect to the slug in
 * `next.config.mjs`, so a bookmarked or cached id link still lands on the article instead
 * of a 404.
 *
 * The lookup runs here, so an unpublished article and a slug that is not a record are
 * the same 404, and the reader is handed a record rather than looking one up in an effect.
 */
export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const article = publishedArticle("kb", slug);

  if (!article) notFound();

  return (
    <ArticleDetail
      article={article}
      relatedArticles={relatedArticles(article)}
      copy={supportArticlePageCopy}
    />
  );
}
