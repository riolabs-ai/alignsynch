/**
 * `/assessment/instances/[instanceId]/accept` — the acceptance step, shipped as **in-progress
 * UI** (#409, R1-E).
 *
 * Acceptance first: the decision, then the two seats side by side, then the Aspect detail beneath
 * them. The one fact this route cannot render is the acceptance itself — the database has no
 * column that stores one — so the component says "not recorded" in words rather than drawing a
 * badge for a status nobody measured, and the accept control is disabled with the reason beside
 * it.
 *
 * The read is `readInstanceBundle()`, the same one the answer screen and the instance page use.
 * It returns the parties, their answer **counts** and the instance's Aspect copy — never an
 * opinion — which is what lets the blind rule be drawn (both columns sealed) instead of being
 * described.
 *
 * `force-dynamic`, and no `generateStaticParams`: this route reads a database and must not do so
 * at build time.
 */
import { AcceptSession, type AcceptAspect } from "@/components/assessment-flow/accept-session";
import type { AlignmentSetting, AssessmentMode, PartyRole } from "@/content/assessment";
import { assessmentAcceptPageCopy } from "@/data/pages/assessment-accept";
import { instancePath } from "@/lib/flow/paths";
import { readInstanceBundle } from "@/lib/flow/store";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review and accept",
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

export default async function AssessmentAcceptPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const bundle = await readInstanceBundle(instanceId);
  if (bundle === undefined) notFound();

  const aspects: AcceptAspect[] = [...bundle.items]
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      itemId: item.item_id,
      prompt: item.prompt,
      leftValue: item.left_value ?? "",
      rightValue: item.right_value ?? "",
    }));

  const parties = bundle.parties
    .map((party) => {
      const role = roleOf(party.role);
      return { role, name: party.name, answered: bundle.answerCounts[role] };
    })
    .sort((left, right) => ROLE_ORDER[left.role] - ROLE_ORDER[right.role]);

  return (
    <AcceptSession
      copy={assessmentAcceptPageCopy}
      parties={parties}
      aspects={aspects}
      mode={bundle.instance.mode as AssessmentMode}
      setting={bundle.instance.setting as AlignmentSetting}
      templateTitle={bundle.record.title}
      backHref={instancePath(instanceId)}
    />
  );
}
