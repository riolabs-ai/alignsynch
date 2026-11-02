// template-ancestor: components/explore/explore-quiz-list.tsx
import { RelationshipLibrary } from "@/components/v1/relationship-library";
import { V1TemplateLibrary } from "@/components/v1/v1-template-library";
import { canTakeLibraryActions, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/**
 * `/v1/[persona]/templates` — two sections, because the product has two ideas here:
 *
 * 1. **The catalogue** (`V1TemplateLibrary`) — every relationship type, grouped Business ·
 *    Personal · Custom, with *View details* and *Start*. This is the library you shop in.
 * 2. **Your saved sets** (`RelationshipLibrary`) — the templates and the sets copied out of a
 *    relationship, with their Aspects named plainly. That is what "My Templates" means.
 *
 * They were built independently by two cards and met on this route. They are not duplicates:
 * one is the market, the other is your shelf.
 *
 * The route is open to every dashboard persona — #384's matrix marks browsing `✓` for the
 * counterparty and `view` for the coach — and the **actions** are the gated part
 * (`canTakeLibraryActions`: initiator and admin). Gating the whole route on the action was the
 * deviation the owner flagged: a counterparty could not open the catalogue from their dashboard.
 */
export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "templates")) notFound();

  return (
    <div className="space-y-10">
      <V1TemplateLibrary canAct={canTakeLibraryActions(persona)} />
      <RelationshipLibrary />
    </div>
  );
}
