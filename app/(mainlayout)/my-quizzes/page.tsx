import { MyQuizzes } from "@/components/my-quizzes/my-quizzes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Quizzes",
};

export default function MyQuizzesPage() {
  return <MyQuizzes />;
}
