import { NewsArticle } from "@/components/news/news-article";
import { newsData } from "@/data/news-data";
import { newsArticlePageCopy } from "@/data/pages/news-article";
import { notFound } from "next/navigation";
import { use } from "react";

export const metadata = {
  title: "Article | QuizMaker News",
  description: "Read the latest quiz news and updates.",
};

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
