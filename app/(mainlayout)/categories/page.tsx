import { CategoriesPage } from "@/components/categories/categories-page";
import { categoriesPageCopy } from "@/data/pages/categories";
import { shellPageCopy } from "@/data/pages/shell";

export const metadata = {
  title: "Quiz Categories | QuizHub",
  description: "Browse all quiz categories and find quizzes that match your interests.",
};

export default function CategoriesRoute() {
  // Two fixtures: the page's own bands (WU-8) and the shell the footer renders (WU-7).
  return <CategoriesPage copy={categoriesPageCopy} shellCopy={shellPageCopy} />;
}
