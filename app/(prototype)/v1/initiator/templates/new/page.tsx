// template-ancestor: components/create/quiz-editor.tsx
import { TemplateEditor } from "@/components/v1/template-editor";

/** `/v1/initiator/templates/new` — the template author; `?template=<id>` opens an existing clone. */
export default async function V1TemplateNewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  return <TemplateEditor templateId={template} />;
}
