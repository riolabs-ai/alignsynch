// template-ancestor: components/assessment-flow/template-detail.tsx
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { AdminTemplateDetail } from "@/components/v1/admin-template-detail";

/**
 * `/admin/console/templates/[id]` — one template: its Aspects, and every relationship that
 * started from it.
 *
 * `params` is a Promise in Next 16 and is unwrapped here; the template itself is read from the
 * store on the client, so an unknown id renders the console's not-found panel, not a 404.
 */
export default async function AdminTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StageColumn>
      <AdminTemplateDetail templateId={id} />
    </StageColumn>
  );
}
