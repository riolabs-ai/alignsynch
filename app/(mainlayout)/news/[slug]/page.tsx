import { NewsArticle } from "@/components/news/news-article";
import { newsData } from "@/data/news-data";
import { newsArticlePageCopy } from "@/data/pages/news-article";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

/**
 * `/news/[slug]` — the slug is resolved here, before the reader mounts (issue #112).
 *
 * The reader is a client component that looks the record up in an effect, so an unknown
 * slug used to render its empty state on the server and then `router.push("/news")` on
 * the client: a 200 whose body was the news index. The lookup is a pure read of the
 * fixture, so it belongs in the page, where a miss is a status code Next can send.
 */
export default function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  if (!newsData.some((article) => article.slug === slug)) notFound();

  return <NewsArticle slug={slug} copy={newsArticlePageCopy} />;
}
