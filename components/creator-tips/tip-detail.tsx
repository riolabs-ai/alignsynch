"use client";

import { Button } from "@/components/ui/button";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { ContentBlocks } from "@/components/content/content-blocks";
import { formatDate } from "@/content/core";
import type { PageCopySection } from "@/content/pages";
import { tipCategoryName } from "@/data/creator-tips-data";
import type { TipRecord } from "@/lib/article-records";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { ArrowLeft, Bookmark, Clock, Share2, ThumbsUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import RelatedTips from "./related-tips";
import { media } from "@/data/media";

interface TipDetailProps {
  /**
   * The record, resolved by the route from its slug (issue #165). It is a published
   * tip or the page has already called `notFound()`, so this reader never renders an
   * empty state for an unknown slug.
   */
  tip: TipRecord;
  /** Published tips sharing a category, newest first. Resolved by the route. */
  relatedTips: readonly TipRecord[];
  copy: PageCopySection;
  related: PageCopySection;
}

export default function TipDetail({ tip, relatedTips, copy, related }: TipDetailProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(45);
  const [hasLiked, setHasLiked] = useState(false);

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleLike = () => {
    if (hasLiked) {
      setLikeCount(likeCount - 1);
    } else {
      setLikeCount(likeCount + 1);
    }
    setHasLiked(!hasLiked);
  };

  return (
    <div className="container mx-auto">
      <Link
        href="/creator-tips"
        className="inline-flex items-center text-purple-600 hover:text-purple-800 mb-6"
      >
        <ArrowLeft size={16} className="mr-2" />
        {copy.heading}
      </Link>

      <article className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center mb-4">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-500 text-white">
              {tipCategoryName(tip.categoryIds[0] ?? "")}
            </span>
            <div className="flex items-center ml-4 text-sm text-gray-500 dark:text-gray-200">
              <Clock size={14} className="mr-1" />
              {fillLabel(itemLabel(copy, "read-minutes"), { count: tip.readMinutes })}
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold mb-4">{tip.title}</h1>

          <p className="text-xl text-gray-600 dark:text-gray-50 mb-6">{tip.summary}</p>
          <Image
            src={tip.cover?.src ?? media.placeholder.src}
            alt={tip.title}
            width={1000}
            height={300}
            className="object-cover aspect-[16/6] mb-6"
          />
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center">
              <GeneratedAvatar
                name={tip.author.name}
                seed={tip.author.id ?? tip.author.name}
                size={40}
                className="mr-3"
              />
              <div>
                <div className="font-medium">{tip.author.name}</div>
                <div className="text-sm text-gray-500">{formatDate(tip.date)}</div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex items-center",
                  isBookmarked && "text-purple-600 border-purple-200 bg-purple-50",
                )}
                onClick={handleBookmark}
              >
                <Bookmark size={16} className="mr-2" />
                {isBookmarked ? itemLabel(copy, "saved") : itemLabel(copy, "save")}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center"
                onClick={handleLike}
              >
                <ThumbsUp
                  size={16}
                  className={cn("mr-2", hasLiked && "fill-purple-600 text-purple-600")}
                />
                {likeCount}
              </Button>

              <Button variant="outline" size="sm" className="flex items-center">
                <Share2 size={16} className="mr-2" />
                {itemLabel(copy, "share")}
              </Button>
            </div>
          </div>
        </header>

        <div className="prose prose-purple max-w-none mb-12">
          <ContentBlocks blocks={tip.body} />
        </div>
      </article>

      {relatedTips.length > 0 && <RelatedTips articles={relatedTips} copy={related} />}
    </div>
  );
}
