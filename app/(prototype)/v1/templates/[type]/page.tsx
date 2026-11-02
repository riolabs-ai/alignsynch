// template-ancestor: components/v1/template-landing.tsx   (variation: the route gate — a purchasable type, or NotFoundState)
import { TemplatePage } from "@/components/v1/template-page";
import { NotFoundState } from "@/components/v1/v1-ui";
import { purchasableRelationshipType } from "@/data/v1/relationship-types";

/**
 * `/v1/templates/[type]` — the page a person decides on, before they pay.
 *
 * The gate is the whole file: `purchasableRelationshipType` answers `undefined` for an unknown id
 * and for a type that is not for sale (the dating rows), and both render `NotFoundState` rather
 * than a landing a visitor cannot act on. Everything a visitor reads is drawn by `TemplatePage`,
 * which arranges `template-landing.tsx` — the ancestor named above.
 */
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
