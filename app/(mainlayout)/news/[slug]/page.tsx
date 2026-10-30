import { NewsArticle } from "@/components/news/news-article";
import { newsArticlePageCopy } from "@/data/pages/news-article";
import { publishedArticle, relatedArticles } from "@/lib/article-records";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";

/**
 * The article's own title, so two news routes stop sharing one title. A slug that is
 * not a published record has no title to show; it says so rather than inheriting the
 * index's.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = publishedArticle("news", slug);
  return article === undefined
    ? { title: "Article Not Found" }
    : { title: article.title, description: article.summary };
}

/**
 * `/news/[slug]` — the slug is resolved here, before the reader mounts (issue #112).
 *
 * The lookup is a pure read of the article record store (issue #165), so it belongs in
 * the page, where a miss is a status code Next can send: a slug that is not a record and
 * a record that is not published are the same 404. The reader is a client component that
 * paints the record and the related band it is handed; it never looks anything up.
 */
export default function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const article = publishedArticle("news", slug);

  if (!article) notFound();

  return (
    <NewsArticle
      article={article}
      relatedArticles={relatedArticles(article)}
      copy={newsArticlePageCopy}
    />
  );
}
