// template-ancestor: components/dashboard/dashboard-overview.tsx
import { PersonaDashboard } from "@/components/v1/dashboard-overview";
import { isDashboardPersona } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]` — the persona's dashboard overview. A persona with no dashboard 404s. */
export default async function PersonaDashboardPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!isDashboardPersona(persona)) notFound();
  return <PersonaDashboard persona={persona} />;
}
