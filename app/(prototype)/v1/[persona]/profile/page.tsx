// template-ancestor: components/identity/member-profile.tsx
import { V1Profile } from "@/components/v1/profile/member-profile";
import { isDashboardPersona, sectionAllowedFor } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/** `/v1/[persona]/profile` — the persona's own profile, with its edit-settings action shown. */
export default async function ProfilePage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  if (!isDashboardPersona(persona) || !sectionAllowedFor(persona, "profile")) notFound();
  return <V1Profile persona={persona} readOnly={false} />;
}
