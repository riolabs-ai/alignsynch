import { categoriesData } from "@/components/categories/categories-data";
import { CategoryDetailPage } from "@/components/categories/category-detail-page";
import { categoryDetailPageCopy } from "@/data/pages/category-detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";

// Was `export function Metadata(...)` — a component-shaped function with a name
// Next never reads, so `/categories/<slug>` shipped the layout title and the
// function was dead code (D14). `generateMetadata` is the export Next reads; it
// is async, so `use()` cannot be used here — await the (already-Promise) params.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = categoriesData.find((cat) => cat.slug === slug);

  if (!category) {
    return {
      title: "Category Not Found | QuizHub",
      description: "The requested category could not be found.",
    };
  }

  return {
    title: `${category.name} Quizzes | QuizHub`,
    description: `Browse and play ${category.name.toLowerCase()} quizzes. ${category.description}`,
  };
}

/**
 * `/categories/[slug]` — the record gate is the page's, not the view's (issue #112).
 *
 * An unknown slug used to fall through to `CategoryDetailPage` with
 * `categoryName: undefined`, which rendered the whole "explore all" wall under a 200
 * while `generateMetadata` already answered "Category Not Found". Now the page 404s and
 * `app/not-found.tsx` renders, so the status, the title and the body agree.
 */
export default function CategoryRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const category = categoriesData.find((cat) => cat.slug === slug);

  if (!category) notFound();

  return <CategoryDetailPage categoryName={category} copy={categoryDetailPageCopy} />;
}
