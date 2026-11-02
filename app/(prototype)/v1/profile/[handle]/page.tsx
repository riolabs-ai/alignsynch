// template-ancestor: components/identity/member-profile.tsx
import { V1Profile } from "@/components/v1/profile/member-profile";
import { personaFromHandle } from "@/lib/v1/persona";
import { notFound } from "next/navigation";

/**
 * `/v1/profile/[handle]` — the public, read-only profile (#384 §3). The marketing link and the
 * in-app profile render the same `V1Profile` component; here its actions are hidden, so a stranger
 * sees the profile without an edit affordance. The handle resolves to a dashboard persona, and an
 * unknown handle answers `notFound()`.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const persona = personaFromHandle(handle);
  if (persona === null) notFound();
  return <V1Profile persona={persona} readOnly />;
}
