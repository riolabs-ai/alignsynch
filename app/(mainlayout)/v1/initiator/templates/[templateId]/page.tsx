// template-ancestor: components/assessment-flow/template-detail.tsx
import { TemplateDetail } from "@/components/v1/template-detail";

/** `/v1/initiator/templates/[templateId]` — one template, with "Start this relationship". */
export default async function V1TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <TemplateDetail templateId={templateId} />;
}
