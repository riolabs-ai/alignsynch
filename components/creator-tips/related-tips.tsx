import type { PageCopySection } from "@/content/pages";
import type { Tip } from "@/data/creator-tips-data";
import TipCard from "./tip-card";

interface RelatedTipsProps {
  tips: readonly Tip[];
  copy: PageCopySection;
}

export default function RelatedTips({ tips, copy }: RelatedTipsProps) {
  if (tips.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 pt-12 mt-12">
      <h2 className="text-2xl font-bold mb-6">{copy.heading}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} copy={copy} />
        ))}
      </div>
    </div>
  );
}
