import { ArticleDetail } from "@/components/support/article-detail";
import { articlesData } from "@/data/knowledge-base-data";
import { supportArticlePageCopy } from "@/data/pages/support-article";
import type { Metadata } from "next";
import { use } from "react";

/**
 * The article's own title. The record is the KB fixture (`data/knowledge-base-data.ts`),
 * the same lookup the page's client component does; an id that is not a record has no
 * title to show.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = articlesData.find((entry) => entry.id === id);
  return article === undefined
    ? { title: "Support Article" }
    : { title: article.title, description: article.summary };
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ArticleDetail articleId={id} copy={supportArticlePageCopy} />;
}
