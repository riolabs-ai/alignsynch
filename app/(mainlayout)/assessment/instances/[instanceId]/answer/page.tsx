/**
 * `/assessment/instances/[instanceId]/answer` — the answer screen, shipped as **in-progress UI**
 * (#409, R1-E).
 *
 * The route is `answer` (singular) on purpose: `/answers` in the parent segment is the POST-only
 * endpoint the live form submits to, and Next refuses a `page.tsx` beside a `route.ts`. This page
 * calls neither — it reads and draws, and every control on it is disabled with the reason beside
 * it.
 *
 * The rows come from `readInstanceBundle()`, the same read the instance screen already uses: the
 * instance's own Aspect copy, its `mode`, its `setting` and its two `party` rows. No opinion is
 * read here, which is why the blind rule can be stated on the page without a column to hide —
 * `readInstanceBundle()` returns counts, never another party's scores.
 *
 * Nothing on this route writes. There is no cookie-driven viewer either: this screen is the sheet
 * as it will render, drawn for both seats, and it says so.
 */
import { AnswerSheetInProgress, type SheetAspect } from "@/components/assessment-flow/answer-sheet";
import type { AssessmentMode, AlignmentSetting, PartyRole } from "@/content/assessment";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import { instancePath } from "@/lib/flow/paths";
import { readInstanceBundle } from "@/lib/flow/store";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Answer",
};

/** Initiator first, so the two seats read in the order the glossary names them. */
const ROLE_ORDER: Record<PartyRole, number> = { initiator: 0, counterparty: 1 };

/**
 * A `party.role` column as the model's union. The column is a `TEXT` with a CHECK on the two
 * values (`db/migrations/0001_content_model.sql`), so this narrows a value the database already
 * constrains rather than trusting a free string.
 */
function roleOf(role: string): PartyRole {
  return role === "initiator" ? "initiator" : "counterparty";
}

export default async function AnswerSheetPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const bundle = await readInstanceBundle(instanceId);
  if (bundle === undefined) notFound();

  const aspects: SheetAspect[] = [...bundle.items]
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      itemId: item.item_id,
      prompt: item.prompt,
      leftValue: item.left_value ?? "",
      rightValue: item.right_value ?? "",
    }));

  const parties = [...bundle.parties]
    .map((party) => ({ role: roleOf(party.role), name: party.name }))
    .sort((left, right) => ROLE_ORDER[left.role] - ROLE_ORDER[right.role]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <AnswerSheetInProgress
        copy={assessmentAnswerPageCopy}
        aspects={aspects}
        parties={parties}
        mode={bundle.instance.mode as AssessmentMode}
        setting={bundle.instance.setting as AlignmentSetting}
        backHref={instancePath(instanceId)}
      />
    </div>
  );
}
