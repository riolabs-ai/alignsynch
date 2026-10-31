import { QuizPlay } from "@/components/quiz/quiz-play";
import { categoryName } from "@/content/categories";
import { selectQuizForPlay } from "@/content/quiz";
import { quizById } from "@/data/quizzes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = quizById(id);
  return { title: record === undefined ? "Play Quiz" : `Play ${record.title}` };
}

/**
 * `/quiz/<id>/play` — the record the URL names, played.
 *
 * The play surface used to import `data/currentQuiz.ts` at module scope and ignore
 * the route param, so every id played the one "playable" record: the repaired
 * questions (#124) showed on the detail card and never here. The record is now
 * resolved on the server from the same `quizById()` the detail route uses, and the
 * play surface receives that record's questions, options and order.
 *
 * `notFound()` in two cases, both deliberate:
 *
 * - an id that is not a record — the route cannot play what the URL asked for;
 * - a record with **no questions** (the 5 draft browse cards; `data:check` W1).
 *   The old fallback answered that with a different record, so a card with no
 *   questions silently played an unrelated one. A 404 is the honest answer and
 *   keeps "what you clicked" and "what plays" the same record even when the record
 *   is empty.
 *
 * Nothing here scores or persists: the play surface keeps answers in client state
 * and checks each one against the question's `correctOptionId`.
 */
export default async function QuizPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = quizById(id);
  if (record === undefined || record.questions.length === 0) notFound();
  return <QuizPlay quiz={selectQuizForPlay(record, categoryName)} />;
}
