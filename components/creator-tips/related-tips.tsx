import type { PageCopySection } from "@/content/pages";
import type { TipRecord } from "@/lib/article-records";
import TipCard from "./tip-card";

interface RelatedTipsProps {
  articles: readonly TipRecord[];
  copy: PageCopySection;
}

export default function RelatedTips({ articles, copy }: RelatedTipsProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 pt-12 mt-12">
      <h2 className="text-2xl font-bold mb-6">{copy.heading}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <TipCard key={article.id} tip={article} copy={copy} />
        ))}
      </div>
    </div>
  );
}
