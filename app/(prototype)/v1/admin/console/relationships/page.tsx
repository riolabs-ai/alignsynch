// template-ancestor: components/my-quizzes/my-quizzes.tsx
import { AdminRelationshipRegistry } from "@/components/v1/admin-relationship-registry";
import { adminRegistryQueryOf } from "@/lib/v1/admin-console";

/**
 * `/v1/admin/console/relationships` — the relationship registry.
 *
 * The filter is read from the URL on the server and handed to the client component as a typed
 * query: every overview card links here with a parameter, so the list and the count it came from
 * are the same predicate, and a reload or a shared link reproduces the view. `searchParams` is a
 * Promise in Next 16, and nothing here reads the store — the rows are the client's.
 */
export default async function AdminRelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; subscription?: string; state?: string; filter?: string }>;
}) {
  const params = await searchParams;
  return <AdminRelationshipRegistry query={adminRegistryQueryOf(params)} />;
}
