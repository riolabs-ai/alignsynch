// template-ancestor: components/marketing/marketing-landing.tsx
import { TemplatePage } from "@/components/v1/template-page";
import { purchasableRelationshipType } from "@/data/v1/relationship-types";
import { NotFoundState } from "@/components/v1/v1-ui";

/** `/v1/templates/[type]` — the page a person decides on, before they pay. */
export default async function V1TemplateTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const resolved = purchasableRelationshipType(type);
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
  return <TemplatePage type={resolved} />;
}
