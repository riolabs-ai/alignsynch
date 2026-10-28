import { SearchResults } from "@/components/search/search-results";

export const metadata = {
  title: "Search Results | QuizMaker",
  description: "Search for quizzes, categories, creators, and more on QuizMaker.",
};

export default function SearchPage({ searchParams }: { searchParams: { q: string } }) {
  const query = searchParams.q || "";

  return <SearchResults query={query} />;
}
