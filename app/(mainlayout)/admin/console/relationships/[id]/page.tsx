// template-ancestor: components/assessment-flow/instance-view.tsx
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { AdminRelationshipDetail } from "@/components/v1/admin-relationship-detail";

/**
 * `/admin/console/relationships/[id]` — one relationship's console page.
 *
 * `params` is a Promise in Next 16 and is unwrapped here; the id is the only thing the page needs,
 * because the row itself is read from the store on the client (`lib/v1/store.tsx`). An id the
 * store does not hold renders the console's own not-found panel rather than Next's 404, so the
 * page stays inside the console's chrome. The gate is the layout's (`requireAdmin`), so this
 * renders for an allowlisted admin and nobody else.
 */
export default async function AdminRelationshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <StageColumn>
      <AdminRelationshipDetail relationshipId={id} />
    </StageColumn>
  );
}
