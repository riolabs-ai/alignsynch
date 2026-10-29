import { ArticleDetail } from "@/components/support/article-detail";
import { supportArticlePageCopy } from "@/data/pages/support-article";
import { use } from "react";

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ArticleDetail articleId={id} copy={supportArticlePageCopy} />;
}
