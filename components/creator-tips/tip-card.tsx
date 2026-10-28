"use client";

import type { Tip } from "@/data/creator-tips-data";
import { Bookmark, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface TipCardProps {
  tip: Tip;
}

export default function TipCard({ tip }: TipCardProps) {
  return (
    <Link href={`/creator-tips/${tip.slug}`} className="group flex flex-col h-full overflow-hidden rounded-lg border border-gray-200 hover:border-purple-300 dark:border-gray-700 hover:shadow-md transition-all">
      <div className="aspect-video relative">
        <Image src={tip.image || "/placeholder.svg"} alt={tip.title} fill className="object-cover" />
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center mb-3">
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
            {tip.category
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </span>
          <div className="flex items-center ml-auto text-sm text-gray-500">
            <Clock size={14} className="mr-1" />
            {tip.readTime} min
          </div>
        </div>

        <h3 className="text-lg font-bold mb-2 group-hover:text-purple-700 transition-colors">{tip.title}</h3>

        <p className="text-gray-600 dark:text-gray-100 text-sm mb-4 flex-grow">{tip.excerpt}</p>

        <div className="flex items-center mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full overflow-hidden mr-2">
              <Image src={tip.author.avatar || "/placeholder.svg"} alt={tip.author.name} width={24} height={24} className="object-cover" />
            </div>
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
