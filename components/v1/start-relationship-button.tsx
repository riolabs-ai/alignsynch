// template-ancestor: components/auth/login-view.tsx (variation: the CTA is a persona switch plus the create entry, not a form submit)
"use client";

import { useV1Store } from "@/lib/v1/store";
import { usePathname, useRouter } from "next/navigation";

/** `/v1/templates/<type>` — the template page a CTA without a `typeId` prop stands on. */
const TEMPLATE_PAGE = /^\/v1\/templates\/([^/]+)$/;

/**
 * The one primary action on every public template surface: "Start this relationship".
 *
 * There is no auth, so "starting" is two honest moves in the prototype's own terms — become the
 * Initiator (the persona bar is the session), and open the create entry for this template, where the
 * Mode and Setting are chosen and the counterparty is named.
 *
 * **Where it goes.** `typeId`, when given, is the template. Without it the button reads the template
 * from the page it is standing on (`/v1/templates/<type>`), so the create entry (#404 §6) is
 * reachable from the template page without that page having to pass a prop — and any other surface
 * keeps the old destination, the Initiator's template library, which is still a real screen and never
 * a dead link.
 */
export function StartRelationshipButton({
  label = "Start this relationship",
  typeId,
}: {
  label?: string;
  typeId?: string;
}) {
  const { setPersona } = useV1Store();
  const router = useRouter();
  const pathname = usePathname();

  const onTemplatePage = TEMPLATE_PAGE.exec(pathname ?? "")?.[1];
  const resolvedTypeId = typeId ?? onTemplatePage;

  const start = () => {
    setPersona("initiator");
    router.push(
      resolvedTypeId === undefined
        ? "/v1/initiator/templates"
        : `/v1/templates/${resolvedTypeId}/create`,
    );
  };

  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex h-12 items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground hover:bg-action/90"
    >
      {label}
    </button>
  );
}
