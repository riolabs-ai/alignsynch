import { QuizDiscussionsPage } from "@/components/quiz/quiz-discussion-page";
import { selectQuizDiscussions } from "@/content/quiz-result";
import { quizComments } from "@/data/quiz-comments";
import { quizResults } from "@/data/quiz-results";
import { quizzes } from "@/data/quizzes";

/**
 * `/quiz-discussions` — one collection, three views. The rows are projected here
 * (server side) so the client component holds no fixture.
 */
export default function QuizDiscussionsPageRoute() {
  return (
    <QuizDiscussionsPage discussions={selectQuizDiscussions(quizzes, quizResults, quizComments)} />
  );
}
