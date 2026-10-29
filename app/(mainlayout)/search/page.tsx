import { SearchResults } from "@/components/search/search-results";

export const metadata = {
  title: "Search Results | QuizMaker",
  description: "Search for quizzes, categories, creators, and more on QuizMaker.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return <SearchResults query={q ?? ""} />;
}
