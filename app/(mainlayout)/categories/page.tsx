import { CategoriesPage } from "@/components/categories/categories-page";
import { categoriesPageCopy } from "@/data/pages/categories";

export const metadata = {
  title: "Quiz Categories | QuizHub",
  description: "Browse all quiz categories and find quizzes that match your interests.",
};

export default function CategoriesRoute() {
  return <CategoriesPage copy={categoriesPageCopy} />;
}
