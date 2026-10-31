import { QuizDiscussionsPage } from "@/components/quiz/quiz-discussion-page";
import { selectQuizDiscussions } from "@/content/quiz-result";
import { quizComments } from "@/data/quiz-comments";
import { quizResults } from "@/data/quiz-results";
import { quizzes } from "@/data/quizzes";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Discussions",
};

/**
 * `/quiz-discussions` — one collection, three views. The rows are projected here
 * (server side) so the client component holds no fixture.
 *
 * Quiz-only (#300): the gate is ahead of the projection, so the alignment build answers 404
 * without joining three quiz collections.
 */
export default function QuizDiscussionsPageRoute() {
  requireQuizProduct();
  return (
    <QuizDiscussionsPage discussions={selectQuizDiscussions(quizzes, quizResults, quizComments)} />
  );
}
