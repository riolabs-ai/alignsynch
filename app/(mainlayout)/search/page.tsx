import { SearchResults } from "@/components/search/search-results";
import { searchIndex } from "@/data/searchdata";

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

  // The index is built here (server) and handed to the client component as data: the page
  // never imports the fixtures into the browser bundle, and the component owns no catalog.
  return <SearchResults query={q ?? ""} index={searchIndex} />;
}
