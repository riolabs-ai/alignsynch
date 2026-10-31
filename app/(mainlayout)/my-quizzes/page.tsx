import { MyQuizzes } from "@/components/my-quizzes/my-quizzes";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Quizzes",
};

/** Quiz-only (#300): an author's own quizzes, on the authoring build. */
export default function MyQuizzesPage() {
  requireQuizProduct();
  return <MyQuizzes />;
}
