// template-ancestor: components/assessment-flow/answer-form.tsx
import { answerGateFor, answerGateMessage } from "@/lib/v1/blind";
import { seedRelationships } from "@/data/v1/fixtures";
import { AnswerSheet } from "@/components/v1/answer-sheet";
import { cookies } from "next/headers";
import Link from "next/link";

/**
 * `/v1/relationships/[id]/answer` — the answer sheet, gated server-side.
 *
 * The blind rule is enforced before the client sheet ever renders: the page reads the
 * `v1_persona` cookie and the seed relationship, and refuses a coach/admin/visitor (no answer
 * form) or a party who already submitted (no form until the next session). This is the
 * curl-provable half of the rule — the client `AnswerSheet` repeats the same refusal from the
 * live store.
 */
export default async function V1AnswerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const persona = jar.get("v1_persona")?.value ?? "visitor";
  const rel = seedRelationships.find((candidate) => candidate.id === id);

  if (rel === undefined) {
    return <AnswerSheet relationshipId={id} />;
  }

  const gate = answerGateFor(rel, persona);
  if (gate !== null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Answer the sheet</h1>
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {answerGateMessage(gate, rel)}
        </p>
        <Link
          href={`/v1/relationships/${id}`}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back to the relationship
        </Link>
      </div>
    );
  }

  return <AnswerSheet relationshipId={id} />;
}
