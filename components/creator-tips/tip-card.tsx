"use client";

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import type { PageCopySection } from "@/content/pages";
import { tipCategoryName } from "@/data/creator-tips-data";
import { articlePath, type TipRecord } from "@/lib/article-records";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Bookmark, Clock } from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";

interface TipCardProps {
  tip: TipRecord;
  copy: PageCopySection;
}

export default function TipCard({ tip, copy }: TipCardProps) {
  return (
    <Link
      href={articlePath(tip)}
      className="group flex flex-col h-full overflow-hidden rounded-lg border border-gray-200 hover:border-purple-300 dark:border-gray-700 hover:shadow-md transition-all"
    >
      <div className="aspect-video relative">
        <Media
          alt={tip.title}
          className="object-cover"
          entry={entryOf(tip.cover)}
          fill
          kind={FALLBACK_KIND.tip}
          seed={tip.id}
        />
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center mb-3">
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
            {tipCategoryName(tip.categoryIds[0] ?? "")}
          </span>
          <div className="flex items-center ml-auto text-sm text-gray-500">
            <Clock size={14} className="mr-1" />
            {fillLabel(itemLabel(copy, "read-minutes"), { count: tip.readMinutes })}
          </div>
        </div>

        <h3 className="text-lg font-bold mb-2 group-hover:text-purple-700 transition-colors">
          {tip.title}
        </h3>

        <p className="text-gray-600 dark:text-gray-100 text-sm mb-4 flex-grow">{tip.summary}</p>

        <div className="flex items-center mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <GeneratedAvatar
              name={tip.author.name}
              seed={tip.author.id ?? tip.author.name}
              size={24}
              className="mr-2"
            />
            <span className="text-xs text-gray-700 dark:text-gray-200">{tip.author.name}</span>
          </div>

          <button
            className="ml-auto text-gray-400 hover:text-purple-600 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              // Bookmark functionality would go here
            }}
          >
            <Bookmark size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}
