import { QuizDiscussion } from "@/components/quiz/quiz-discustion";
import { selectCommentThreads, selectViewerResult } from "@/content/quiz-result";
import { quizComments } from "@/data/quiz-comments";
import { quizResults } from "@/data/quiz-results";
import { quizById } from "@/data/quizzes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import type { QuizCommentThread } from "@/content/quiz-result";

/**
 * `/quiz/[id]/discussion` — the result review for one record.
 *
 * The segment is `[id]`, so the param is `id`. It used to be destructured as
 * `slug`, which is `undefined` for this route: the page never had the record the
 * route named and rendered its mock regardless. The threads are built per question
 * here so the client component gets plain data.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = quizById(id);
  return { title: record === undefined ? "Quiz Discussion" : `${record.title} — Discussion` };
}

export default function QuizDiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const record = quizById(id);
  if (record === undefined) notFound();

  const result = selectViewerResult(quizResults, record.id);
  const threads: Record<string, QuizCommentThread[]> = {};
  for (const question of record.questions) {
    threads[question.id] = selectCommentThreads(quizComments, {
      quizId: record.id,
      questionId: question.id,
    });
  }

  return (
    <QuizDiscussion quiz={record} {...(result !== undefined ? { result } : {})} threads={threads} />
  );
}
