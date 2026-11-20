"use server";

/**
 * `Save to My Templates` on the in-app template page (#1259).
 *
 * **One writer, not a second one.** This wraps the shipped action the shelf's kebab already calls
 * (`clonePublic`, in `app/(mainlayout)/dashboard/templates/actions.ts`), so a copy made here and a
 * copy made from a card are the same write with the same audit reason and the same refusals. The
 * only thing this module adds is the landing: a person who pressed the control on a page wants to
 * see the copy they made, so it redirects to the shelf's My Templates tab, focused on the new row
 * (`?tab=mine&new=<id>`) — the address the shelf's own copy notice is drawn at.
 *
 * A refusal comes back to this page as `?problem=<code>` rather than a 500: the code is a value the
 * page's fixture may or may not have a sentence for, and a value it has none for draws no band,
 * which is the rule the shelf's refusals follow.
 */
import { redirect } from "next/navigation";

import { relationshipTemplatePath } from "@/lib/flow/paths";
import { templatesTabPath } from "@/lib/member/shelf";
import { clonePublic } from "@/app/(mainlayout)/dashboard/templates/actions";

export async function saveTemplateCopy(formData: FormData): Promise<void> {
  const templateId = String(formData.get("templateId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const here = relationshipTemplatePath(slug);

  const outcome = await clonePublic({ templateId });
  if (outcome.ok) redirect(`${templatesTabPath("mine")}&new=${encodeURIComponent(outcome.id)}`);
  redirect(`${here}?problem=${encodeURIComponent(outcome.code)}`);
}
