import type { PageCopySection } from "@/content/pages";
import { tipCategoryName } from "@/data/creator-tips-data";
import { articlePath, publishedArticles } from "@/lib/article-records";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { ArrowRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { media } from "@/data/media";

/** The featured tips are the published records that carry `featured: true`. */
export default function FeaturedTips({ copy }: { copy: PageCopySection }) {
  const featuredTips = publishedArticles("tip").filter((tip) => tip.featured);

  if (featuredTips.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6">{copy.heading}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 xxl:grid-cols-4 gap-6">
        {featuredTips.map((tip) => (
          <Link
            href={articlePath(tip)}
            key={tip.id}
            className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <div className="aspect-video relative">
              <Image
                src={tip.cover?.src ?? media.placeholder.src}
                alt={tip.title}
                fill
                className="object-cover"
              />
            </div>

            <div className="p-6">
              <div className="flex items-center mb-3">
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {tipCategoryName(tip.categoryIds[0] ?? "")}
                </span>
                <div className="flex items-center ml-auto text-sm text-gray-500 dark:text-gray-200">
                  <Clock size={14} className="mr-1" />
                  {fillLabel(itemLabel(copy, "read-minutes"), { count: tip.readMinutes })}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-2 group-hover:text-purple-700 transition-colors">
                {tip.title}
              </h3>

              <p className="text-gray-600 dark:text-gray-100 mb-4">{tip.summary}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                    <Image
                      src={tip.author.avatar?.src ?? media.placeholder.src}
                      alt={tip.author.name}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                  <span className="text-sm font-medium">{tip.author.name}</span>
                </div>

                <span className="text-purple-600 group-hover:translate-x-1 transition-transform flex items-center">
                  {itemLabel(copy, "read-more")} <ArrowRight size={16} className="ml-1" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
