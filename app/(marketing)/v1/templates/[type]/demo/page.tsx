// template-ancestor: components/assessment/assessment-report.tsx
import { TemplateDemo } from "@/components/v1/template-demo";
import { relationshipType } from "@/data/v1/relationship-types";
import { NotFoundState } from "@/components/v1/v1-ui";

/** `/v1/templates/[type]/demo` — a real report, labelled `Example`, before anyone pays. */
export default async function V1TemplateDemoPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const resolved = relationshipType(type);
  if (resolved === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No relationship type named "${type}" exists.`}
          back="/v1/templates"
        />
      </div>
    );
  }
  return <TemplateDemo type={resolved} />;
}
