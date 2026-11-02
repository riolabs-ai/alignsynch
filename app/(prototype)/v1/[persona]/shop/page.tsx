// template-ancestor: components/pricing/pricing-plans.tsx
import { V1Shop } from "@/components/v1/v1-shop";
import { canManageBilling, isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/**
 * `/v1/[persona]/shop` — the per-relationship subscription and checkout (initiator only).
 *
 * The route gate and the capability are the same fact here (`shop` is the initiator's row in the
 * #384 matrix, and `canManageBilling` is the initiator alone), which is deliberate: the shop
 * renders the *same* `V1Shop` the public `/v1/pricing` renders, and the capability is what turns
 * the billing half on. A counterparty or a coach answering this URL is a `notFound()`, and the
 * billing surfaces never render for them anywhere in the tree.
 */
export default async function ShopPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "shop")) notFound();
  return <V1Shop canManageBilling={canManageBilling(persona)} />;
}
