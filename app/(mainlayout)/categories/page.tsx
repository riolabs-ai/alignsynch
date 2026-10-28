import { CategoriesPage } from "@/components/categories/categories-page";

export const metadata = {
  title: "Quiz Categories | QuizHub",
  description: "Browse all quiz categories and find quizzes that match your interests.",
};

export default function CategoriesRoute() {
  return <CategoriesPage />;
}
