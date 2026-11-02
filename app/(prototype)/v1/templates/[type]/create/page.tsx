// template-ancestor: components/create/quiz-editor.tsx   (variation: the create entry's route — same gate as the template page, one form instead of the editor)
import { CreateRelationshipForm } from "@/components/v1/create-relationship-form";
import { NotFoundState } from "@/components/v1/v1-ui";
import { purchasableRelationshipType } from "@/data/v1/relationship-types";

/**
 * `/v1/templates/[type]/create` — the create entry (#404 §6).
 *
 * The same gate the template page and the demo route use: `purchasableRelationshipType` resolves the
 * segment, and anything it will not sell — an unknown slug, or one of the three excluded dating rows
 * — answers the not-found state. A model that is not for sale cannot become a relationship, so the
 * form is never rendered for one.
 */
export default async function V1TemplateCreatePage({
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
  return <CreateRelationshipForm type={resolved} />;
}
