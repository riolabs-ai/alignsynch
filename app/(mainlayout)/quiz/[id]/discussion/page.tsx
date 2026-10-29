import { QuizDiscussion } from "@/components/quiz/quiz-discustion";
import { selectCommentThreads, selectViewerResult } from "@/content/quiz-result";
import { quizComments } from "@/data/quiz-comments";
import { quizResults } from "@/data/quiz-results";
import { quizById } from "@/data/quizzes";
import { notFound } from "next/navigation";
import { use } from "react";
import type { QuizCommentThread } from "@/content/quiz-result";

/**
 * `/quiz/[id]/discussion` — the result review for one quiz.
 *
 * The segment is `[id]`, so the param is `id`. It used to be destructured as
 * `slug`, which is `undefined` for this route: the page never had the quiz the
 * route named and rendered its mock regardless. The threads are built per question
 * here so the client component gets plain data.
 */
export default function QuizDiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quiz = quizById(id);
  if (quiz === undefined) notFound();

  const result = selectViewerResult(quizResults, quiz.id);
  const threads: Record<string, QuizCommentThread[]> = {};
  for (const question of quiz.questions) {
    threads[question.id] = selectCommentThreads(quizComments, {
      quizId: quiz.id,
      questionId: question.id,
    });
  }

  return (
    <QuizDiscussion quiz={quiz} {...(result !== undefined ? { result } : {})} threads={threads} />
  );
}
