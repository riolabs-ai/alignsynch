"use client";
import { CategoriesCTA } from "@/components/categories/categories-cta";
import { CategoriesHowItWorks } from "@/components/categories/categories-how-it-works";
import { Footer } from "@/components/layout/footer";
import { Input } from "@/components/ui/input";
import { categories } from "@/data/categories";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories based on search query
  const filteredCategories = categories.filter((category) => category.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div>
      <div className="container mx-auto pb-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Quiz Categories</h1>
          <p className="text-muted-foreground">Browse all quiz categories and find quizzes that match your interests.</p>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search categories..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        {/* Categories grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 xl:gap-6">
          {filteredCategories.map(({ count, id, image, name, slug }) => (
            <Link key={id} href={`/categories/${slug}`} className={`relative overflow-hidden rounded-xl text-white h-[200px] flex justify-between  shadow-sm items-end`}>
              <Image className="size-full object-cover object-center absolute inset-0" src={image} alt="" />
              <div className="absolute top-2 right-2 bg-white/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium">{count}</div>
              <span className="px-3 py-1.5 rounded-full bg-black/60 text-neutral-100 font-semibold backdrop-blur-sm text-sm absolute top-4 left-4 tracking-tight">{name}</span>
            </Link>
          ))}
        </div>

        {/* No results */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No categories found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">We couldn't find any categories matching "{searchQuery}". Try a different search term.</p>
          </div>
        )}
      </div>

      {/* Call to Action Section */}
      <CategoriesCTA />

      {/* How It Works Section */}
      <CategoriesHowItWorks />

      {/* Footer */}
      <Footer />
    </div>
  );
}
