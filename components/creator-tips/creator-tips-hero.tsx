"use client";

// template-ancestor: components/explore/explore-header.tsx   (variation: the search field alone, no grid/list toggle, over the tips index)

import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import type React from "react";

import { Search } from "lucide-react";
import { useState } from "react";

interface CreatorTipsHeroProps {
  onSearch: (query: string) => void;
}

export default function CreatorTipsHero({
  onSearch,
  copy,
}: CreatorTipsHeroProps & { copy: PageCopySection }) {
  const [searchInput, setSearchInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  return (
    <div className="relative bg-action rounded-2xl p-8 mb-12 overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>

      <div className="relative max-w-3xl mx-auto text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{copy.heading}</h1>

        <p className="text-lg text-white/90 mb-8">{copy.body}</p>

        <form onSubmit={handleSubmit} className="relative max-w-md mx-auto ">
          <input
            type="text"
            placeholder={itemLabel(copy, "search-placeholder")}
            className="w-full dark:bg-slate-900 px-4 py-3 rounded-full pl-12 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-action"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="submit"
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-white"
          >
            <Search size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
