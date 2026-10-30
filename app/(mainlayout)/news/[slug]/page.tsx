import { NewsArticle } from "@/components/news/news-article";
import { newsData } from "@/data/news-data";
import { newsArticlePageCopy } from "@/data/pages/news-article";
import type { Metadata } from "next";
import { use } from "react";

/**
 * The article's own title, so two news routes stop sharing one title. A slug that is
 * not a record has no title to show; it says so rather than inheriting the index's.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = newsData.find((entry) => entry.slug === slug);
  return article === undefined
    ? { title: "Article Not Found" }
    : { title: article.title, description: article.summary };
}

export default function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <NewsArticle slug={slug} copy={newsArticlePageCopy} />;
}
