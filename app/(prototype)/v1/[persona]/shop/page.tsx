// template-ancestor: components/pricing/pricing-plans.tsx
import { V1Shop } from "@/components/v1/v1-shop";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/shop` — the per-relationship subscription and checkout (initiator only). */
export default async function ShopPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "shop")) notFound();
  return <V1Shop canManageBilling />;
}
