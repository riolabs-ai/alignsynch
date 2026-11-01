// template-ancestor: components/assessment-flow/answer-form.tsx
import { AnswerSheet } from "@/components/v1/answer-sheet";

/** `/v1/relationships/[id]/answer` — the answer sheet. */
export default async function V1AnswerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnswerSheet relationshipId={id} />;
}
