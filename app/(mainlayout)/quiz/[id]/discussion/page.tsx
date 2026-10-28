import { QuizDiscussion } from "@/components/quiz/quiz-discustion";
import { use } from "react";

export default function QuizDiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <QuizDiscussion id={slug} />;
}
