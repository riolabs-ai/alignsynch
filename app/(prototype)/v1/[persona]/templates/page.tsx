// template-ancestor: components/explore/explore-quiz-list.tsx
import { RelationshipLibrary } from "@/components/v1/relationship-library";
import { V1TemplateLibrary } from "@/components/v1/v1-template-library";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/**
 * `/v1/[persona]/templates` — two sections, because the product has two ideas here:
 *
 * 1. **The catalogue** (`V1TemplateLibrary`) — every relationship type, grouped Business ·
 *    Personal · Custom, with *View details* and *Start*. This is the library you shop in.
 * 2. **Your saved sets** (`RelationshipLibrary`) — the templates and the sets copied out of a
 *    relationship, listed with their Aspects named plainly. That is what "My Templates" means
 *    in the product.
 *
 * They were built independently by two cards and met on this route. They are not duplicates:
 * one is the market, the other is your shelf. Rendering only one would have silently deleted
 * the other card's work; a third wrapper component would have been a copy.
 *
 * Browse is allowed for every persona (#384); an initiator or admin additionally sees the
 * action row inside the catalogue.
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
      <V1TemplateLibrary />
      <RelationshipLibrary />
    </div>
  );
}
