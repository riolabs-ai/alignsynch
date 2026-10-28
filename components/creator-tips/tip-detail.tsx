"use client";

import { Button } from "@/components/ui/button";
import { type Tip, getRelatedTips } from "@/data/creator-tips-data";
import { cn } from "@/lib/utils";
import { ArrowLeft, Bookmark, Clock, Share2, ThumbsUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Markdown from "react-markdown";
import RelatedTips from "./related-tips";
interface TipDetailProps {
  tip: Tip;
}

export default function TipDetail({ tip }: TipDetailProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(45);
  const [hasLiked, setHasLiked] = useState(false);

  const relatedTips = getRelatedTips(tip);

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
      <Link href="/creator-tips" className="inline-flex items-center text-purple-600 hover:text-purple-800 mb-6">
        <ArrowLeft size={16} className="mr-2" />
        Back to all tips
      </Link>

      <article className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center mb-4">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-500 text-white">
              {tip.category
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")}
            </span>
            <div className="flex items-center ml-4 text-sm text-gray-500 dark:text-gray-200">
              <Clock size={14} className="mr-1" />
              {tip.readTime} min read
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold mb-4">{tip.title}</h1>

          <p className="text-xl text-gray-600 dark:text-gray-50 mb-6">{tip.excerpt}</p>
          <Image src={tip.image || "/placeholder.svg"} alt={tip.title} width={1000} height={300} className="object-cover aspect-[16/6] mb-6" />
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                <Image src={tip.author.avatar || "/placeholder.svg"} alt={tip.author.name} width={40} height={40} className="object-cover" />
              </div>
              <div>
                <div className="font-medium">{tip.author.name}</div>
                <div className="text-sm text-gray-500">{tip.date}</div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" className={cn("flex items-center", isBookmarked && "text-purple-600 border-purple-200 bg-purple-50")} onClick={handleBookmark}>
                <Bookmark size={16} className="mr-2" />
                {isBookmarked ? "Saved" : "Save"}
              </Button>

              <Button variant="outline" size="sm" className="flex items-center" onClick={handleLike}>
                <ThumbsUp size={16} className={cn("mr-2", hasLiked && "fill-purple-600 text-purple-600")} />
                {likeCount}
              </Button>

              <Button variant="outline" size="sm" className="flex items-center">
                <Share2 size={16} className="mr-2" />
                Share
              </Button>
            </div>
          </div>
        </header>

        <div className="prose prose-purple max-w-none mb-12">
          <Markdown
            components={{
              h1: ({ node, ...props }) => <h1 className="text-4xl font-bold mb-6" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-3xl font-bold mb-5" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mb-4" {...props} />,
              h4: ({ node, ...props }) => <h4 className="text-xl font-bold mb-3" {...props} />,
              h5: ({ node, ...props }) => <h5 className="text-lg font-bold mb-2" {...props} />,
              h6: ({ node, ...props }) => <h6 className="text-base font-bold mb-2" {...props} />,
              p: ({ node, ...props }) => <p className="text-base mb-4 leading-relaxed" {...props} />,
              a: ({ node, ...props }) => <a className="text-purple-600 hover:text-purple-700 mb-3 block" {...props} />,
            }}
          >
            {tip.content}
          </Markdown>
        </div>
      </article>

      {relatedTips.length > 0 && <RelatedTips tips={relatedTips} />}
    </div>
  );
}
